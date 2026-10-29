/**
 * Minimal .xlsx reading and writing for the mock stores only.
 *
 * In production Spring Boot parses uploads and generates templates (API_CONTRACT
 * §2.6, §15.3); the demo needs just enough to round-trip a one-sheet table of
 * text, so it uses no library. An .xlsx is a zip of XML parts: writing stores the
 * parts uncompressed, reading inflates them with the browser's DecompressionStream.
 */

/* ---------------------------------- zip ---------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip with every entry stored (no compression). */
function zipStored(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true);                    // stored
    local.setUint16(12, 0x21, true);                // 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    locals.push(new Uint8Array(local.buffer), name, f.data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(14, 0x21, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, f.data.length, true);
    central.setUint32(24, f.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const centralSize = centrals.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Every entry of a zip, by name. Supports stored and deflated entries. */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localAt = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    const raw = bytes.subarray(dataAt, dataAt + size);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ---------------------------------- xlsx ---------------------------------- */

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function columnName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
}

/** One sheet of text cells; the first row is bold. Opens in Excel, LibreOffice and Google Sheets. */
export function writeXlsx(sheetName: string, rows: string[][], widths: number[] = []): Blob {
  const enc = new TextEncoder();
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) =>
    `<c r="${columnName(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('');
  const parts: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  const zip = zipStored(Object.entries(parts).map(([name, xml]) => ({ name, data: enc.encode(xml) })));
  return new Blob([zip as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** The first sheet as rows of trimmed text ("" for empty cells). Throws if the file isn't a readable .xlsx. */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf);
  const dec = new TextDecoder();
  const xml = (name: string) => {
    const f = files.get(name);
    return f ? new DOMParser().parseFromString(dec.decode(f), 'application/xml') : null;
  };
  const byLocal = (doc: Document | Element, tag: string) => Array.from(doc.getElementsByTagNameNS('*', tag));

  // First sheet: workbook.xml → its r:id → workbook.xml.rels → target part.
  const workbook = xml('xl/workbook.xml');
  if (!workbook) throw new Error('not an xlsx');
  const firstSheet = byLocal(workbook, 'sheet')[0];
  const rid = firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const rels = xml('xl/_rels/workbook.xml.rels');
  const target = rels ? byLocal(rels, 'Relationship').find(r => r.getAttribute('Id') === rid)?.getAttribute('Target') : null;
  const sheetPath = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target}`) : 'xl/worksheets/sheet1.xml';
  const sheet = xml(sheetPath);
  if (!sheet) throw new Error('no worksheet');

  const shared = xml('xl/sharedStrings.xml');
  const strings = shared ? byLocal(shared, 'si').map(si => byLocal(si, 't').map(t => t.textContent ?? '').join('')) : [];

  const out: string[][] = [];
  for (const row of byLocal(sheet, 'row')) {
    const r = Number(row.getAttribute('r') ?? out.length + 1) - 1;
    const cells: string[] = [];
    for (const c of byLocal(row, 'c')) {
      const i = c.getAttribute('r') ? columnIndex(c.getAttribute('r')!) : cells.length;
      const type = c.getAttribute('t');
      const v = byLocal(c, 'v')[0]?.textContent ?? '';
      let text: string;
      if (type === 's') text = strings[Number(v)] ?? '';
      else if (type === 'inlineStr') text = byLocal(c, 't').map(t => t.textContent ?? '').join('');
      else if (type === 'b') text = v === '1' ? 'TRUE' : 'FALSE';
      else if (!type || type === 'n') text = /e/i.test(v) && Number.isFinite(Number(v)) ? String(Number(v)) : v;
      else text = v;
      cells[i] = text.trim();
    }
    out[r] = Array.from(cells, x => x ?? '');
  }
  return Array.from(out, x => x ?? []);
}
