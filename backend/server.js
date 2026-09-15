
import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';

const app = express();

app.use(express.json({ limit: '1mb' }));

// CORS sementara untuk koneksi dari GitHub Pages
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

if (!process.env.OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY belum di-set.');
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM = `
Kamu adalah ELECTRO AI, asisten engineering listrik untuk aplikasi ElectroCalc Pro.

Gunakan konteks kalkulator yang diberikan pengguna.

Gunakan bahasa Indonesia yang praktis dan mudah dipahami teknisi.

Jangan mengarang data yang tidak ada.
Bedakan hasil kalkulator, asumsi, dan rekomendasi.

Untuk sizing proteksi, kabel, kontaktor, TOR, inverter,
dan komponen listrik lainnya, tekankan bahwa hasil harus
diverifikasi dengan nameplate motor, datasheet pabrikan,
metode instalasi, kemampuan hubung singkat, koordinasi proteksi,
dan standar yang berlaku.

Jangan mengubah nilai hasil kalkulator hanya agar terlihat masuk akal.

Untuk pertanyaan rangkaian, jelaskan fungsi komponen dan
urutan aliran daya/kontrol.

Jangan mengklaim sebuah diagram aman untuk langsung diwiring
tanpa verifikasi teknisi.
`;

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Pesan tidak boleh kosong.'
      });
    }

    const input = `${SYSTEM}

DATA KALKULATOR:
${JSON.stringify(context ?? {}, null, 2)}

PERTANYAAN USER:
${message}`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      input
    });

    res.json({
      reply: response.output_text || 'AI tidak mengembalikan teks.'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err?.message || 'Gagal menghubungi OpenAI.'
    });
  }
});

app.get('/health', (_, res) => {
  res.json({
    ok: true,
    service: 'Electro AI'
  });
});

const port = process.env.PORT || 10000;

app.listen(port, '0.0.0.0', () => {
  console.log(`Electro AI berjalan di port ${port}`);
});
