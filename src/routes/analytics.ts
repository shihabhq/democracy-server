import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Get analytics
router.get("/", async (req, res) => {
  try {
    // Total quiz attempts
    const totalAttempts = await prisma.quizAttempt.count();

    // Passed and failed counts
    const passedCount = await prisma.quizAttempt.count({
      where: { passed: true },
    });
    const failedCount = await prisma.quizAttempt.count({
      where: { passed: false },
    });

    // Average score
    const avgScoreResult = await prisma.quizAttempt.aggregate({
      _avg: {
        percentage: true,
      },
    });
    const averageScore = avgScoreResult._avg.percentage || 0;

    // Total certificates downloaded
    const totalCertificates = await prisma.certificate.count();

    // Total questions answered
    const totalAnswers = await prisma.answer.count();

    // Question difficulty analysis
    const allAnswers = await prisma.answer.findMany({
      select: {
        questionId: true,
        isCorrect: true,
      },
    });

    // Group by questionId and calculate stats
    const questionStatsMap = new Map<
      string,
      { total: number; correct: number }
    >();

    for (const answer of allAnswers) {
      const existing = questionStatsMap.get(answer.questionId) || {
        total: 0,
        correct: 0,
      };
      existing.total++;
      if (answer.isCorrect) {
        existing.correct++;
      }
      questionStatsMap.set(answer.questionId, existing);
    }

    // Get question details and calculate success rate
    const questionDetails = await Promise.all(
      Array.from(questionStatsMap.entries()).map(
        async ([questionId, stats]) => {
          const question = await prisma.question.findUnique({
            where: { id: questionId },
            select: { id: true, text: true },
          });

          const totalAnswers = stats.total;
          const correctAnswers = stats.correct;
          const successRate =
            totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;

          return {
            questionId,
            text: question?.text || "Unknown",
            totalAnswers,
            correctAnswers,
            successRate,
          };
        }
      )
    );

    // Sort by success rate to find easiest and toughest
    const sortedBySuccess = [...questionDetails].sort(
      (a, b) => a.successRate - b.successRate
    );

    const toughestQuestions = sortedBySuccess.slice(0, 10).reverse(); // Lowest success rate first
    const easiestQuestions = sortedBySuccess.slice(-10).reverse(); // Highest success rate first

    // Stats by district
    const attemptsByDistrict = await prisma.quizAttempt.groupBy({
      by: ["district"],
      _count: { id: true },
      _sum: { score: true },
      _avg: { percentage: true },
    });
    const passedByDistrict = await prisma.quizAttempt.groupBy({
      by: ["district"],
      where: { passed: true },
      _count: { id: true },
    });
    const passedByDistrictMap = new Map(
      passedByDistrict.map((p) => [p.district, p._count.id])
    );
    const statsByDistrict = attemptsByDistrict.map((row) => ({
      district: row.district,
      totalAttempts: row._count.id,
      passedCount: passedByDistrictMap.get(row.district) ?? 0,
      averageScore: Math.round((row._avg.percentage ?? 0) * 100) / 100,
    }));

    // Stats by age group
    const attemptsByAgeGroup = await prisma.quizAttempt.groupBy({
      by: ["ageGroup"],
      _count: { id: true },
      _avg: { percentage: true },
    });
    const passedByAgeGroup = await prisma.quizAttempt.groupBy({
      by: ["ageGroup"],
      where: { passed: true },
      _count: { id: true },
    });
    const passedByAgeGroupMap = new Map(
      passedByAgeGroup.map((p) => [p.ageGroup, p._count.id])
    );
    const statsByAgeGroup = attemptsByAgeGroup.map((row) => ({
      ageGroup: row.ageGroup,
      totalAttempts: row._count.id,
      passedCount: passedByAgeGroupMap.get(row.ageGroup) ?? 0,
      averageScore: Math.round((row._avg.percentage ?? 0) * 100) / 100,
    }));

    res.json({
      totalAttempts,
      passedCount,
      failedCount,
      averageScore: Math.round(averageScore * 100) / 100,
      totalCertificates,
      totalAnswers,
      toughestQuestions,
      easiestQuestions,
      statsByDistrict,
      statsByAgeGroup,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res
      .status(500)
      .json({ error: "Failed to fetch analytics", details: errorMessage });
  }
});

export default router;
