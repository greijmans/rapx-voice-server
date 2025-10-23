// index.js — RapX Voice Server (strict rewrite + uploads-fix)
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// --- middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- zorg dat uploads/ bestaat
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("📁 Map 'uploads' aangemaakt");
}

// --- Multer opslag
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}.webm`)
});
const upload = multer({ storage });

app.get("/", (_req, res) => res.json({ ok: true, service: "RapX Voice Server" }));

// 🎧 Transcriptie via Whisper
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Geen audio" });
    const filePath = req.file.path;
    console.log("🎧 Ontvangen audio:", filePath);

    // 🎧 Spraakherkenning (snelle versie)
const tr = await openai.audio.transcriptions.create({
  model: "gpt-4o-mini-transcribe",
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

// ✏️ Herschrijf: alléén grammatica + speciale 'maatregel'-regel
app.post("/api/rewrite", async (req, res) => {
  try {
    const raw = String(req.body?.raw || "").trim();
    if (!raw) return res.json({ text: "" });

    // 1) Ultra-strikte systeeminstructie
    const sys =
`Je bent een Nederlandse taalcorrector voor inspectierapporten.
- Corrigeer ALLEEN spelling, grammatica en hoofdletters.
- Maak afgebroken zinnen alleen grammaticaal compleet.
- Voeg GEEN inhoud toe, geen interpretaties, geen evaluaties.
- Houd het zakelijk, kort, feitelijk.
- Als het woord 'maatregel' of 'maatregelen' in de input voorkomt:
  zet aan het eind exact de zin: "Maatregel opgenomen."
  en voeg hiervoor GEEN uitleg toe.
Voorbeelden:
Input: "elektra niet gekeurd, maatregel"
Output: "De elektrische installatie is niet gekeurd. Maatregel opgenomen."
Input: "Er zijn voldoende blusmiddelen aanwezig met jaarlijks onderhoud"
Output: "Er zijn voldoende blusmiddelen aanwezig met jaarlijks onderhoud."`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: raw }
      ]
    });

    let text = resp.choices?.[0]?.message?.content?.trim() || raw;

    // 2) Fail-safe postprocessing voor 'maatregel' op basis van de ruwe input.
    if (/\bmaatregel(en)?\b/i.test(raw)) {
      // verwijder omslachtige frasen die soms doorslippen
      text = text
        .replace(/,\s*wat\s+(aanleiding|noodzaak)[^.!?]*[.!?]/gi, ".")
        .replace(/,\s*waardoor[^.!?]*[.!?]/gi, ".")
        .replace(/\s+/g, " ")
        .trim();

      // zorg dat afsluiter aanwezig is
      if (!/Maatregel opgenomen\./i.test(text)) {
        if (!/[.!?]$/.test(text)) text += ".";
        text += " Maatregel opgenomen.";
      }
    }

    // compact spaties/punten
    text = text.replace(/\s+\./g, ".").replace(/\s+/g, " ").trim();

    res.json({ text });
  } catch (err) {
    console.error("❌ Rewrite-fout:", err);
    res.status(500).json({ error: "Rewrite-fout", detail: String(err?.message || err) });
  }
});

app.listen(PORT, () => console.log(`🚀 RapX Voice Server actief op poort ${PORT}`));
