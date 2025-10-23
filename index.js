import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 10000;

// 🧠 Initialiseer OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 🌍 Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 📁 Zorg dat uploads-map bestaat
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("📁 Map 'uploads' aangemaakt");
}

// 📦 Configureer multer (voor audio-upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ✅ Testroute
app.get("/", (req, res) => {
  res.json({ ok: true, message: "RapX Voice Server actief" });
});

// 🎧 Route: audio upload + transcriptie
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ Geen audiobestand ontvangen");
      return res.status(400).json({ error: "Geen audiobestand ontvangen" });
    }

    const audioPath = req.file.path;
    console.log("🎧 Ontvangen audio:", audioPath);

    // 📡 Verstuur naar Whisper
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1"
    });

    console.log("✅ Whisper antwoord:", transcript.text);

    // 📤 Verwijder tijdelijk bestand
    fs.unlink(audioPath, err => {
      if (err) console.warn("⚠️ Kon tijdelijk bestand niet verwijderen:", err);
    });

    // ✅ Stuur terug naar frontend
    res.json({ text: transcript.text });

  } catch (error) {
    console.error("❌ Transcribe-fout:", error);
    res.status(500).json({ error: "Transcribe-fout", detail: error.message });
  }
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`🚀 RapX Voice Server actief op poort ${port}`);
});
