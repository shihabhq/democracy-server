import express from "express";
import prisma from "../lib/prisma.js";
import { generateCertificateToBuffer } from "../lib/certificate.js";
import { uploadCertificateToSupabase, isSupabaseStorageConfigured } from "../lib/supabase.js";

const router = express.Router();

function isUrl(pathOrUrl: string): boolean {
  return pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
}

// Debug: verify template accessibility
router.get("/check", async (req, res) => {
  const TEMPLATE_URL = "https://ik.imagekit.io/bua2b1x6j/kashful/image.png";
  try {
    const fetchRes = await fetch(TEMPLATE_URL, { method: "HEAD" });
    res.json({
      url: TEMPLATE_URL,
      ok: fetchRes.ok,
      status: fetchRes.status,
      message: fetchRes.ok
        ? "Remote template is accessible."
        : "Failed to access remote template.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.json({
      url: TEMPLATE_URL,
      ok: false,
      error: msg,
      message: "Error fetching remote template.",
    });
  }
});

// Preview certificate without a quiz attempt (e.g. ?name=Your Name)
router.get("/preview", async (req, res) => {
  try {
    const name = (req.query.name as string) || "Preview Name";
    const pdfBuffer = await generateCertificateToBuffer({
      name,
      score: 20,
      percentage: 100,
      date: new Date(),
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="certificate-preview.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating certificate preview:", error);
    res.status(500).json({
      error: "Failed to generate certificate preview",
      details: message,
    });
  }
});

// Generate and download certificate (uploads to Supabase)
router.get("/:attemptId", async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { certificate: true },
    });

    if (!attempt) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

    if (!attempt.passed) {
      return res
        .status(400)
        .json({ error: "Certificate only available for passing scores" });
    }

    // Force Supabase usage
    if (!isSupabaseStorageConfigured()) {
      console.error("Supabase is NOT configured. Cannot generate/host certificate.");
      return res.status(500).json({ 
        error: "Server storage configuration missing. Cannot generate certificate." 
      });
    }

    // If we already have a URL, redirect to it
    const existingUrl = attempt.certificate?.filePath;
    if (existingUrl && isUrl(existingUrl)) {
      return res.redirect(302, existingUrl);
    }
    
    // Generate to memory
    const pdfBuffer = await generateCertificateToBuffer({
      name: attempt.name,
      score: attempt.score,
      percentage: attempt.percentage,
      date: attempt.createdAt,
    });

    // Upload
    const publicUrl = await uploadCertificateToSupabase(attemptId, pdfBuffer);
    if (!publicUrl) {
      throw new Error("Supabase upload returned no URL");
    }

    // Save/Update DB
    if (attempt.certificate) {
      await prisma.certificate.update({
        where: { attemptId: attempt.id },
        data: { filePath: publicUrl },
      });
    } else {
      await prisma.certificate.create({
        data: { attemptId: attempt.id, filePath: publicUrl },
      });
    }

    return res.redirect(302, publicUrl);

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message;
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
