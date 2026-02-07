import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Get quiz attempts (with optional filters by district and ageGroup)
router.get("/attempts", async (req, res) => {
  try {
    const { district, ageGroup } = req.query;

    const where: { district?: string; ageGroup?: string } = {};
    if (typeof district === "string" && district) where.district = district;
    if (typeof ageGroup === "string" && ageGroup) where.ageGroup = ageGroup;

    const attempts = await prisma.quizAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        district: true,
        ageGroup: true,
        score: true,
        percentage: true,
        passed: true,
        createdAt: true,
      },
    });

    res.json(attempts);
  } catch (error) {
    console.error("Error fetching attempts:", error);
    res.status(500).json({ error: "Failed to fetch attempts" });
  }
});

// Get all questions (for admin)
router.get("/questions", async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        options: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

// Create a new question
router.post("/questions", async (req, res) => {
  try {
    const { text, explanation, options } = req.body;

    if (!text || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate that exactly one option is correct
    const correctCount = options.filter((opt: any) => opt.isCorrect).length;
    if (correctCount !== 1) {
      return res
        .status(400)
        .json({ error: "Exactly one option must be marked as correct" });
    }

    const question = await prisma.question.create({
      data: {
        text,
        explanation: explanation?.trim() || null,
        options: {
          create: options.map((opt: any) => ({
            text: opt.text,
            isCorrect: opt.isCorrect || false,
          })),
        },
      },
      include: {
        options: true,
      },
    });

    res.json(question);
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({ error: "Failed to create question" });
  }
});

// Update a question
router.put("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { text, explanation, options, isActive } = req.body;

    // If options are provided, validate and delete old ones and create new ones
    if (options && Array.isArray(options)) {
      // Validate that exactly one option is correct
      const correctCount = options.filter((opt: any) => opt.isCorrect).length;
      if (correctCount !== 1) {
        return res
          .status(400)
          .json({ error: "Exactly one option must be marked as correct" });
      }

      await prisma.option.deleteMany({
        where: { questionId: id },
      });
    }

    const question = await prisma.question.update({
      where: { id },
      data: {
        ...(text && { text }),
        ...(explanation !== undefined && {
          explanation: explanation?.trim() || null,
        }),
        ...(isActive !== undefined && { isActive }),
        ...(options && {
          options: {
            create: options.map((opt: any) => ({
              text: opt.text,
              isCorrect: opt.isCorrect || false,
            })),
          },
        }),
      },
      include: {
        options: true,
      },
    });

    res.json(question);
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({ error: "Failed to update question" });
  }
});

// Delete a question (and its options and answers that reference it)
router.delete("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction([
      prisma.answer.deleteMany({ where: { questionId: id } }),
      prisma.option.deleteMany({ where: { questionId: id } }),
      prisma.question.delete({ where: { id } }),
    ]);

    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({ error: "Failed to delete question" });
  }
});

export default router;
