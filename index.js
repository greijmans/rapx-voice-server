
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { OpenAI } from 'openai';
import { buildRewritePrompt } from './rewrite.js';

const app = express();
const upload = multer({ dest: 'uploads/' });
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Basic security & JSON body parsing ---
app.use(express.json({ limit: '5mb' }));

// --- CORS: restrict to rapx.nl (adjust if you add subdomains) ---
app.use((req, res, next) => {
  const allowedOrigin = 'https://rapx.nl';
  const origin = req.headers.origin;
  if (origin && origin === allowedOrigin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- Healthcheck ---
app.get('/api/health', (_, res) => res.json({ ok: true }));

// --- Whisper transcription endpoint ---
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_audio' });
    const filePath = req.file.path;

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: 'nl'
    });

    // cleanup temp file
    fs.unlink(filePath, () => {});

    res.json({ text: (transcription.text || '').trim() });
  } catch (err) {
    console.error('transcribe_failed', err);
    res.status(500).json({ error: 'transcribe_failed' });
  }
});

// --- GPT rewrite endpoint ---
app.post('/api/rewrite', async (req, res) => {
  try {
    const { kopje, raw } = req.body || {};
    if (!raw) return res.status(400).json({ error: 'no_text' });
    const prompt = buildRewritePrompt(kopje || 'Onbekend', raw);

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    });

    const out = completion.choices?.[0]?.message?.content?.trim() || raw;
    res.json({ text: out });
  } catch (err) {
    console.error('rewrite_failed', err);
    res.status(500).json({ error: 'rewrite_failed' });
  }
});

// --- Start ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ RapX Voice API live op poort ${PORT}`));
