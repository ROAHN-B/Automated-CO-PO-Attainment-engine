import { readXlsx, writeXlsx } from './xlsx-lite';

/** Builds a zip whose entries are deflated, the way Excel saves a workbook. */
async function deflatedZip(files: Record<string, string>): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const deflate = async (data: Uint8Array) =>
    new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const raw = enc.encode(text);
    const data = await deflate(raw);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, 8, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(10, 8, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, raw.length, true);
    c.setUint16(28, nameBytes.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[]).arrayBuffer();
}

describe('xlsx-lite (mock-only Excel reading and writing)', () => {
  it('reads back what it writes, including XML-special characters', async () => {
    const rows = [['First Name', 'Last Name'], ['Ada & Co', '<Lovelace>'], ['', 'only B']];
    const back = await readXlsx(await writeXlsx('Faculty', rows).arrayBuffer());
    expect(back).toEqual(rows);
  });

  it('reads a deflated workbook with shared strings, numbers and gaps, as Excel saves it', async () => {
    const buf = await deflatedZip({
      'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="People" sheetId="1" r:id="rId7"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId7" Type="worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Phone Number</t></si><si><r><t>Rah</t></r><r><t>ul</t></r></si></sst>',
      'xl/worksheets/sheet3.xml': '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
        + '<row r="1"><c r="A1" t="s"><v>1</v></c><c r="C1" t="s"><v>0</v></c></row>'
        + '<row r="3"><c r="C3"><v>9.87654321E9</v></c></row>'
        + '</sheetData></worksheet>',
    });
    const rows = await readXlsx(buf);
    expect(rows[0]).toEqual(['Rahul', '', 'Phone Number']);
    expect(rows[1]).toEqual([]);
    expect(rows[2][2]).toBe('9876543210');
  });

  it('refuses something that isn\'t a zip', async () => {
    await expectAsync(readXlsx(new TextEncoder().encode('First Name,Last Name').buffer as ArrayBuffer)).toBeRejected();
  });
});
