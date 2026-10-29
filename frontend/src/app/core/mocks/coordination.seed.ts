/**
 * Demo data for the coordinator mock: ECE Semester VII as printed in the
 * college's load distribution (theory 550, laboratory 250, grand total 800).
 *
 * How each column's marks are earned isn't in the printed table [O-27], so the
 * splits below (e.g. ISE 40 = 2 tests × 15 + 2 activities × 5) are examples, as
 * are the codes of the elective lab options and the MDM options.
 */
import { ComponentConfig, ComponentItem, CourseOption, LoadRow } from '../models/coordination.model';
import { AssessmentCategory } from '../models/faculty-workspace.model';

const none = (): ComponentConfig => ({ totalMarks: 0, items: [] });
const col = (...items: [AssessmentCategory, number, number][]): ComponentConfig => {
  const list: ComponentItem[] = items.map(([category, count, maxMarksEach]) => ({ category, count, maxMarksEach }));
  return { totalMarks: list.reduce((s, i) => s + i.count * i.maxMarksEach, 0), items: list };
};
const opt = (courseCode: string, courseName: string, offeringDepartment?: string): CourseOption =>
  ({ courseCode, courseName, offered: true, ...(offeringDepartment ? { offeringDepartment } : {}) });

type Seed = Omit<LoadRow, 'totalMarks' | 'assessmentScheme' | 'needsFaculty'> & { needsFaculty?: boolean };

const theoryCourse = (groupCode: string, courseCode: string, courseName: string, lecture: number, options?: CourseOption[]): Seed => ({
  section: 'THEORY', groupCode, courseCode, courseName, hours: { lecture, tutorial: 0, practical: 0 }, credits: lecture,
  components: { ese: col(['ESE', 1, 60]), oePoe: none(), ise: col(['ISE', 2, 15], ['ACTIVITY', 2, 5]), ica: none() },
  ...(options ? { options } : {}),
});

const tutorial = (groupCode: string, courseCode: string, courseName: string): Seed => ({
  section: 'THEORY', groupCode, courseCode, courseName, hours: { lecture: 0, tutorial: 1, practical: 0 }, credits: 1,
  components: { ese: none(), oePoe: none(), ise: none(), ica: col(['TUTORIAL', 5, 5]) },
});

const lab = (groupCode: string, courseCode: string, courseName: string, poe: number, options?: CourseOption[]): Seed => ({
  section: 'LABORATORY', groupCode, courseCode, courseName, hours: { lecture: 0, tutorial: 0, practical: 2 }, credits: 1,
  components: { ese: none(), oePoe: poe ? col(['POE', 1, poe]) : none(), ise: none(), ica: col(['PRACTICAL', 10, 2.5]) },
  ...(options ? { options } : {}),
});

/** Rows in display order, without IDs or server-derived fields. */
export function semesterSevenRows(): Seed[] {
  return [
    theoryCourse('PCC', '23ECU7CC1T', 'Internet of Things (IoT)', 2),
    theoryCourse('PCC', '23ECU7CC2T', 'Generative Artificial Intelligence', 3),
    tutorial('PCC', '23ECU7CC2A', 'Generative Artificial Intelligence (Tutorial)'),
    theoryCourse('PEC', '23ECU7EN*3T', 'Programme Elective Course IV', 3, [
      opt('23ECU7E13T', 'Electric Vehicle Technology'), opt('23ECU7E23T', 'Network Security'),
    ]),
    theoryCourse('PEC', '23ECU7EN*4T', 'Programme Elective Course V', 2, [
      opt('23ECU7E14T', 'PLC and Industrial Controllers'), opt('23ECU7E24T', 'Robotic Process Automation'),
    ]),
    {
      ...theoryCourse('MDM', '23##U7MD6T', 'Multidisciplinary Minor V', 3, [
        opt('23ITU7MD6T', 'Cyber Security', 'Information Technology'),
        opt('23MAU7MD6T', 'Thermal Systems', 'Mechanical and Automation Engineering'),
        opt('23CVU7MD6T', 'Disaster Preparedness and Planning', 'Civil Engineering'),
      ]),
      // Taught by the department that offers the minor [O-25].
      needsFaculty: false,
    },
    { ...tutorial('MDM', '23##U7MD6A', 'Multidisciplinary Minor V (Tutorial)'), needsFaculty: false },

    lab('PCC', '23ECU7CC1L', 'Internet of Things (IoT) Lab', 25),
    lab('PEC', '23ECU7EN*3L', 'Programme Elective Course IV Lab', 0, [
      opt('23ECU7E13L', 'Electric Vehicle Technology Lab'), opt('23ECU7E23L', 'Network Security Lab'),
    ]),
    lab('PEC', '23ECU7EN*4L', 'Programme Elective Course V Lab', 0, [
      opt('23ECU7E14L', 'PLC and Industrial Controllers Lab'), opt('23ECU7E24L', 'Robotic Process Automation Lab'),
    ]),
    {
      section: 'LABORATORY', groupCode: 'CAP', courseCode: '23ECU7PR5L', courseName: 'Project Phase I Lab',
      hours: { lecture: 0, tutorial: 0, practical: 8 }, credits: 4,
      components: { ese: none(), oePoe: col(['OE', 1, 50]), ise: none(), ica: col(['ACTIVITY', 4, 25]) },
    },
  ];
}


/**
 * A small demo Semester V of 2026-27, already allocated (the college's Semester V
 * table isn't in the reference set; these courses are examples). It gives the
 * faculty demo account subjects waiting to be accepted, including a laboratory
 * course whose lifecycle has no ISE or ESE paper.
 */
export function semesterFiveRows(): Seed[] {
  return [
    theoryCourse('PCC', '23ECU5CC1T', 'Digital Signal Processing', 3),
    theoryCourse('PCC', '23ECU5CC2T', 'Microcontrollers and Embedded Systems', 3),
    {
      section: 'LABORATORY', groupCode: 'PCC', courseCode: '23ECU5CC1L', courseName: 'Digital Signal Processing Lab',
      hours: { lecture: 0, tutorial: 0, practical: 2 }, credits: 1,
      components: { ese: none(), oePoe: col(['POE', 1, 25]), ise: none(), ica: col(['PRACTICAL', 5, 5]) },
    },
    {
      section: 'LABORATORY', groupCode: 'PCC', courseCode: '23ECU5CC2L', courseName: 'Microcontrollers and Embedded Systems Lab',
      hours: { lecture: 0, tutorial: 0, practical: 2 }, credits: 1,
      components: { ese: none(), oePoe: none(), ise: none(), ica: col(['PRACTICAL', 5, 5]) },
    },
  ];
}

/** The department's PSOs as the coordinator entered them (demo text). */
export const ECE_PSOS: [string, string][] = [
  ['Embedded and IoT systems', 'Design and implement embedded and IoT systems that integrate sensing, computing and communication.'],
  ['Signals and communication', 'Apply signal processing and communication principles to analyse and build electronic subsystems.'],
  ['Computing and security', 'Use modern software tools, AI and networking to develop secure, reliable solutions for industry and society.'],
];
