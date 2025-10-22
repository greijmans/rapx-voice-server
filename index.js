import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.get("/", (req, res) => res.json({ ok: true }));

// 🎧 Transcriptie via Whisper
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fs.createReadStream(filePath),
      language: "nl",
    });
    fs.unlinkSync(filePath);
    res.json({ text: response.text });
  } catch (err) {
    console.error("Transcribe-fout", err);
    res.status(500).json({ error: "Transcribe-fout" });
  }
});

// ✏️ Alleen grammaticale correctie — geen interpretatie
app.post("/api/rewrite", async (req, res) => {
  try {
    const { raw } = req.body;

    const prompt = `
Je bent een grammatica- en taalcorrector voor inspectierapporten.
Verbeter enkel grammatica, spelling en hoofdletters.
Vul afgebroken zinnen aan tot ze grammaticaal compleet zijn.
Voeg geen inhoud, interpretatie of extra informatie toe.
Behoud de zakelijke toon en korte formuleringen.
Voorbeeld:
Input: "elektra niet gekeurd, maatregel"
Output: "De elektrische installatie is niet gekeurd. Maatregel opgenomen."
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: raw },
      ],
      temperature: 0,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    res.json({ text });
  } catch (err) {
    console.error("Rewrite-fout", err);
    res.status(500).json({ error: "Rewrite-fout" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Voice server running on port ${PORT}`));
