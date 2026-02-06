import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

//routes
import quizRoutes from "./routes/quiz.js";
import certificateRoutes from "./routes/certificate.js";
import analyticsRoutes from "./routes/analytics.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();

app.use(
  cors({
      origin: [
      "https://www.votekori.cloud",
      "https://admin.votekori.cloud",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Server is running 🚀" });
});

app.use("/api/quiz", quizRoutes);
app.use("/api/certificate", certificateRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
