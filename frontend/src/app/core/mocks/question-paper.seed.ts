/**
 * The demo's ISE-3 draft, laid out like the institution's sample paper
 * (WIT Solapur, 23ECU7E1T Network Security, ISE-III Set A, 30 marks, 60 min):
 * Q1 six MCQs in two parts (CO3, CO4), Q2 any four of five long answers (CO3).
 * The question wording is illustrative. Q1 (b)(vi) repeats an option and Q2 (iv)
 * expects a higher Bloom level than its wording, so the demo shows both checks.
 */
import { AssessmentStructure } from '../models/marksheet.model';
import { QpOption, QpPaper, QpSubQuestion } from '../models/question-paper.model';

const opts = (...texts: string[]): QpOption[] => texts.map((text, i) => ({ key: 'ABCD'[i], text }));
const mcq = (label: string, text: string, options: QpOption[], expectedBloomLevel: QpSubQuestion['expectedBloomLevel']): QpSubQuestion =>
  ({ label, text, type: 'MCQ', options, marks: 1, expectedBloomLevel });
const long = (label: string, text: string, expectedBloomLevel: QpSubQuestion['expectedBloomLevel']): QpSubQuestion =>
  ({ label, text, type: 'DESCRIPTIVE', marks: 6, expectedBloomLevel });

export function networkSecurityIse3Draft(assessmentId: string, offeringId: string): Pick<QpPaper, 'assessmentId'> & Partial<QpPaper> {
  return {
    assessmentId, offeringId, validationId: `qpv-${assessmentId}`, status: 'DRAFT', version: 2,
    header: { setLabel: 'A', maxMarks: 30, durationMinutes: 60, examDate: '2026-11-04' },
    coIds: ['co-ns-3', 'co-ns-4'],
    questions: [
      {
        questionNo: 'Q1', heading: 'Choose the correct option',
        parts: [
          {
            label: 'a', coId: 'co-ns-3', subQuestions: [
              mcq('i', 'Which protocol provides authentication and encryption at the IP layer?',
                opts('SSL', 'IPsec', 'PGP', 'S/MIME'), 'REMEMBER'),
              mcq('ii', 'In IPsec, which mode protects the entire original IP packet?',
                opts('Transport mode', 'Tunnel mode', 'Aggressive mode', 'Main mode'), 'UNDERSTAND'),
              mcq('iii', 'Which IEEE standard defines port-based network access control?',
                opts('IEEE 802.11i', 'IEEE 802.3', 'IEEE 802.1X', 'IEEE 802.15'), 'REMEMBER'),
            ],
          },
          {
            label: 'b', coId: 'co-ns-4', subQuestions: [
              mcq('iv', 'Which phase of penetration testing gathers information about the target before any attack?',
                opts('Exploitation', 'Reconnaissance', 'Reporting', 'Covering tracks'), 'REMEMBER'),
              mcq('v', 'Which tool is commonly used for port scanning during a vulnerability assessment?',
                opts('Nmap', 'Wireshark', 'GnuPG', 'OpenSSL'), 'REMEMBER'),
              mcq('vi', 'WEP is considered insecure for wireless networks mainly because it:',
                opts('uses AES', 'reuses short initialization vectors', 'needs a RADIUS server', 'uses AES'), 'UNDERSTAND'),
            ],
          },
        ],
      },
      {
        questionNo: 'Q2', heading: 'Answer the following any four questions', coId: 'co-ns-3',
        attemptRule: { attempt: 4, outOf: 5 },
        subQuestions: [
          long('i', 'Explain the IPsec architecture with the roles of AH, ESP and security associations.', 'UNDERSTAND'),
          long('ii', 'Describe the SSL/TLS handshake and how it establishes a secure session at the transport layer.', 'UNDERSTAND'),
          long('iii', 'Compare PGP and S/MIME for email security in terms of trust model, key management and services.', 'ANALYZE'),
          long('iv', 'Explain how IEEE 802.1X and EAP provide network access control in an enterprise network.', 'APPLY'),
          long('v', 'Analyze how IKE negotiates security associations and protects against replay attacks.', 'ANALYZE'),
        ],
      },
    ],
    updatedAt: '2026-10-27T17:05:00Z', updatedBy: 'Rohan Belsare',
  };
}

const subs = (labels: string[], coId: string, maxMarks: number, bloomLevel: QpSubQuestion['expectedBloomLevel'], part?: string) =>
  labels.map(l => ({ label: part ? `(${part})(${l})` : `(${l})`, coIds: [coId], maxMarks, bloomLevel }));

/** Finalized marksheets for the demo's completed cycles (ISE-1, Activity 1, ISE-2, Activity 2). */
export function networkSecurityMarksheets(): (Pick<AssessmentStructure, 'assessmentId' | 'status' | 'source' | 'version' | 'questions'>)[] {
  const done = { status: 'FINALIZED' as const, version: 2 };
  return [
    {
      assessmentId: 'as-nsf-1', source: 'QUESTION_PAPER', ...done, questions: [
        { questionNo: 'Q1', subQuestions: subs(['i', 'ii', 'iii', 'iv', 'v', 'vi'], 'co-ns-1', 1, 'REMEMBER') },
        { questionNo: 'Q2', attemptRule: { attempt: 4, outOf: 5 }, subQuestions: subs(['i', 'ii', 'iii', 'iv', 'v'], 'co-ns-1', 6, 'UNDERSTAND') },
      ],
    },
    { assessmentId: 'as-nsf-2', source: 'FACULTY', ...done, questions: [{ questionNo: 'Mini project 1', coIds: ['co-ns-1'], maxMarks: 10 }] },
    {
      assessmentId: 'as-nsf-3', source: 'QUESTION_PAPER', ...done, questions: [
        { questionNo: 'Q1', subQuestions: subs(['i', 'ii', 'iii', 'iv', 'v', 'vi'], 'co-ns-2', 1, 'UNDERSTAND') },
        { questionNo: 'Q2', attemptRule: { attempt: 4, outOf: 5 }, subQuestions: subs(['i', 'ii', 'iii', 'iv', 'v'], 'co-ns-2', 6, 'APPLY') },
      ],
    },
    { assessmentId: 'as-nsf-4', source: 'FACULTY', ...done, questions: [{ questionNo: 'Mini project 2', coIds: ['co-ns-3', 'co-ns-4'], maxMarks: 10 }] },
  ];
}
