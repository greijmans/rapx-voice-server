import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🔹 Multer opslag
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + ".webm")
});
const upload = multer({ storage });

// 🔹 Whisper transcriptie + lichte taalcorrectie
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "nl"
    });

    let text = transcription.text.trim();

    // 🔸 Alleen grammaticale correctie, geen interpretatie
    const grammarFix = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Je bent een taalcorrector. Corrigeer alleen grammatica, hoofdletters en leestekens in Nederlandse tekst.
Voeg geen betekenis toe, verzin geen context, en gebruik geen uitleg.
Als het woord 'maatregel' voorkomt, eindig de zin met 'Maatregel opgenomen.'
Alleen verbeter de bestaande tekst — geen interpretatie of toevoeging.
`
        },
        { role: "user", content: text }
      ],
      temperature: 0
    });

    const corrected = grammarFix.choices[0].message.content.trim();

    fs.unlink(filePath, () => {}); // bestand opruimen
    res.json({ text: corrected });
  } catch (error) {
    console.error("Transcribe-fout:", error);
    res.status(500).json({ error: "Transcribe-fout", detail: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🎤 RapX Voice Server actief op poort ${PORT}`));
