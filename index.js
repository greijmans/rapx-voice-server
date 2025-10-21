// ✅ Express server voor RapX voice assistant
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

// ✅ CORS instellen zodat voice.rapx.nl toegang heeft
app.use(
  cors({
    origin: ["https://voice.rapx.nl", "http://voice.rapx.nl"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ✅ Middleware
app.use(express.json());
const upload = multer({ dest: "uploads/" });

// ✅ Test endpoint
app.get("/api/ping", (req, res) => {
  res.json({ ok: true });
});

// ✅ Transcriptie (spraak → tekst)
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const audioPath = req.file.path;

    const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: (() => {
        const form = new FormData();
        form.append("file", fs.createReadStream(audioPath));
        form.append("model", "whisper-1");
        return form;
      })(),
    });

    const data = await openaiRes.json();
    fs.unlinkSync(audioPath);

    res.json({ text: data.text || "" });
  } catch (err) {
    console.error("❌ Fout bij transcriberen:", err);
    res.status(500).json({ error: "Transcriberen mislukt" });
  }
});

// ✅ Herschrijven (AI herschrijft korte input tot nette zin)
app.post("/api/rewrite", async (req, res) => {
  try {
    const { kopje, raw } = req.body;

    const prompt = `
Je bent een verzekeringsinspecteur. Zet de volgende korte notitie om in een volledige nette zin.
Onderwerp: ${kopje}.
Notitie: "${raw}".
`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await openaiRes.json();
    const tekst = data.choices?.[0]?.message?.content?.trim() || raw;
    res.json({ text: tekst });
  } catch (err) {
    console.error("❌ Fout bij rewrite:", err);
    res.status(500).json({ error: "Herschrijven mislukt" });
  }
});

// ✅ Server starten
app.listen(PORT, () => console.log(`🚀 RapX voice server draait op poort ${PORT}`));
