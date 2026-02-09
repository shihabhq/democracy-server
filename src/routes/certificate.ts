import express from "express";
import prisma from "../lib/prisma.js";
import { generateCertificate } from "../lib/certificate.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Debug: verify template path (open http://localhost:5000/api/certificate/check in browser)
router.get("/check", (req, res) => {
  const templatePath = path.resolve(path.join(__dirname, "../../assets/certificate/image.png"));
  const exists = existsSync(templatePath);
  res.json({
    templatePath,
    exists,
    message: exists ? "Template found." : "Template NOT found. Put image.png in democracy-server/assets/certificate/",
  });
});

// Preview certificate without a quiz attempt (e.g. ?name=Your Name)
router.get("/preview", async (req, res) => {
  try {
    const name = (req.query.name as string) || "Preview Name";
    const certificatesDir = path.join(__dirname, "../../certificates");
    await fs.mkdir(certificatesDir, { recursive: true });
    const certificatePath = path.join(certificatesDir, `preview-${Date.now()}.pdf`);
    await generateCertificate(
      {
        name,
        score: 20,
        percentage: 100,
        date: new Date(),
      },
      certificatePath
    );
    res.setHeader("Content-Disposition", `inline; filename="certificate-preview.pdf"`);
    res.sendFile(path.resolve(certificatePath), (err) => {
      fs.unlink(certificatePath).catch(() => {});
      if (err) res.status(500).json({ error: "Failed to send certificate" });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating certificate preview:", error);
    res.status(500).json({
      error: "Failed to generate certificate preview",
      details: message,
    });
  }
});

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

    const certificatesDir = path.join(__dirname, "../../certificates");
    await fs.mkdir(certificatesDir, { recursive: true });
    console.log(certificatePath)

    if (!certificatePath) {
      certificatePath = path.join(certificatesDir, `${attemptId}.pdf`);
      await generateCertificate(
        {
          name: attempt.name,
          score: attempt.score,
          percentage: attempt.percentage,
          date: attempt.createdAt,
        },
        certificatePath
      );
      await prisma.certificate.create({
        data: {
          attemptId: attempt.id,
          filePath: certificatePath,
        },
      });
    } else {
      // If record exists but file is missing (e.g. after deploy), regenerate
      try {
        await fs.access(certificatePath);
      } catch {
        certificatePath = path.join(certificatesDir, `${attemptId}.pdf`);
        await generateCertificate(
          {
            name: attempt.name,
            score: attempt.score,
            percentage: attempt.percentage,
            date: attempt.createdAt,
          },
          certificatePath
        );
        await prisma.certificate.update({
          where: { attemptId: attempt.id },
          data: { filePath: certificatePath },
        });
      }
    }

    const absolutePath = path.resolve(certificatePath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificate.pdf"`);
    res.sendFile(absolutePath);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message;
    console.log(error)
    // Always show the real error in the response body (so you see it in the browser)
    const errorText = `Failed to generate certificate: ${message}`;
    console.error("\n[CERTIFICATE ERROR]", errorText);
    if (err.stack) console.error(err.stack);
    res.status(500).json({
      error: errorText,
      details: message,
    });
  }
});

export default router;
