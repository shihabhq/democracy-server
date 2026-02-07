import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const PAGE_WIDTH = 842; // A4 landscape
const PAGE_HEIGHT = 595;
const MARGIN = 60;
const CONTENT_WIDTH = 520;
const START_X = (PAGE_WIDTH - CONTENT_WIDTH) / 2;

export type CertificateData = {
  name: string;
  score: number;
  percentage: number;
  date: Date;
};

export async function generateCertificate(
  data: CertificateData,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Outer border (subtle)
    const borderPadding = 36;
    doc
      .lineWidth(1)
      .strokeColor("#333333")
      .rect(borderPadding, borderPadding, PAGE_WIDTH - borderPadding * 2, PAGE_HEIGHT - borderPadding * 2)
      .stroke();

    // Inner border (decorative)
    doc
      .lineWidth(0.5)
      .strokeColor("#888888")
      .rect(44, 44, PAGE_WIDTH - 88, PAGE_HEIGHT - 88)
      .stroke();

    // Vertical starting position – flow from here
    let y = 72;

    // Title – single line or two, with measured height so next block doesn’t overlap
    doc.fontSize(42).font("Helvetica-Bold").fillColor("#1a1a1a");
    const title = "Certificate of Completion";
    const titleHeight = doc.heightOfString(title, { width: CONTENT_WIDTH });
    doc.text(title, START_X, y, { align: "center", width: CONTENT_WIDTH });
    y += titleHeight + 16;

    // Subtitle – quiz name
    doc.fontSize(18).font("Helvetica").fillColor("#444444");
    const subtitle = "Democracy Knowledge Quiz";
    const subtitleHeight = doc.heightOfString(subtitle, { width: CONTENT_WIDTH });
    doc.text(subtitle, START_X, y, { align: "center", width: CONTENT_WIDTH });
    y += subtitleHeight + 40;

    // Decorative line
    const lineY = y;
    doc
      .strokeColor("#cccccc")
      .lineWidth(0.75)
      .moveTo(START_X, lineY)
      .lineTo(START_X + CONTENT_WIDTH, lineY)
      .stroke();
    y += 36;

    // Participant name
    doc.fontSize(28).font("Helvetica-Bold").fillColor("#1a1a1a");
    const nameHeight = doc.heightOfString(data.name, { width: CONTENT_WIDTH });
    doc.text(data.name, START_X, y, { align: "center", width: CONTENT_WIDTH });
    y += nameHeight + 20;

    // Completion statement (one paragraph to avoid overlap)
    doc.fontSize(15).font("Helvetica").fillColor("#333333");
    const statement =
      "has successfully completed the Democracy Knowledge Quiz with a passing score of 50% or higher.";
    const statementHeight = doc.heightOfString(statement, { width: CONTENT_WIDTH });
    doc.text(statement, START_X, y, { align: "center", width: CONTENT_WIDTH });
    y += statementHeight + 16;

    // Score line
    doc.fontSize(14).font("Helvetica").fillColor("#555555");
    const scoreText = `Score: ${data.score} (${Math.round(data.percentage)}%)`;
    const scoreHeight = doc.heightOfString(scoreText, { width: CONTENT_WIDTH });
    doc.text(scoreText, START_X, y, { align: "center", width: CONTENT_WIDTH });
    y += scoreHeight + 48;

    // Date – centered at bottom area
    const dateStr = data.date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.fontSize(12).font("Helvetica").fillColor("#666666");
    doc.text(`Date: ${dateStr}`, START_X, y, { align: "center", width: CONTENT_WIDTH });

    doc.end();

    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}
