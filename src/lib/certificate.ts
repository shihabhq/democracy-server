import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export async function generateCertificate(
  name: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50,
      },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Certificate border
    doc.rect(40, 40, 712, 512).stroke();

    // Title
    doc
      .fontSize(48)
      .font("Helvetica-Bold")
      .text("Certificate of Completion", 150, 150, {
        align: "center",
        width: 500,
      });

    // Subtitle
    doc
      .fontSize(20)
      .font("Helvetica")
      .text("Democracy Knowledge Quiz", 150, 220, {
        align: "center",
        width: 500,
      });

    // Name
    doc.fontSize(32).font("Helvetica-Bold").text(name, 150, 300, {
      align: "center",
      width: 500,
    });

    // Description
    doc
      .fontSize(16)
      .font("Helvetica")
      .text(
        "has successfully completed the Democracy Knowledge Quiz",
        150,
        360,
        {
          align: "center",
          width: 500,
        }
      );

    doc
      .fontSize(16)
      .font("Helvetica")
      .text("with a passing score of 50% or higher.", 150, 390, {
        align: "center",
        width: 500,
      });

    // Date
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.fontSize(14).font("Helvetica").text(`Date: ${date}`, 150, 470, {
      align: "center",
      width: 500,
    });

    doc.end();

    stream.on("finish", () => {
      resolve();
    });

    stream.on("error", (error) => {
      reject(error);
    });
  });
}
