import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { MongoClient } from "mongodb";

const app = express();
const PORT = process.env.PORT || 10000;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

app.use(cors({
  origin: FRONTEND_URL === "*" ? true : FRONTEND_URL,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "1mb" }));

let mongoClient = null;
let historyCollection = null;

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.log("MONGODB_URI not configured. History will not be saved.");
    return;
  }

  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();

    const db = mongoClient.db(process.env.MONGODB_DB || "english_assistant");
    historyCollection = db.collection("history");

    await historyCollection.createIndex({ createdAt: -1 });
    console.log("MongoDB connected.");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    historyCollection = null;
  }
}

function requireGeminiKey(res) {
  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({
      error: "GEMINI_API_KEY is not configured on the backend."
    });
    return false;
  }
  return true;
}

const ai = () => new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function generate(prompt) {
  const response = await ai().models.generateContent({
    model: MODEL,
    contents: prompt
  });

  return response.text || "";
}

app.get("/", (req, res) => {
  res.json({
    name: "AI English Speaking Assistant API",
    status: "running"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    databaseConfigured: Boolean(historyCollection)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!requireGeminiKey(res)) return;

    const { message, topic = "General English", history = [] } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const previous = Array.isArray(history)
      ? history.slice(-8).map(item =>
          `${item.role === "user" ? "Student" : "AI"}: ${String(item.text || "")}`
        ).join("\n")
      : "";

    const prompt = `
You are an English speaking practice tutor.

Topic: ${topic}

Conversation so far:
${previous || "(No previous messages)"}

Student's new message:
${message}

Reply naturally like a friendly English teacher. Keep the conversation going.
After your reply, provide a short correction section only when the student's English has a meaningful mistake.

Return JSON only in this exact structure:
{
  "reply": "natural conversational response",
  "correction": "short correction or empty string",
  "betterSentence": "improved sentence or empty string",
  "tip": "one short English-learning tip"
}
`;

    const raw = await generate(prompt);

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      result = {
        reply: raw,
        correction: "",
        betterSentence: "",
        tip: "Try to use complete sentences and speak naturally."
      };
    }

    await saveHistory("chat", { topic, message, result });

    res.json(result);
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: error.message || "Chat failed."
    });
  }
});

app.post("/api/correct", async (req, res) => {
  try {
    if (!requireGeminiKey(res)) return;

    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: "Text is required." });
    }

    const prompt = `
You are an English grammar and writing coach.

Analyze this sentence:
"${text}"

Return JSON only:
{
  "original": "original sentence",
  "corrected": "corrected sentence",
  "explanation": "simple explanation",
  "alternatives": ["natural alternative 1", "natural alternative 2"],
  "score": 0
}

Score the original from 0 to 100 for grammar and naturalness.
`;

    const raw = await generate(prompt);

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "AI returned invalid JSON.",
        details: raw
      });
    }

    await saveHistory("correction", { text, result });
    res.json(result);
  } catch (error) {
    console.error("Correction error:", error);
    res.status(500).json({
      error: error.message || "Correction failed."
    });
  }
});

app.post("/api/evaluate", async (req, res) => {
  try {
    if (!requireGeminiKey(res)) return;

    const { answer, topic = "General English" } = req.body;

    if (!answer?.trim()) {
      return res.status(400).json({ error: "Answer is required." });
    }

    const prompt = `
You are an English speaking examiner.

Topic: ${topic}
Student answer:
"${answer}"

Evaluate the answer.

Return JSON only:
{
  "overallScore": 0,
  "grammarScore": 0,
  "vocabularyScore": 0,
  "clarityScore": 0,
  "strengths": ["..."],
  "mistakes": ["..."],
  "suggestions": ["..."],
  "improvedAnswer": "..."
}

All scores must be integers from 0 to 100.
Keep feedback useful for a student.
`;

    const raw = await generate(prompt);

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "AI returned invalid JSON.",
        details: raw
      });
    }

    await saveHistory("evaluation", { topic, answer, result });
    res.json(result);
  } catch (error) {
    console.error("Evaluation error:", error);
    res.status(500).json({
      error: error.message || "Evaluation failed."
    });
  }
});

async function saveHistory(type, data) {
  if (!historyCollection) return;

  try {
    await historyCollection.insertOne({
      type,
      ...data,
      createdAt: new Date()
    });
  } catch (error) {
    console.error("History save failed:", error.message);
  }
}

app.get("/api/history", async (req, res) => {
  try {
    if (!historyCollection) {
      return res.json([]);
    }

    const items = await historyCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    res.json(items);
  } catch (error) {
    console.error("History error:", error);
    res.status(500).json({
      error: "Unable to load history."
    });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`AI English Assistant API running on port ${PORT}`);
  await connectDatabase();
});
