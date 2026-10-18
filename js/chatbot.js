/* ============================================================
   DermAgent — chatbot widget
   Backend: /api/chat (Vercel serverless → Astra DB + Gemini)
   Requires: js/script.js loaded before this file.
   ============================================================ */

const DERMAGENT_CONFIG = {
  endpoint: "/api/chat",
};

const DERMAGENT_STORAGE_KEY = "dermagent_detection_context";
const MAX_HISTORY = 6;
let dermHistory = []; // riwayat percakapan singkat (reset saat pindah halaman)

function saveDetectionContext(disease, confidence, source = "deteksi") {
  if (!disease) return;
  const context = {
    disease: String(disease),
    confidence:
      Number(confidence) <= 1
        ? Math.round(Number(confidence) * 100)
        : Math.round(Number(confidence)),
    source,
    updatedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(DERMAGENT_STORAGE_KEY, JSON.stringify(context));
  updateDermAgentContext();
}

function getDetectionContext() {
  try {
    return JSON.parse(sessionStorage.getItem(DERMAGENT_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function clearDetectionContext() {
  sessionStorage.removeItem(DERMAGENT_STORAGE_KEY);
  updateDermAgentContext();
}

function updateDermAgentContext() {
  const el = document.getElementById("da-context");
  if (!el) return;
  const ctx = getDetectionContext();
  if (!ctx) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.style.display = "block";
  el.innerHTML = `Hasil deteksi terakhir: <strong>${escapeHTML(ctx.disease)}</strong> · Confidence <strong>${ctx.confidence}%</strong>`;
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}

// Teks bot → HTML aman (escape dulu, baru ubah **tebal** dan poin)
function renderDermAgentText(text) {
  return escapeHTML(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[\*\-]\s+/gm, "• ");
}

function addDermAgentMessage(text, role = "bot") {
  const box = document.getElementById("da-messages");
  if (!box) return;
  const msg = document.createElement("div");
  msg.className = `da-msg ${role}`;
  if (role === "bot") msg.innerHTML = renderDermAgentText(text);
  else msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
  return msg;
}

async function sendDermAgentMessage() {
  const input = document.getElementById("dermagent-input");
  const send = document.getElementById("dermagent-send");
  if (!input || !send) return;

  const question = input.value.trim();
  if (!question || send.disabled) return;

  addDermAgentMessage(question, "user");
  input.value = "";
  send.disabled = true;

  const typing = addDermAgentMessage("DermAgent sedang memproses…", "bot");
  typing.classList.add("da-typing");

  try {
    const response = await fetch(DERMAGENT_CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        detection: getDetectionContext(),
        history: dermHistory,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    const answer = (data.answer || "").trim();
    typing.remove();
    addDermAgentMessage(answer || "DermAgent tidak mengembalikan jawaban.");

    if (answer) {
      dermHistory.push(
        { role: "user", text: question },
        { role: "bot", text: answer },
      );
      dermHistory = dermHistory.slice(-MAX_HISTORY);
    }
  } catch (error) {
    typing.remove();
    addDermAgentMessage(
      `Maaf, DermAgent sedang tidak dapat menjawab.\n\n${error.message}`,
    );
  } finally {
    send.disabled = false;
    input.focus();
  }
}

function initDermAgent() {
  if (document.getElementById("dermagent-widget")) return;

  const widget = document.createElement("div");
  widget.id = "dermagent-widget";
  widget.innerHTML = `
    <div id="dermagent-panel" aria-label="DermAgent chatbot">
      <div class="da-header">
        <div class="da-avatar">DA</div>
        <div class="da-head-text">
          <strong>DermAgent</strong>
          <span>Dermatology Agent · AI Assistant</span>
        </div>
        <button class="da-close" id="da-close" aria-label="Tutup chatbot">×</button>
      </div>

      <div id="da-context" class="da-context"></div>

      <div id="da-messages" class="da-messages">
        <div class="da-msg bot">Halo! Saya DermAgent 👋<br><br>Saya dapat membantu menjelaskan hasil deteksi kulit dan informasi umum berdasarkan knowledge base. Hasil model bukan diagnosis medis.</div>
      </div>

      <div class="da-disclaimer">
        DermAgent bersifat informatif dan tidak menggantikan pemeriksaan tenaga medis.
      </div>

      <div class="da-input-wrap">
        <input id="dermagent-input" type="text" placeholder="Tanyakan sesuatu…" autocomplete="off" />
        <button id="dermagent-send" aria-label="Kirim">➤</button>
      </div>
    </div>

    <button id="dermagent-toggle" aria-label="Buka DermAgent">
      <span class="da-icon">✦</span>
    </button>
  `;
  document.body.appendChild(widget);

  const panel = document.getElementById("dermagent-panel");
  const toggle = document.getElementById("dermagent-toggle");
  const close = document.getElementById("da-close");
  const input = document.getElementById("dermagent-input");
  const send = document.getElementById("dermagent-send");

  function openPanel() {
    panel.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    updateDermAgentContext();
    input.focus();
  }
  function closePanel() {
    panel.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    panel.classList.contains("open") ? closePanel() : openPanel();
  });
  close.addEventListener("click", closePanel);
  send.addEventListener("click", sendDermAgentMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendDermAgentMessage();
    if (e.key === "Escape") closePanel();
  });

  updateDermAgentContext();
}

window.DERMAGENT_CONFIG = DERMAGENT_CONFIG;
window.saveDetectionContext = saveDetectionContext;
window.getDetectionContext = getDetectionContext;
window.clearDetectionContext = clearDetectionContext;

document.addEventListener("DOMContentLoaded", initDermAgent);
