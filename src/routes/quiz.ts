import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Get 20 random questions for quiz
router.get("/questions", async (req, res) => {
  try {
    const allQuestions = await prisma.question.findMany({
      where: {
        isActive: true,
      },
      include: {
        options: true,
      },
    });

    // Randomize and take 20
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, 20);

    // Remove isCorrect flag from options before sending to client
    // Also shuffle the options for each question
    const questionsWithoutAnswers = questions.map((q) => {
      const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
      return {
        id: q.id,
        text: q.text,
        options: shuffledOptions.map((opt) => ({
          id: opt.id,
          text: opt.text,
        })),
      };
    });

    res.json(questionsWithoutAnswers);
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

const AGE_GROUPS = ["18-25", "26-40", "41-50", "50+"] as const;
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;

// Submit quiz attempt
router.post("/attempt", async (req, res) => {
  try {
    const { name, district, ageGroup, gender, answers } = req.body;

    if (!name || !district || !ageGroup || !gender || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!AGE_GROUPS.includes(ageGroup)) {
      return res
        .status(400)
        .json({ error: "Invalid age group. Must be one of: 18-25, 26-40, 41-50, 50+" });
    }

    if (!GENDERS.includes(gender)) {
      return res
        .status(400)
        .json({ error: "Invalid gender. Must be one of: Male, Female, Other, Prefer not to say" });
    }

    // Validate that we have 20 answers
    if (answers.length !== 20) {
      return res
        .status(400)
        .json({ error: "Must answer exactly 20 questions" });
    }

    // Calculate score
    let correctCount = 0;
    const answerRecords = [];

    for (const answer of answers) {
      const { questionId, optionId } = answer;

      // Get the option to check if it's correct
      const option = await prisma.option.findUnique({
        where: { id: optionId },
        include: { question: true },
      });

      if (!option || option.questionId !== questionId) {
        return res.status(400).json({ error: "Invalid option for question" });
      }

      const isCorrect = option.isCorrect;
      if (isCorrect) correctCount++;

      answerRecords.push({
        questionId,
        optionId,
        isCorrect,
      });
    }

    const score = correctCount;
    const percentage = (score / 20) * 100;
    const passed = percentage >= 50;

    // Create quiz attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        name,
        district,
        ageGroup,
        gender,
        score,
        percentage,
        passed,
        answers: {
          create: answerRecords,
        },
      },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    res.json({
      id: attempt.id,
      score,
      percentage,
      passed,
    });
  } catch (error) {
    console.error("Error submitting quiz attempt:", error);
    res.status(500).json({ error: "Failed to submit quiz attempt" });
  }
});

// Get quiz attempt results with answers
router.get("/attempt/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
        certificate: true,
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

    // Format the response with question details and explanations
    const results = await Promise.all(
      attempt.answers.map(async (answer) => {
        const selectedOption = await prisma.option.findUnique({
          where: { id: answer.optionId },
        });
        const correctOption = answer.question.options.find(
          (opt) => opt.isCorrect
        );
        return {
          question: {
            id: answer.question.id,
            text: answer.question.text,
            explanation: answer.question.explanation,
          },
          selectedOption: selectedOption
            ? {
                id: selectedOption.id,
                text: selectedOption.text,
              }
            : null,
          correctOption: correctOption
            ? {
                id: correctOption.id,
                text: correctOption.text,
              }
            : null,
          isCorrect: answer.isCorrect,
        };
      })
    );

    res.json({
      id: attempt.id,
      name: attempt.name,
      district: attempt.district,
      ageGroup: attempt.ageGroup,
      gender: attempt.gender,
      score: attempt.score,
      percentage: attempt.percentage,
      passed: attempt.passed,
      createdAt: attempt.createdAt,
      results,
      hasCertificate: !!attempt.certificate,
    });
  } catch (error) {
    console.error("Error fetching quiz attempt:", error);
    res.status(500).json({ error: "Failed to fetch quiz attempt" });
  }
});

export default router;
