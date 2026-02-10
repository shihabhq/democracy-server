import PDFDocument from "pdfkit";

const TEMPLATE_URL = "https://ik.imagekit.io/bua2b1x6j/kashful/image.png";

// PNG dimensions are at offsets 16 (width) and 20 (height), big-endian
function getPngDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 24) {
    throw new Error(`Invalid PNG or buffer too small (got ${buffer.length} bytes)`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

async function fetchTemplateImage(): Promise<Buffer> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch template image: ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

/** Generate certificate PDF into an in-memory buffer (for upload to Supabase etc.). */
export async function generateCertificateToBuffer(data: CertificateData): Promise<Buffer> {


  let templateBuffer: Buffer;
  try {
    templateBuffer = await fetchTemplateImage();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Template fetch failed: ${msg}`);
  }

  const dims = getPngDimensions(templateBuffer);
  const { width: imgW, height: imgH } = dims;
  if (!imgW || !imgH || imgW > 10000 || imgH > 10000) {
    throw new Error(`Invalid PNG dimensions: ${imgW}x${imgH}. File may not be a valid PNG.`);
  }
  const pageWidthPt = Math.round(imgW * 0.75);
  const pageHeightPt = Math.round(imgH * 0.75);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [pageWidthPt, pageHeightPt],
      margin: 0,
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      doc.image(templateBuffer, 0, 0, {
        width: pageWidthPt,
        height: pageHeightPt,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      reject(new Error(`PDF image error: ${msg}`));
      return;
    }

    const nameY = pageHeightPt * NAME_TOP_RATIO;
    const textWidth = pageWidthPt * 0.7;
    const startX = (pageWidthPt - textWidth) / 2;
    doc
      .fontSize(NAME_FONT_SIZE_PT)
      .font("Helvetica-Bold")
      .fillColor(NAME_COLOR)
      .text(data.name, startX, nameY, { align: "center", width: textWidth });

    doc.end();
  });
}
