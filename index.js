import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 10000;

// ✅ CORS: alleen jouw domein toestaan
app.use(cors({
  origin: ["https://voice.rapx.nl"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// 🔹 Testendpoint
app.get("/api/ping", (req, res) => {
  console.log("✅ Ping ontvangen van client");
  res.json({ ok: true, msg: "Server actief" });
});

// 🔹 AUDIO → TEKST via Whisper
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ Geen audiobestand ontvangen");
      return res.status(400).json({ error: "Geen bestand ontvangen" });
    }

    const mimetype = req.file.mimetype || "";
    if (
      !mimetype.startsWith("audio/ogg") &&
      !mimetype.startsWith("audio/webm")
    ) {
      console.error("❌ Ongeldig audioformaat:", mimetype);
      return res.status(400).json({ error: "Ongeldig audioformaat" });
    }

    console.log(`🎧 Ontvangen audio: ${req.file.originalname} (${mimetype}, ${req.file.size} bytes)`);

    // ✅ Lees bestand in en maak er een Blob van (nodig voor Node 22)
    const fileBuffer = fs.readFileSync(req.file.path);
    const blob = new Blob([fileBuffer], { type: mimetype });

    // ✅ FormData correct vullen
    const form = new FormData();
    form.append("model", "whisper-1");
    form.append("file", blob, req.file.originalname);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });

    const data = await response.json();
    fs.unlink(req.file.path, () => {}); // tijdelijk bestand wissen

    console.log("✅ Whisper antwoord:", data);

    if (!data.text) {
      return res.status(500).json({ error: "Geen tekst ontvangen van Whisper" });
    }

    res.json({ text: data.text });
  } catch (err) {
    console.error("💥 Fout bij transcribe:", err);
    res.status(500).json({ error: "Transcribe-fout", detail: err.message });
  }
});

// 🔹 KORTE ZIN → VOLLEDIGE ZIN herschrijven
app.post("/api/rewrite", async (req, res) => {
  try {
    const { kopje, raw } = req.body;

    if (!raw) {
      return res.status(400).json({ error: "Geen tekst meegegeven" });
    }

    const prompt = `
    Zet de volgende ruwe observatie om in een volledige, nette zin
    die geschikt is voor een inspectierapport onder het kopje "${kopje}".
    Vermijd opsommingstekens en maak de zin vloeiend.
    Observatie: "${raw}"
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Je bent een zakelijke rapporteditor die korte notities omzet in complete zinnen." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || raw;

    console.log(`✏️ Rewrite (${kopje}):`, text);

    res.json({ text });

  } catch (err) {
    console.error("💥 Fout bij rewrite:", err);
    res.status(500).json({ error: "Rewrite-fout", detail: err.message });
  }
});

// 🔹 Start server
app.listen(process.env.PORT || 10000, "0.0.0.0", () => {
  console.log(`🚀 RapX Voice Server actief en luistert op poort ${process.env.PORT || 10000}`);
});
