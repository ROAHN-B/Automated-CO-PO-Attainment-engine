package com.copo.attainment_engine.workspace.qp;

import com.copo.attainment_engine.workspace.Offering;
import com.copo.attainment_engine.workspace.cam.CamDocs;
import com.lowagie.text.Chunk;
import com.lowagie.text.Element;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * The college's ISE "Question Paper Moderation Sheet" (API_CONTRACT §10.7.7), one A4 page
 * as .docx or .pdf with the same content. Only the paper setter's part is filled:
 * the moderator's part, their names and the moderation date stay blank for the hand-written moderation.
 */
public final class ModerationSheet {

    private ModerationSheet() {}

    private static final String[] ROMAN = {"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"};
    private static final String[] YEAR = {"First Year", "Second Year", "Third Year", "Final Year"};
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH).withZone(ZoneId.of("Asia/Kolkata"));
    private static final String INSTITUTION = "Walchand Institute of Technology, Solapur";

    /** What the sheet shows, computed once for both formats. */
    record Model(String[] title, String iseNo, String course, String classSemester, String courseCode,
                 List<String[]> scheme, String questionCount, String submittedOn, List<String> rows, String setter) {}

    static Model model(Offering o, QpDocs.Paper paper, String assessmentName, List<CamDocs.CourseOutcome> cos) {
        Map<String, String> code = cos.stream().collect(Collectors.toMap(c -> c.coId, c -> c.code));
        int sem = o.semester.semesterNumber;
        String parity = sem % 2 == 1 ? "Odd" : "Even";
        String[] title = {INSTITUTION, o.departmentName + ", " + parity + " Semester, " + o.academicYear.name,
                "In Semester Examination Test Question Paper Moderation Sheet"};

        Matcher m = Pattern.compile("(\\d+)").matcher(assessmentName);
        String iseNo = m.find() ? roman(Integer.parseInt(m.group(1))) : "";

        List<String[]> scheme = new ArrayList<>();   // {q, co, marks} per main question
        List<String> rows = new ArrayList<>();
        for (QpDocs.Question q : paper.questions) {
            List<QpDocs.Flat> subs = QpDocs.flatten(q);
            Set<String> coNumbers = new LinkedHashSet<>();
            for (QpDocs.Flat f : subs) {
                String c = code.get(f.coId());
                if (c != null) coNumbers.add(c.replaceFirst("(?i)^co\\s*", ""));
            }
            scheme.add(new String[]{qNumber(q.questionNo), String.join(", ", coNumbers), PaperRules.fmt(PaperRules.questionMarks(q))});
            // Table 2 rows: "Q 1-i"; the part letter only when sub-question labels repeat across parts.
            List<String> labels = subs.stream().map(f -> f.sub().label.trim().toLowerCase(Locale.ROOT)).toList();
            boolean unique = new LinkedHashSet<>(labels).size() == labels.size();
            for (QpDocs.Flat f : subs) {
                rows.add("Q " + qNumber(q.questionNo) + "-" + (f.part() != null && !unique ? f.part().label + "-" : "") + f.sub().label);
            }
        }
        String year = YEAR[Math.max(0, Math.min(3, (sem + 1) / 2 - 1))];
        String setter = o.courseCoordinator != null ? o.courseCoordinator.fullName : "";
        return new Model(title, iseNo, o.course.courseName, year + " - " + roman(sem), o.course.courseCode, scheme,
                String.format("%02d", scheme.size()), date(paper.finalizedAt), rows, setter);
    }

    /* ---------------------------------- DOCX ---------------------------------- */

    static byte[] docx(Model s) {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFParagraph title = doc.createParagraph();
            title.setAlignment(ParagraphAlignment.CENTER);
            for (int i = 0; i < s.title().length; i++) {
                XWPFRun r = title.createRun();
                r.setBold(true);
                r.setFontFamily("Times New Roman");
                r.setFontSize(13);
                r.setText(s.title()[i]);
                if (i < s.title().length - 1) r.addBreak();
            }

            heading(doc, "Self-Assessment by Paper Setter");
            XWPFTable t1 = doc.createTable(4, 4);
            fill(t1, 0, "1", "ISE Test: I / II / III : " + s.iseNo(), "2", "Course: " + s.course());
            fill(t1, 1, "3", "Class and Semester: " + s.classSemester(), "4", "Course Code: " + s.courseCode());
            fill(t1, 2, "6", "Total number of Questions: " + s.questionCount(), "7", "Date of Submission of Question Paper: " + s.submittedOn());
            fill(t1, 3, "8", "Date of Moderation:", "", "");

            text(doc, "5  Marking Scheme:");
            int cols = Math.max(6, s.scheme().size());
            XWPFTable scheme = doc.createTable(3, cols + 1);
            String[] heads = {"Q. No.", "CO", "Marks"};
            for (int r = 0; r < 3; r++) {
                set(scheme.getRow(r).getCell(0), heads[r], true);
                for (int c = 0; c < cols; c++) set(scheme.getRow(r).getCell(c + 1), c < s.scheme().size() ? s.scheme().get(c)[r] : "", false);
            }

            heading(doc, "Assessment by Subject Expert/Moderator");
            XWPFTable t2 = doc.createTable(s.rows().size() + 1, 2);
            set(t2.getRow(0).getCell(0), "Question No.", true);
            set(t2.getRow(0).getCell(1), "IS mapping of question is appropriate with CO? [Mark Yes / No / Suggestion]", true);
            for (int i = 0; i < s.rows().size(); i++) set(t2.getRow(i + 1).getCell(0), s.rows().get(i), false);

            XWPFTable notes = doc.createTable(3, 1);
            String[] labels = {"Corrections, if any:", "Suggestions, if any:", "Incorporation of suggestions:"};
            for (int i = 0; i < 3; i++) {
                XWPFTableCell cell = notes.getRow(i).getCell(0);
                set(cell, labels[i], false);
                cell.addParagraph();
                cell.addParagraph();
            }

            text(doc, "");
            XWPFTable sign = doc.createTable(1, 2);
            set(sign.getRow(0).getCell(0), s.setter(), false);
            sign.getRow(0).getCell(0).addParagraph().createRun().setText("Name and Signature of Question Paper Setter");
            set(sign.getRow(0).getCell(1), "", false);
            sign.getRow(0).getCell(1).addParagraph().createRun().setText("Name and Signature of Subject Experts/Moderators");

            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Couldn't build the moderation sheet", e);
        }
    }

    private static void heading(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        p.setSpacingBefore(200);
        XWPFRun r = p.createRun();
        r.setBold(true);
        r.setFontFamily("Times New Roman");
        r.setText(text);
    }

    private static void text(XWPFDocument doc, String text) {
        XWPFRun r = doc.createParagraph().createRun();
        r.setFontFamily("Times New Roman");
        r.setText(text);
    }

    private static void fill(XWPFTable t, int row, String... cells) {
        XWPFTableRow r = t.getRow(row);
        for (int i = 0; i < cells.length; i++) set(r.getCell(i), cells[i], false);
    }

    private static void set(XWPFTableCell cell, String text, boolean bold) {
        XWPFParagraph p = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphs().getFirst();
        XWPFRun r = p.createRun();
        r.setFontFamily("Times New Roman");
        r.setFontSize(11);
        r.setBold(bold);
        r.setText(text == null ? "" : text);
    }

    /* ---------------------------------- PDF ---------------------------------- */

    static byte[] pdf(Model s) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        com.lowagie.text.Document doc = new com.lowagie.text.Document(PageSize.A4, 42, 42, 46, 46);
        PdfWriter.getInstance(doc, out);
        doc.open();
        com.lowagie.text.Font bold = new com.lowagie.text.Font(com.lowagie.text.Font.TIMES_ROMAN, 12, com.lowagie.text.Font.BOLD);
        com.lowagie.text.Font body = new com.lowagie.text.Font(com.lowagie.text.Font.TIMES_ROMAN, 10.5f);
        com.lowagie.text.Font bodyBold = new com.lowagie.text.Font(com.lowagie.text.Font.TIMES_ROMAN, 10.5f, com.lowagie.text.Font.BOLD);

        Paragraph title = new Paragraph(String.join("\n", s.title()), bold);
        title.setAlignment(Element.ALIGN_CENTER);
        doc.add(title);

        PdfPTable t1 = table(new float[]{1, 9, 1, 9});
        headRow(t1, "Self-Assessment by Paper Setter", 4, bodyBold);
        row(t1, body, "1", "ISE Test: I / II / III : " + s.iseNo(), "2", "Course: " + s.course());
        row(t1, body, "3", "Class and Semester: " + s.classSemester(), "4", "Course Code: " + s.courseCode());
        PdfPCell five = cell("5", body);
        t1.addCell(five);
        int cols = Math.max(6, s.scheme().size());
        float[] widths = new float[cols + 1];
        widths[0] = 2.2f;
        for (int i = 1; i <= cols; i++) widths[i] = 1;
        PdfPTable scheme = table(widths);
        String[] heads = {"Q. No.", "CO", "Marks"};
        for (int r = 0; r < 3; r++) {
            scheme.addCell(cell(heads[r], body));
            for (int c = 0; c < cols; c++) {
                PdfPCell x = cell(c < s.scheme().size() ? s.scheme().get(c)[r] : "", body);
                x.setHorizontalAlignment(Element.ALIGN_CENTER);
                scheme.addCell(x);
            }
        }
        PdfPCell schemeCell = new PdfPCell();
        schemeCell.addElement(new Phrase("Marking Scheme:", body));
        schemeCell.addElement(scheme);
        t1.addCell(schemeCell);
        PdfPCell right = new PdfPCell();
        right.setColspan(2);
        right.addElement(new Phrase("6  Total number of Questions: " + s.questionCount(), body));
        right.addElement(new Phrase("\n7  Date of Submission of Question Paper: " + s.submittedOn(), body));
        right.addElement(new Phrase("\n8  Date of Moderation:", body));
        t1.addCell(right);
        doc.add(t1);

        PdfPTable t2 = table(new float[]{1, 3, 5, 1, 9});
        headRow(t2, "Assessment by Subject Expert/Moderator", 5, bodyBold);
        PdfPCell one = cell("1", body);
        one.setRowspan(s.rows().size() + 1);
        t2.addCell(one);
        t2.addCell(cell("Question No.", body));
        t2.addCell(cell("IS mapping of question is appropriate with CO? [Mark Yes / No / Suggestion]", body));
        PdfPCell two = cell("2", body);
        two.setRowspan(s.rows().size() + 1);
        t2.addCell(two);
        PdfPCell notes = cell("Corrections, if any:\n\n\n\n\nSuggestions, if any:\n\n\n\n\nIncorporation of suggestions:", body);
        notes.setRowspan(s.rows().size() + 1);
        t2.addCell(notes);
        for (String r : s.rows()) {
            PdfPCell q = cell(r, body);
            q.setHorizontalAlignment(Element.ALIGN_CENTER);
            t2.addCell(q);
            t2.addCell(cell("", body));
        }
        doc.add(t2);

        PdfPTable sign = table(new float[]{1, 1});
        sign.setSpacingBefore(30);
        PdfPCell setter = new PdfPCell(new Phrase(s.setter() + "\nName and Signature of\nQuestion Paper Setter", body));
        PdfPCell moderator = new PdfPCell(new Phrase("\nName and Signature of\nSubject Experts/Moderators", body));
        setter.setBorder(0);
        moderator.setBorder(0);
        sign.addCell(setter);
        sign.addCell(moderator);
        doc.add(sign);
        doc.add(new Chunk(""));
        doc.close();
        return out.toByteArray();
    }

    private static PdfPTable table(float[] widths) {
        PdfPTable t = new PdfPTable(widths);
        t.setWidthPercentage(100);
        t.setSpacingBefore(10);
        return t;
    }

    private static void headRow(PdfPTable t, String text, int span, com.lowagie.text.Font font) {
        PdfPCell c = cell(text, font);
        c.setColspan(span);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        t.addCell(c);
    }

    private static void row(PdfPTable t, com.lowagie.text.Font font, String... cells) {
        for (String c : cells) t.addCell(cell(c, font));
    }

    private static PdfPCell cell(String text, com.lowagie.text.Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text == null ? "" : text, font));
        c.setPadding(4);
        return c;
    }

    /* --------------------------------- helpers --------------------------------- */

    private static String roman(int n) {
        return n >= 0 && n < ROMAN.length ? ROMAN[n] : String.valueOf(n);
    }

    private static String qNumber(String questionNo) {
        return questionNo == null ? "" : questionNo.replaceFirst("(?i)^q\\s*", "");
    }

    private static String date(Instant at) {
        return at == null ? "" : DATE.format(at);
    }
}
