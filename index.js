// index.js — RapX Voice Server (stabiele versie)
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 📁 uploads-map aanmaken
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("📁 Map 'uploads' aangemaakt");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}.webm`)
});
const upload = multer({ storage });

app.get("/", (_req, res) => res.json({ ok: true, service: "RapX Voice Server" }));

// 🎧 transcriptie
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Geen audio" });
    const filePath = req.file.path;
    console.log("🎧 Ontvangen audio:", filePath);

    const tr = await openai.audio.transcriptions.create({
      model: "whisper-1",        // ← originele, stabiele versie
      file: fs.createReadStream(filePath),
      language: "nl"
    });

    fs.unlink(filePath, () => {});
    console.log("✅ Whisper:", tr.text);
    res.json({ text: tr.text });
  } catch (err) {
    console.error("❌ Transcribe-fout:", err);
    res.status(500).json({ error: "Transcribe-fout", detail: String(err?.message || err) });
  }
});

// ✏️ rewrite — grammatica, “maatregel”-regel
app.post("/api/rewrite", async (req, res) => {
  try {
    const raw = String(req.body?.raw || "").trim();
    if (!raw) return res.json({ text: "" });

    const sys = `Je bent een Nederlandse taalcorrector voor inspectierapporten.
- Corrigeer alleen grammatica, spelling en hoofdletters.
- Geen interpretatie of inhoudelijke toevoeging.
- Maak korte, correcte zinnen.
- Als het woord 'maatregel' voorkomt, eindig met: "Maatregel opgenomen."`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: raw }
      ]
    });

    let text = resp.choices?.[0]?.message?.content?.trim() || raw;

    if (/\bmaatregel(en)?\b/i.test(raw) && !/Maatregel opgenomen\./i.test(text)) {
      if (!/[.!?]$/.test(text)) text += ".";
      text += " Maatregel opgenomen.";
    }

    res.json({ text });
  } catch (err) {
    console.error("❌ Rewrite-fout:", err);
    res.status(500).json({ error: "Rewrite-fout", detail: String(err?.message || err) });
  }
});

app.listen(PORT, () => console.log(`🚀 RapX Voice Server actief op poort ${PORT}`));
