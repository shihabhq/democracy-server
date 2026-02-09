import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PNG dimensions are at offsets 16 (width) and 20 (height), big-endian
function getPngDimensions(imagePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(imagePath);
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length >= 24) {
        stream.destroy();
      }
    });
    stream.on("close", () => {
      const buf = Buffer.concat(chunks);
      if (buf.length < 24) {
        reject(new Error("Invalid PNG or file too small"));
        return;
      }
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      resolve({ width, height });
    });
    stream.on("error", reject);
  });
}

function getTemplateImagePath(): string {
  // Prefer server assets (e.g. democracy-server/assets/certificate/image.png)
  const serverAssets = path.join(__dirname, "../../assets/certificate/image.png");
  if (fs.existsSync(serverAssets)) return serverAssets;
  // Fallback for monorepo dev: client public folder
  // const clientPublic = path.join(__dirname, "../../../democracy-client/public/certificate/image.png");
  // if (fs.existsSync(clientPublic)) return clientPublic;
  return serverAssets; // will throw when read
}

export type CertificateData = {
  name: string;
  score: number;
  percentage: number;
  date: Date;
};

// Name is placed below "Certificate of Participation" – slightly below center of that area
const NAME_TOP_RATIO = 0.40;
const NAME_FONT_SIZE_PT = 32;
const NAME_COLOR = "#1a1a1a";

export async function generateCertificate(
  data: CertificateData,
  outputPath: string
): Promise<void> {
  const templatePath = getTemplateImagePath();
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Certificate template not found. Please copy democracy-client/public/certificate/image.png to democracy-server/assets/certificate/image.png`
    );
  }

  const { width: imgW, height: imgH } = await getPngDimensions(templatePath);
  // PDF points: 72 per inch; assume image is 96 DPI so scale factor 72/96 = 0.75
  const pageWidthPt = Math.round(imgW * 0.75);
  const pageHeightPt = Math.round(imgH * 0.75);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [pageWidthPt, pageHeightPt],
      margin: 0,
      autoFirstPage: true,
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Full-page background: certificate template image
    doc.image(templatePath, 0, 0, {
      width: pageWidthPt,
      height: pageHeightPt,
    });

    // User name below "Certificate of Participation" – centered, below the subtitle line
    const nameY = pageHeightPt * NAME_TOP_RATIO;
    const textWidth = pageWidthPt * 0.7;
    const startX = (pageWidthPt - textWidth) / 2;

    doc
      .fontSize(NAME_FONT_SIZE_PT)
      .font("Helvetica-Bold")
      .fillColor(NAME_COLOR)
      .text(data.name, startX, nameY, {
        align: "center",
        width: textWidth,
      });

    doc.end();

    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}
