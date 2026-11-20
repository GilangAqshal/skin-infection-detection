const COLLECTION = "dermagent_docs";
const KEYSPACE = "default_keyspace";
const EMBED_MODEL = "gemini-embedding-001";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-flash-lite-latest";

// Keep each external request short so the Vercel function can finish
// before its configured maxDuration.
const TIMEOUT = {
  embedding: 10000,
  astra: 4000,
  gemini: 15000,
  geminiFallback: 10000,
};

const SYSTEM_PROMPT = `Kamu adalah DermAgent (Dermatology Agent), asisten informasi penyakit kulit untuk pengguna awam. Kamu membantu pengguna memahami hasil deteksi Computer Vision dan informasi umum penyakit kulit.

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
- Jika KONTEKS knowledge base tersedia, gunakan sebagai sumber utama dan jangan mengarang informasi yang tidak ada di konteks.
- Jika KONTEKS kosong/tidak tersedia, jangan berpura-pura telah membaca knowledge base. Kamu boleh memberi informasi kesehatan umum yang aman berdasarkan pengetahuan umum, dan jelaskan bila informasi khusus dari knowledge base sedang tidak tersedia.
- Hasil deteksi adalah prediksi model, BUKAN diagnosis medis. Gunakan istilah "hasil deteksi", "prediksi model", atau "indikasi dari model", bukan "diagnosis".
- Confidence adalah skor keyakinan model, bukan persentase kepastian diagnosis.
- Jangan memberi resep, dosis obat, atau instruksi pengobatan yang berisiko.
- Jika ada tanda bahaya (sulit bernapas/menelan, bengkak wajah/lidah/tenggorokan, ruam menyebar cepat, sangat nyeri, demam disertai ruam, atau kondisi berat lain), prioritaskan anjuran segera mencari pertolongan medis.
- Hasil Computer Vision hanyalah alat bantu informasi, bukan pengganti dokter.

JIKA PENGGUNA MENANYAKAN HASIL DETEKSI, jawab ringkas dengan urutan:
1. Arti hasil deteksi.
2. Interpretasi confidence secara sederhana.
3. Apa yang sebaiknya dilakukan.
4. Kapan perlu ke tenaga medis (jika relevan).`;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Permintaan ke layanan eksternal melewati batas ${Math.ceil(timeoutMs / 1000)} detik.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function embedQuery(text) {
  const r = await fetchWithTimeout(
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
    TIMEOUT.embedding,
  );

  const d = await readJson(r);
  if (!r.ok) {
    throw new Error(`Gemini Embedding gagal (HTTP ${r.status}): ${d.error?.message || "periksa GOOGLE_API_KEY dan kuota"}`);
  }
  const values = d.embedding?.values;
  if (!Array.isArray(values) || !values.length) {
    throw new Error("Gemini Embedding tidak mengembalikan vector.");
  }
  return values;
}

async function searchAstra(vector) {
  const endpoint = process.env.ASTRA_DB_API_ENDPOINT;
  const base = endpoint.replace(/\/+$/, "");
  const url = `${base}/api/json/v1/${KEYSPACE}/${COLLECTION}`;
  const payload = {
    find: {
      sort: { $vector: vector },
      options: { limit: 4 },
      projection: { page_content: 1 },
    },
  };

  // Retry transient 503/502/504 responses. An HTTP 503 can occur while a
  // free-tier database is resuming, but persistent errors must remain visible.
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Token: process.env.ASTRA_DB_APP_TOKEN,
          },
          body: JSON.stringify(payload),
        },
        TIMEOUT.astra,
      );

      const d = await readJson(r);
      if (r.ok && !d.errors) {
        return (d.data?.documents || [])
          .map((x) => x.page_content)
          .filter(Boolean);
      }

      const detail = d.errors?.[0]?.message || `HTTP ${r.status}`;
      lastError = new Error(`Astra DB gagal (HTTP ${r.status}): ${detail}`);

      // These are configuration/permission/schema failures; retrying won't fix them.
      if (![429, 500, 502, 503, 504].includes(r.status)) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
      // A timeout is transient. Other errors may be network errors; retry briefly.
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  throw lastError || new Error("Astra DB tidak dapat dihubungi.");
}

async function callGemini(model, contents, timeoutMs) {
  const r = await fetchWithTimeout(
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
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
      }),
    },
    timeoutMs,
  );

  const d = await readJson(r);
  if (!r.ok) throw new Error(`Gemini ${model} gagal (HTTP ${r.status}): ${d.error?.message || "permintaan gagal"}`);
  const parts = d.candidates?.[0]?.content?.parts || [];
  const answer = parts
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (!answer) throw new Error("Gemini tidak mengembalikan teks.");
  return answer;
}

async function generateAnswer(contents) {
  try {
    return await callGemini(DEFAULT_MODEL, contents, TIMEOUT.gemini);
  } catch (primaryError) {
    console.error(`Model utama ${DEFAULT_MODEL} gagal:`, primaryError.message);
    return callGemini(FALLBACK_MODEL, contents, TIMEOUT.geminiFallback);
  }
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = history
    .slice(-6)
    .filter((h) =>
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
    return res.status(400).json({ error: "Pertanyaan tidak valid." });
  }

  try {
    const pastTurns = cleanHistory(history);
    const lastUser = [...pastTurns].reverse().find((h) => h.role === "user");
    const retrievalQuery = [lastUser?.parts[0].text, question]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1500);

    let docs = [];
    let knowledgeBaseAvailable = true;
    try {
      const vector = await embedQuery(retrievalQuery);
      docs = await searchAstra(vector);
      if (!docs.length) knowledgeBaseAvailable = false;
    } catch (retrievalError) {
      knowledgeBaseAvailable = false;
      console.error("Retrieval knowledge base gagal:", retrievalError.message);
    }

    const detectionText = detection?.disease
      ? `Hasil deteksi website: ${String(detection.disease).slice(0, 60)}, confidence ${Number(detection.confidence) || 0}% (sumber: ${String(detection.source || "deteksi").slice(0, 40)}).`
      : "Belum ada hasil deteksi yang tersimpan.";

    const kbStatus = knowledgeBaseAvailable
      ? "Knowledge base berhasil diakses."
      : "Knowledge base sedang tidak tersedia atau tidak mengembalikan dokumen. Jangan mengklaim telah mengambil informasi dari knowledge base.";

    const userText = `STATUS KNOWLEDGE BASE: ${kbStatus}\n\nKONTEKS:\n${docs.join("\n---\n") || "(tidak tersedia)"}\n\n${detectionText}\n\nPERTANYAAN PENGGUNA:\n${question}`;

    const answer = await generateAnswer([
      ...pastTurns,
      { role: "user", parts: [{ text: userText }] },
    ]);

    return res.status(200).json({
      answer,
      knowledgeBaseAvailable,
      ...(knowledgeBaseAvailable ? {} : { notice: "Knowledge base sementara tidak tersedia; jawaban menggunakan informasi umum." }),
    });
  } catch (e) {
    console.error("DermAgent API error:", e.message);
    return res.status(502).json({
      error: e.message || "Layanan AI sedang tidak tersedia. Silakan coba lagi.",
    });
  }
};
