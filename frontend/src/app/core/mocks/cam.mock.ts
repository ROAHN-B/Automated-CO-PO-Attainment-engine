/**
 * In-memory stand-in for the CAM endpoints (API_CONTRACT v2.8 §9, CAM-1 … CAM-6).
 *
 * Since 2.8 the POs and PSOs come from the coordinator: a draft CAM always shows
 * the latest ones, and the activity, practical and tutorial items come from the
 * assessment plan, so faculty can title them and link COs but not add or remove them.
 *
 * Seeded with Mayuri's Network Security input record (25 Oct 2026): the
 * course inputs, and her first-pass unit → CO mapping and CO → PO/PSO levels
 * served as AI suggestions. The store enforces the contract's rules the way
 * the backend will; the screen only displays the results.
 */
import {
  Cam, CamCourseOutcome, CamInputs, CamItem, CamProgramOutcome, CamScoringRubric, CamSuggestion, CamSuggestionSet,
  CamUnit, CamUpdate, UnitCoLink, UnitCoSuggestion, UnitCoSuggestionSet,
} from '../models/cam.model';
import { CorrelationLevel } from '../models/faculty-workspace.model';
import { MockError } from './mock-error';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString();

export const NS_PROGRAM_OUTCOMES: CamProgramOutcome[] = [
  ['PO1', 'Engineering knowledge', 'Apply knowledge of mathematics, science, engineering fundamentals and an engineering specialization to solve complex engineering problems.'],
  ['PO2', 'Problem analysis', 'Identify, formulate, review research literature and analyze complex engineering problems, reaching substantiated conclusions using first principles.'],
  ['PO3', 'Design/development of solutions', 'Design solutions for complex engineering problems and system components or processes that meet specified needs, with consideration for public health, safety, society and the environment.'],
  ['PO4', 'Conduct investigations of complex problems', 'Use research-based knowledge and methods, including design of experiments, analysis and interpretation of data, to provide valid conclusions.'],
  ['PO5', 'Modern tool usage', 'Create, select and apply appropriate techniques, resources and modern engineering and IT tools, with an understanding of their limitations.'],
  ['PO6', 'The engineer and society', 'Apply contextual reasoning to assess societal, health, safety, legal and cultural issues relevant to professional engineering practice.'],
  ['PO7', 'Environment and sustainability', 'Understand the impact of engineering solutions in societal and environmental contexts and the need for sustainable development.'],
  ['PO8', 'Ethics', 'Apply ethical principles and commit to professional ethics, responsibilities and norms of engineering practice.'],
  ['PO9', 'Individual and team work', 'Function effectively as an individual and as a member or leader in diverse teams and multidisciplinary settings.'],
  ['PO10', 'Communication', 'Communicate effectively on complex engineering activities, including reports, design documentation, presentations and clear instructions.'],
  ['PO11', 'Project management and finance', 'Demonstrate engineering and management principles and apply them to one’s own work, as a member or leader, to manage projects.'],
  ['PO12', 'Life-long learning', 'Recognize the need for, and have the ability to engage in, independent life-long learning amid technological change.'],
  ['PSO1', 'Algorithms', 'Develop, realize and validate algorithms for different electronic systems and programming applications.'],
  ['PSO2', 'Systems', 'Develop, implement and test different electronic systems and computer applications.'],
  ['PSO3', 'Self learning', 'Comprehend applications of Electronics and Computer engineering through self learning.'],
].map(([code, title, statement]) => ({
  outcomeId: `out-${code.toLowerCase()}`, kind: code.startsWith('PSO') ? 'PSO' : 'PO', code, title, statement,
}));

/** Mayuri's proposed criteria (§9.3 default rubric). */
export const DEFAULT_RUBRIC: CamScoringRubric = {
  rubricId: 'rubric-cam-default', version: 1, status: 'PROPOSED',
  levels: [
    { level: 3, label: 'High', meaning: 'The CO directly and strongly develops the ability described by the PO/PSO.' },
    { level: 2, label: 'Medium', meaning: 'The CO develops relevant knowledge or skills described by the PO/PSO.' },
    { level: 1, label: 'Low', meaning: 'The CO makes a limited but meaningful contribution to the PO/PSO.' },
    { level: null, label: 'Blank', meaning: 'The course evidence doesn’t establish a meaningful relationship.' },
  ],
  rules: [
    'Justify every non-blank level with evidence from the official CO, the relevant units and the PO/PSO statement.',
    'Never give a level only because the wording looks similar.',
  ],
};

const item = (itemId: string, title: string, coIds: string[], description?: string): CamItem =>
  ({ itemId, title, description, coIds });

/** Mayuri's Network Security course, still in draft. */
export function networkSecurityCam(offeringId: string): Cam {
  return {
    camId: 'cam-ec306', offeringId, status: 'DRAFT', version: 3,
    inputs: {
      courseObjectives: [
        'Introduce fundamental principles of network security models and classical encryption techniques.',
        'Introduce the design and operation of block ciphers, public-key cryptography and key distribution mechanisms.',
        'Help students comprehend security standards and protocols at the network, internet and transport layers.',
        'Help students analyze wireless network vulnerabilities and propose security solutions for mobile and cloud computing.',
      ],
      courseOutcomes: [
        { coId: 'co-ns-1', code: 'CO1', statement: 'Explain the fundamental principles of network security models and classical encryption techniques.' },
        { coId: 'co-ns-2', code: 'CO2', statement: 'Illustrate the design and working of block ciphers, public key cryptography, and key distribution mechanisms.' },
        { coId: 'co-ns-3', code: 'CO3', statement: 'Analyze the functioning of security standards and protocols across the network, internet, and transport layers.' },
        { coId: 'co-ns-4', code: 'CO4', statement: 'Analyze network and wireless vulnerabilities and apply basic ethical hacking and penetration testing techniques to recommend security solutions.' },
      ],
      units: [
        { unitNumber: 1, title: 'Security Fundamentals', hours: 8, content: 'Computer security concepts; OSI security architecture; classification of attacks; security services and mechanisms; network security model; symmetric cipher model; Caesar, monoalphabetic, Playfair, Hill and polyalphabetic ciphers; transposition techniques; rotor machines; steganography.' },
        { unitNumber: 2, title: 'Block Ciphers and DES', hours: 7, content: 'Traditional block cipher structure; stream vs block ciphers; Feistel architecture; DES encryption, decryption and strength; public-key cryptosystems; RSA operation, mathematics, computational aspects and security.' },
        { unitNumber: 3, title: 'Key Management and Distribution', hours: 7, content: 'Symmetric key distribution using symmetric and asymmetric encryption; distribution of public keys; X.509 certificates; public key infrastructure.' },
        { unitNumber: 4, title: 'Network and Internet Security', hours: 6, content: 'Network access control; EAP; IEEE 802.1X; vulnerability assessment; conceptual penetration testing: reconnaissance, scanning, exploitation.' },
        { unitNumber: 5, title: 'Wireless Network Security', hours: 8, content: 'IEEE 802.11 wireless LAN security; mobile device security; PGP; S/MIME; introductory IPsec policies and ESP.' },
        { unitNumber: 6, title: 'IP Security & Ethical Hacking', hours: 6, content: 'IPsec architecture, policies, ESP, security associations, IKE; ethical hacking fundamentals; legal and ethical considerations; responsibilities; standard security tools.' },
      ],
      programOutcomes: clone(NS_PROGRAM_OUTCOMES),
      activities: [
        item('act-1', 'Mini project 1 — Classical cryptography toolkit', ['co-ns-1'], 'A menu-driven application implementing classical encryption and decryption algorithms.'),
        item('act-2', 'Mini project 2 — Secure enterprise network', ['co-ns-3', 'co-ns-4'], 'Design, build and secure a two-site enterprise network on Cisco, applying cryptography, key management, access control, wireless, email and IP security.'),
      ],
      practicals: [
        item('pr-1', 'Network security fundamentals', ['co-ns-1']),
        item('pr-2', 'Classical encryption techniques, part 1', ['co-ns-1']),
        item('pr-3', 'Classical encryption techniques, part 2', ['co-ns-1']),
        item('pr-4', 'RSA key generation and SSH configuration', ['co-ns-2']),
        item('pr-5', 'Key management and distribution using PKI and X.509 certificates', ['co-ns-2']),
        item('pr-6', 'Implementing X.509 certificates and a public key infrastructure', ['co-ns-2']),
        item('pr-7', 'Secure remote access using SSH on a Cisco router', ['co-ns-3']),
        item('pr-8', 'Pretty Good Privacy', ['co-ns-3']),
        item('pr-9', 'Site-to-site IPsec VPN using ESP on Cisco routers', ['co-ns-3']),
      ],
      tutorials: [],
    },
    unitMapping: { status: 'DRAFT', links: [] },
    cells: [],
    scoringRubric: clone(DEFAULT_RUBRIC),
    updatedAt: '2026-10-23T16:40:00Z',
    updatedBy: 'Rohan Belsare',
  };
}

/** Stage 1 — Mayuri's proposed unit → CO mapping. */
const UNIT_SUGGESTIONS: Omit<UnitCoSuggestion, 'suggestionId'>[] = [
  { unitNumber: 1, coId: 'co-ns-1', confidence: 0.94, needsReview: false, rationale: 'Security concepts, the OSI security architecture and classical ciphers are exactly what CO1 explains.' },
  { unitNumber: 2, coId: 'co-ns-2', confidence: 0.93, needsReview: false, rationale: 'Block cipher structure, DES and RSA are the block ciphers and public-key cryptography in CO2.' },
  { unitNumber: 3, coId: 'co-ns-2', confidence: 0.9, needsReview: false, rationale: 'Key distribution, X.509 and PKI are the key distribution mechanisms in CO2.' },
  { unitNumber: 4, coId: 'co-ns-3', confidence: 0.82, needsReview: false, rationale: 'NAC, EAP and IEEE 802.1X are network-layer security standards that CO3 analyzes.' },
  { unitNumber: 4, coId: 'co-ns-4', confidence: 0.91, needsReview: false, rationale: 'Vulnerability assessment and penetration testing match CO4 directly.' },
  { unitNumber: 5, coId: 'co-ns-3', confidence: 0.84, needsReview: false, rationale: 'IEEE 802.11 security, PGP, S/MIME and IPsec are protocols across the network and internet layers.' },
  { unitNumber: 5, coId: 'co-ns-4', confidence: 0.55, needsReview: true, rationale: 'Wireless LAN and mobile security relate to the wireless vulnerabilities in CO4.', reviewNote: 'Unit V doesn’t mention penetration testing or ethical hacking. Confirm this link.' },
  { unitNumber: 6, coId: 'co-ns-3', confidence: 0.86, needsReview: false, rationale: 'IPsec architecture, ESP, security associations and IKE are internet-layer security protocols.' },
  { unitNumber: 6, coId: 'co-ns-4', confidence: 0.92, needsReview: false, rationale: 'Ethical hacking fundamentals and standard security tools match CO4’s ethical hacking techniques.' },
];

/** Stage 2 — Mayuri's first-pass CAM (her appendix). [co, outcome code, level, rationale, reviewNote?] */
const CELL_SUGGESTIONS: [string, string, CorrelationLevel, string, string?][] = [
  ['co-ns-1', 'PO1', 3, 'Explaining security models and classical ciphers directly builds engineering knowledge of the field.'],
  ['co-ns-1', 'PO2', 1, 'Classifying attacks is a limited contribution to problem analysis.'],
  ['co-ns-1', 'PSO1', 1, 'Classical cipher algorithms make a limited contribution to developing algorithms.'],
  ['co-ns-2', 'PO1', 3, 'Block ciphers, RSA mathematics and key distribution are core engineering knowledge.'],
  ['co-ns-2', 'PO2', 2, 'Working through DES and RSA security strength develops problem analysis.'],
  ['co-ns-2', 'PSO1', 1, 'Cipher and key-generation algorithms are a limited link to developing algorithms.'],
  ['co-ns-3', 'PO1', 2, 'Understanding protocol standards develops relevant engineering knowledge.'],
  ['co-ns-3', 'PO2', 3, 'Analyzing how security protocols work across layers is direct problem analysis.'],
  ['co-ns-3', 'PO3', 1, 'Choosing protocols for a layer is a limited contribution to designing solutions.'],
  ['co-ns-3', 'PO4', 2, 'Investigating protocol behaviour develops the investigation of complex problems.'],
  ['co-ns-3', 'PO5', 2, 'Configuring SSH, PGP and IPsec VPNs on Cisco routers develops modern tool use.',
    'The evidence is the practicals only; no unit names a tool. Check the level.'],
  ['co-ns-3', 'PSO2', 1, 'Configuring secure network systems is a limited link to implementing systems.'],
  ['co-ns-4', 'PO1', 2, 'Vulnerability analysis draws on relevant engineering knowledge.'],
  ['co-ns-4', 'PO2', 3, 'Analyzing network and wireless vulnerabilities is direct problem analysis.'],
  ['co-ns-4', 'PO3', 2, 'Recommending security solutions develops solution design.'],
  ['co-ns-4', 'PO4', 2, 'Penetration testing is a structured investigation of a system.'],
  ['co-ns-4', 'PO5', 3, 'Ethical hacking and penetration testing rely directly on standard security tools.'],
  ['co-ns-4', 'PO6', 2, 'The legal side of ethical hacking develops awareness of societal responsibilities.'],
  ['co-ns-4', 'PO8', 3, 'The legal and ethical responsibilities of hacking directly develop professional ethics.'],
  ['co-ns-4', 'PSO1', 1, 'Applying attack techniques is a limited link to developing algorithms.'],
  ['co-ns-4', 'PSO2', 2, 'Building and securing a two-site network develops system implementation and testing.',
    'PSO2 is worded for the Electronics & Computer program. Check it applies to this course.'],
];

export class CamMockStore {
  private readonly cams: Record<string, Cam> = {};
  private seq = 0;

  /**
   * `onFinalized` runs after CAM-3 so the offering's lifecycle can move on.
   * `outcomes` gives the coordinator's current POs and PSOs (§15.5), when known.
   */
  constructor(
    seeds: Cam[],
    private readonly onFinalized: (offeringId: string) => void,
    private readonly outcomes?: () => CamProgramOutcome[],
  ) {
    for (const cam of seeds) this.cams[cam.offeringId] = clone(cam);
  }

  /** A new draft CAM, made when the offering's assessment plan is finalized. */
  create(cam: Cam): void {
    this.cams[cam.offeringId] = clone(cam);
  }

  /** CAM-1 */
  cam(offeringId: string): Cam {
    return clone(this.synced(this.find(offeringId)));
  }

  /** CAM-2 */
  save(offeringId: string, update: CamUpdate): Cam {
    const cam = this.synced(this.editable(offeringId, update.version));
    // The outcomes are the coordinator's (the body's copy is ignored), and the items are the plan's.
    for (const k of ['activities', 'practicals', 'tutorials'] as const) {
      const ids = (list: CamItem[]) => list.map(i => i.itemId ?? '').sort().join('|');
      if (ids(update.inputs[k]) !== ids(cam.inputs[k])) {
        throw new MockError(400, 'VALIDATION_FAILED', 'Activities, practicals and tutorials come from the assessment plan; they can’t be added or removed here.');
      }
    }
    const inputs = this.validInputs({ ...update.inputs, programOutcomes: clone(cam.inputs.programOutcomes) });

    const coIds = new Set(inputs.courseOutcomes.map(c => c.coId!));
    const outcomeIds = new Set(inputs.programOutcomes.map(o => o.outcomeId!));
    const units = new Set(inputs.units.map(u => u.unitNumber));
    // Removing a CO, unit or outcome removes what pointed at it (§9.4).
    const links = update.unitLinks.filter(l => coIds.has(l.coId) && units.has(l.unitNumber));
    const cells = update.cells.filter(c => coIds.has(c.coId) && outcomeIds.has(c.outcomeId));
    for (const k of ['activities', 'practicals', 'tutorials'] as const) {
      inputs[k] = inputs[k].map(i => ({ ...i, coIds: i.coIds.filter(id => coIds.has(id)) }));
    }

    const key = (l: UnitCoLink) => `${l.unitNumber}|${l.coId}`;
    const evidence = (i: CamInputs) => JSON.stringify([i.courseOutcomes, i.units]);
    const linksChanged = cam.unitMapping.links.map(key).sort().join() !== links.map(key).sort().join();
    if (cam.unitMapping.status === 'CONFIRMED' && (linksChanged || evidence(cam.inputs) !== evidence(inputs))) {
      cam.unitMapping = { status: 'DRAFT', links: [] };
    }
    cam.inputs = inputs;
    cam.unitMapping.links = clone(links);
    cam.cells = clone(cells);
    return this.touch(cam);
  }

  /** CAM-5 */
  suggestUnits(offeringId: string, coIds?: string[]): UnitCoSuggestionSet {
    const cam = this.editable(offeringId);
    if (!cam.inputs.courseOutcomes.length || !cam.inputs.units.length) {
      throw new MockError(422, 'PRECONDITION_FAILED', 'Add at least one CO and one unit before asking for suggestions.');
    }
    const hasCo = new Set(cam.inputs.courseOutcomes.map(c => c.coId));
    const hasUnit = new Set(cam.inputs.units.map(u => u.unitNumber));
    return {
      suggestionSetId: `uss-${Date.now()}`, basedOnCamVersion: cam.version,
      modelUsed: 'gemini-2.5-pro', templateId: 'cam-unit-co', templateVersion: '1', generatedAt: now(),
      suggestions: UNIT_SUGGESTIONS
        .filter(s => hasCo.has(s.coId) && hasUnit.has(s.unitNumber) && (!coIds?.length || coIds.includes(s.coId)))
        .map(s => ({ ...s, suggestionId: `us-${s.unitNumber}-${s.coId}` })),
    };
  }

  /** CAM-6 */
  confirmUnits(offeringId: string, version: number): Cam {
    const cam = this.editable(offeringId, version);
    if (!cam.inputs.courseOutcomes.length) {
      throw new MockError(422, 'PRECONDITION_FAILED', 'Add the course outcomes before confirming the mapping.');
    }
    const unlinked = cam.inputs.courseOutcomes.filter(co => !cam.unitMapping.links.some(l => l.coId === co.coId));
    if (unlinked.length) {
      throw new MockError(422, 'PRECONDITION_FAILED',
        `Link ${unlinked.map(c => c.code).join(', ')} to at least one unit before confirming.`);
    }
    cam.unitMapping = { ...cam.unitMapping, status: 'CONFIRMED', confirmedAt: now(), confirmedBy: 'Rohan Belsare' };
    return this.touch(cam);
  }

  /** CAM-4 */
  suggestCells(offeringId: string, coIds?: string[]): CamSuggestionSet {
    const cam = this.editable(offeringId);
    if (cam.unitMapping.status !== 'CONFIRMED') {
      throw new MockError(422, 'PRECONDITION_FAILED', 'Confirm the unit → CO mapping before asking for PO/PSO suggestions.');
    }
    const { activities, practicals, tutorials, courseOutcomes, programOutcomes } = cam.inputs;
    const items = [...activities, ...practicals, ...tutorials];
    const hasCo = new Set(courseOutcomes.map(c => c.coId));
    const suggestions: CamSuggestion[] = CELL_SUGGESTIONS
      .filter(([co, code]) => hasCo.has(co) && programOutcomes.some(o => o.code === code) && (!coIds?.length || coIds.includes(co)))
      .map(([coId, code, level, rationale, reviewNote]) => ({
        suggestionId: `cs-${coId}-${code.toLowerCase()}`,
        coId, outcomeId: programOutcomes.find(o => o.code === code)!.outcomeId!, suggestedLevel: level, rationale,
        evidence: {
          unitNumbers: cam.unitMapping.links.filter(l => l.coId === coId).map(l => l.unitNumber).sort((a, b) => a - b),
          itemIds: items.filter(i => i.coIds.includes(coId) && i.itemId).map(i => i.itemId!),
        },
        needsReview: !!reviewNote, reviewNote, confidence: reviewNote ? 0.58 : 0.8,
      }));
    return {
      suggestionSetId: `css-${Date.now()}`, basedOnCamVersion: cam.version, rubricVersion: cam.scoringRubric.version,
      modelUsed: 'gemini-2.5-pro', templateId: 'cam-co-po', templateVersion: '1', generatedAt: now(), suggestions,
    };
  }

  /** CAM-3 */
  finalize(offeringId: string, version: number): Cam {
    const cam = this.editable(offeringId, version);
    if (cam.unitMapping.status !== 'CONFIRMED') {
      throw new MockError(422, 'PRECONDITION_FAILED', 'Confirm the unit → CO mapping before finalizing.');
    }
    cam.status = 'FINALIZED';
    this.touch(cam);
    this.onFinalized(offeringId);
    return clone(cam);
  }

  /* ------------------------------- helpers ------------------------------ */

  /** Unique codes and unit numbers, non-empty text, and server IDs for new entries. */
  private validInputs(raw: CamInputs): CamInputs {
    const inputs = clone(raw);
    const fieldErrors: Record<string, string> = {};
    const unique = <T>(list: T[], keyOf: (t: T) => string, path: string, field: string) => {
      const seen = new Set<string>();
      list.forEach((t, i) => {
        const k = keyOf(t).trim().toUpperCase();
        if (!k) fieldErrors[`inputs.${path}[${i}].${field}`] = 'Required';
        else if (seen.has(k)) fieldErrors[`inputs.${path}[${i}].${field}`] = 'Duplicate';
        seen.add(k);
      });
    };
    unique(inputs.courseOutcomes, (c: CamCourseOutcome) => c.code, 'courseOutcomes', 'code');
    unique(inputs.units, (u: CamUnit) => String(u.unitNumber ?? ''), 'units', 'unitNumber');
    unique(inputs.programOutcomes, (o: CamProgramOutcome) => o.code, 'programOutcomes', 'code');
    inputs.courseOutcomes.forEach((c, i) => { if (!c.statement.trim()) fieldErrors[`inputs.courseOutcomes[${i}].statement`] = 'Required'; });
    inputs.units.forEach((u, i) => { if (!u.title.trim()) fieldErrors[`inputs.units[${i}].title`] = 'Required'; });
    if (Object.keys(fieldErrors).length) {
      const first = Object.keys(fieldErrors)[0];
      const what = first.includes('courseOutcomes') ? 'course outcome' : first.includes('units') ? 'unit' : 'program outcome';
      throw new MockError(400, 'VALIDATION_FAILED', `Check the ${what} list: each needs a unique code and some text.`);
    }
    inputs.courseObjectives = inputs.courseObjectives.map(o => o.trim()).filter(Boolean);
    inputs.courseOutcomes.forEach(c => (c.coId ??= `co-new-${++this.seq}`));
    inputs.programOutcomes.forEach(o => (o.outcomeId ??= `out-new-${++this.seq}`));
    for (const k of ['activities', 'practicals', 'tutorials'] as const) {
      if (inputs[k].some(i => !i.title.trim())) {
        throw new MockError(400, 'VALIDATION_FAILED', 'Each activity, practical and tutorial needs a title.');
      }
    }
    return inputs;
  }

  /**
   * A draft CAM always holds the coordinator's latest POs and PSOs (§9.1). Outcome
   * IDs are kept by code, so existing cells stay; cells of an outcome that no longer
   * exists are dropped. A finalized CAM keeps what it was finalized with.
   */
  private synced(cam: Cam): Cam {
    if (!this.outcomes || cam.status !== 'DRAFT') return cam;
    const byCode = new Map(cam.inputs.programOutcomes.map(o => [o.code, o.outcomeId]));
    cam.inputs.programOutcomes = this.outcomes().map(o => ({ ...o, outcomeId: byCode.get(o.code) ?? o.outcomeId }));
    const ids = new Set(cam.inputs.programOutcomes.map(o => o.outcomeId));
    cam.cells = cam.cells.filter(c => ids.has(c.outcomeId));
    return cam;
  }

  private find(offeringId: string): Cam {
    const cam = this.cams[offeringId];
    if (!cam) throw new MockError(404, 'NOT_FOUND', 'This course has no CAM yet.');
    return cam;
  }

  private editable(offeringId: string, version?: number): Cam {
    const cam = this.find(offeringId);
    if (cam.status === 'FINALIZED') throw new MockError(409, 'ALREADY_FINALIZED', 'The CAM is finalized and can’t be changed.');
    if (version !== undefined && version !== cam.version) {
      throw new MockError(409, 'VERSION_CONFLICT', 'Someone else saved this CAM. Reload to see their changes.');
    }
    return cam;
  }

  private touch(cam: Cam): Cam {
    cam.version += 1;
    cam.updatedAt = now();
    cam.updatedBy = 'Rohan Belsare';
    return clone(cam);
  }
}

/** The same course once finalized: Mayuri's suggestions as the faculty's confirmed values. */
export function finalizedNetworkSecurityCam(offeringId: string): Cam {
  const cam = networkSecurityCam(offeringId);
  const outcomeId = (code: string) => cam.inputs.programOutcomes.find(o => o.code === code)!.outcomeId!;
  return {
    ...cam, camId: `cam-${offeringId}`, status: 'FINALIZED', version: 9,
    unitMapping: {
      status: 'CONFIRMED', confirmedAt: '2026-07-28T10:00:00Z', confirmedBy: 'Rohan Belsare',
      links: UNIT_SUGGESTIONS.map(s => ({ unitNumber: s.unitNumber, coId: s.coId, source: 'FACULTY' as const })),
    },
    cells: CELL_SUGGESTIONS.map(([coId, code, level]) => ({ coId, outcomeId: outcomeId(code), level, source: 'FACULTY' as const })),
    updatedAt: '2026-07-30T09:15:00Z',
  };
}
