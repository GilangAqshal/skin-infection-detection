const COLLECTION = "dermagent_docs";
const KEYSPACE = "default_keyspace";
const EMBED_MODEL = "gemini-embedding-001"; // 3072 dimensi, cocok dengan collection kamu
const DEFAULT_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-flash-lite-latest";

const SYSTEM_PROMPT = `Kamu adalah DermAgent (Dermatology Agent), asisten informasi penyakit kulit untuk pengguna awam. Kamu membantu pengguna memahami hasil deteksi Computer Vision dan informasi umum penyakit kulit berdasarkan knowledge base.

GAYA JAWABAN
- Bahasa Indonesia yang ramah, natural, mudah dipahami, tidak menakut-nakuti, tidak menghakimi.
- Singkat, padat, langsung ke inti: maksimal 2-4 paragraf pendek atau 3-5 poin. Jika pengguna minta singkat, jawab sangat singkat.
- Jangan membuka dengan perkenalan diri kecuali pengguna menyapa.
- Jangan menjelaskan hal yang tidak ditanyakan. Hindari pengulangan dan heading markdown berlebihan.

TUGAS
- Menjelaskan informasi umum penyakit kulit.
- Menjelaskan hasil deteksi model dan arti confidence score.
- Memberi langkah umum yang aman.
- Mengenali tanda yang membutuhkan pemeriksaan medis.

ATURAN PENTING
- Gunakan KONTEKS (knowledge base) sebagai sumber utama. Jangan mengarang informasi yang tidak ada di konteks. Jika tidak tersedia, katakan begitu dan sarankan konsultasi ke tenaga medis.
- Hasil deteksi adalah prediksi model, BUKAN diagnosis medis. Gunakan istilah "hasil deteksi", "prediksi model", atau "indikasi dari model", bukan "diagnosis".
- Confidence adalah skor keyakinan model, bukan persentase kepastian diagnosis. Jika confidence tinggi, jelaskan model cukup yakin tetapi hasil tetap bukan diagnosis. Jika sedang/rendah, jelaskan keterbatasannya dan sarankan verifikasi.
- Jangan memberi resep, dosis obat, atau instruksi pengobatan yang berisiko.
- Jika ada tanda bahaya (sulit bernapas/menelan, bengkak wajah/lidah/tenggorokan, ruam menyebar cepat, sangat nyeri, demam disertai ruam, atau kondisi berat lain), prioritaskan anjuran segera mencari pertolongan medis.
- Hasil Computer Vision hanyalah alat bantu informasi, bukan pengganti dokter.

JIKA PENGGUNA MENANYAKAN HASIL DETEKSI, jawab ringkas dengan urutan:
1. Arti hasil deteksi.
2. Interpretasi confidence secara sederhana.
3. Apa yang sebaiknya dilakukan.
4. Kapan perlu ke tenaga medis (jika relevan).`;

async function embedQuery(text) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
      }),
    },
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`Embedding gagal: ${d.error?.message || r.status}`);
  }
  return d.embedding.values;
}

async function searchAstra(vector) {
  const base = process.env.ASTRA_DB_API_ENDPOINT.replace(/\/+$/, "");
  const r = await fetch(`${base}/api/json/v1/${KEYSPACE}/${COLLECTION}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Token: process.env.ASTRA_DB_APP_TOKEN,
    },
    body: JSON.stringify({
      find: {
        sort: { $vector: vector },
        options: { limit: 4 },
        projection: { page_content: 1 },
      },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.errors) {
    throw new Error(`Astra DB gagal: ${d.errors?.[0]?.message || r.status}`);
  }
  return (d.data?.documents || []).map((x) => x.page_content).filter(Boolean);
}

async function callGemini(model, contents) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.2 },
      }),
    },
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || `HTTP ${r.status}`);
  const parts = d.candidates?.[0]?.content?.parts || [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Model tidak mengembalikan teks");
  return text;
}

async function generateAnswer(contents) {
  const models = [process.env.GEMINI_MODEL || DEFAULT_MODEL, FALLBACK_MODEL];
  let lastError;
  for (const model of [...new Set(models)]) {
    try {
      return await callGemini(model, contents);
    } catch (e) {
      lastError = e;
      console.error(`Model ${model} gagal:`, e.message);
    }
  }
  throw new Error(`Gemini gagal: ${lastError.message}`);
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = history
    .slice(-6)
    .filter(
      (h) =>
        h &&
        typeof h.text === "string" &&
        (h.role === "user" || h.role === "bot"),
    )
    .map((h) => ({
      role: h.role === "bot" ? "model" : "user",
      parts: [{ text: h.text.slice(0, 1500) }],
    }));
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const missing = [
    "GOOGLE_API_KEY",
    "ASTRA_DB_APP_TOKEN",
    "ASTRA_DB_API_ENDPOINT",
  ].filter((k) => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({
      error: `Environment variable belum diisi: ${missing.join(", ")}`,
    });
  }

  const { question, detection, history } = req.body || {};
  if (!question || typeof question !== "string" || question.length > 1000) {
    return res.status(400).json({ error: "Pertanyaan tidak valid" });
  }

  try {
    const pastTurns = cleanHistory(history);
    const lastUser = [...pastTurns].reverse().find((h) => h.role === "user");
    const retrievalQuery = [lastUser?.parts[0].text, question]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1500);

    const vector = await embedQuery(retrievalQuery);
    const docs = await searchAstra(vector);

    const detectionText = detection?.disease
      ? `Hasil deteksi website: ${String(detection.disease).slice(0, 60)}, confidence ${Number(detection.confidence) || 0}% (sumber: ${String(detection.source || "deteksi").slice(0, 40)}).`
      : "Belum ada hasil deteksi yang tersimpan.";

    const userText = `KONTEKS:\n${docs.join("\n---\n") || "(kosong)"}\n\n${detectionText}\n\nPERTANYAAN PENGGUNA:\n${question}`;

    const answer = await generateAnswer([
      ...pastTurns,
      { role: "user", parts: [{ text: userText }] },
    ]);
    return res.status(200).json({ answer });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: e.message });
  }
};
