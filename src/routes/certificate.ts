import express from "express";
import prisma from "../lib/prisma.js";
import { generateCertificate } from "../lib/certificate.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Generate and download certificate
router.get("/:attemptId", async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        certificate: true,
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

    if (!attempt.passed) {
      return res
        .status(400)
        .json({ error: "Certificate only available for passing scores" });
    }

    // Check if certificate already exists
    let certificatePath = attempt.certificate?.filePath;

    if (!certificatePath) {
      // Generate certificate
      const certificatesDir = path.join(__dirname, "../../certificates");
      await fs.mkdir(certificatesDir, { recursive: true });

      certificatePath = path.join(certificatesDir, `${attemptId}.pdf`);
      await generateCertificate(attempt.name, certificatePath);

      // Save certificate path to database
      await prisma.certificate.create({
        data: {
          attemptId: attempt.id,
          filePath: certificatePath,
        },
      });
    }

    // Send the PDF file
    res.sendFile(path.resolve(certificatePath));
  } catch (error) {
    console.error("Error generating certificate:", error);
    res.status(500).json({ error: "Failed to generate certificate" });
  }
});

export default router;
