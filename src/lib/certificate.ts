import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PNG dimensions are at offsets 16 (width) and 20 (height), big-endian
function getPngDimensions(imagePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(imagePath, { start: 0, end: 23 });
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    stream.on("end", () => {
      const buf = Buffer.concat(chunks);
      if (buf.length < 24) {
        reject(new Error(`Invalid PNG or file too small (got ${buf.length} bytes)`));
        return;
      }
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      resolve({ width, height });
    });
    stream.on("error", reject);
  });
}

/** Only source: democracy-server/assets/certificate/image.png (relative to this file). */
function getTemplateImagePath(): string {
  const templatePath = path.join(__dirname, "../../assets/certificate/image.png");
  const resolved = path.resolve(templatePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Certificate template not found at: ${resolved}`);
  }
  return resolved;
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
  let templatePathResolved: string;
  try {
    templatePathResolved = getTemplateImagePath();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Template: ${msg}`);
  }

  let imgW: number;
  let imgH: number;
  try {
    const dims = await getPngDimensions(templatePathResolved);
    imgW = dims.width;
    imgH = dims.height;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`PNG dimensions: ${msg}`);
  }
  if (!imgW || !imgH || imgW > 10000 || imgH > 10000) {
    throw new Error(
      `Invalid PNG dimensions: ${imgW}x${imgH}. File may not be a valid PNG.`
    );
  }
  // PDF points: 72 per inch; assume image is 96 DPI so scale factor 72/96 = 0.75
  const pageWidthPt = Math.round(imgW * 0.75);
  const pageHeightPt = Math.round(imgH * 0.75);

  const outputPathResolved = path.resolve(outputPath);
  const outputDir = path.dirname(outputPathResolved);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [pageWidthPt, pageHeightPt],
      margin: 0,
      autoFirstPage: true,
    });

    const stream = fs.createWriteStream(outputPathResolved);
    doc.pipe(stream);

    try {
      // Full-page background: certificate template image (use resolved path for Windows)
      doc.image(templatePathResolved, 0, 0, {
        width: pageWidthPt,
        height: pageHeightPt,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      reject(new Error(`PDF image: ${msg}`));
      return;
    }

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
    stream.on("error", (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      reject(new Error(`PDF write: ${msg}`));
    });
  });
}
