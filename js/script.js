// ============================================================
//  script.js — Wotech Skin Detection
//  Shared utilities + Roboflow API integration
// ============================================================

// ── CONFIG — GANTI DENGAN API KEY ROBOFLOW ANDA ─────────────
const ROBOFLOW_CONFIG = {
  apiKey: "wt1iuw854bubo8l9qNN1", // Private API Key milikmu
  modelId: "deteksi-penyakit-kulit-2-kfwzc", // CUKUP NAMA PROJECT (Hapus "/3")
  version: 3, // Versi dataset v3 (7 kelas)
};

// API endpoint builder
function roboflowUrl(mode = "image") {
  const base = "https://detect.roboflow.com";
  return `${base}/${ROBOFLOW_CONFIG.modelId}/${ROBOFLOW_CONFIG.version}?api_key=${ROBOFLOW_CONFIG.apiKey}`;
}

// ── Disease Database ─────────────────────────────────────────
const DISEASE_INFO = {
  panu: {
    name: "Panu (Tinea Versicolor)",
    emoji: "🔵",
    description:
      "Panu adalah infeksi jamur ringan pada kulit yang disebabkan oleh jamur Malassezia. Penyakit ini menyebabkan bercak-bercak putih, coklat, atau merah muda terutama pada kulit berminyak seperti punggung, dada, dan lengan atas.",
    causes:
      "Pertumbuhan berlebih jamur Malassezia akibat panas, kelembaban, kulit berminyak, atau sistem imun yang melemah.",
    handling: [
      "Gunakan sampo antijamur (selenium sulfida atau zinc pyrithione) pada area yang terkena.",
      "Oleskan krim antijamur seperti ketokonazol atau klotrimazol 2x sehari selama 2–4 minggu.",
      "Hindari paparan sinar matahari berlebih dan jaga kebersihan kulit.",
      "Konsultasikan ke dokter jika tidak membaik dalam 4 minggu.",
    ],
    color: "#6366f1",
  },
  kurap: {
    name: "Kurap (Tinea Corporis)",
    emoji: "🟠",
    description:
      "Kurap adalah infeksi jamur dermatofita pada kulit yang membentuk ruam melingkar seperti cincin dengan tepi menonjol kemerahan. Sangat menular melalui kontak langsung.",
    causes:
      "Infeksi dermatofita (Trichophyton, Microsporum) melalui kontak kulit langsung, berbagi benda pribadi, atau hewan.",
    handling: [
      "Oleskan krim antijamur topikal (terbinafin, klotrimazol) pada ruam dan sekitarnya.",
      "Lanjutkan pengobatan minimal 1–2 minggu setelah gejala hilang.",
      "Hindari berbagi handuk, pakaian, atau sisir.",
      "Jika lesi luas atau tidak membaik, dokter dapat meresepkan antijamur oral.",
    ],
    color: "#f97316",
  },
  bisul: {
    name: "Bisul (Furunkel)",
    emoji: "🔴",
    description:
      "Bisul adalah infeksi bakteri Staphylococcus aureus pada folikel rambut dan jaringan sekitarnya yang menyebabkan benjolan merah bernanah, nyeri, dan terasa hangat.",
    causes:
      "Bakteri Staphylococcus aureus masuk melalui luka kecil, gesekan, atau folikel rambut yang tersumbat.",
    handling: [
      "Kompres hangat 3–4 kali sehari selama 15 menit untuk membantu drainase alami.",
      "JANGAN memencet atau memotong bisul sendiri — risiko infeksi menyebar.",
      "Jaga kebersihan area, cuci tangan sebelum dan sesudah menyentuh bisul.",
      "Segera temui dokter jika bisul berdiameter >2 cm, demam, atau tidak membaik dalam 2 minggu.",
    ],
    color: "#ef4444",
  },
  herpes: {
    name: "Herpes",
    emoji: "🟡",
    description:
      "Herpes adalah infeksi virus Herpes Simplex (HSV-1 atau HSV-2) yang menyebabkan luka lepuh kecil bergerombol, nyeri, dan dapat kambuh berulang kali.",
    causes:
      "Virus Herpes Simplex yang menular melalui kontak langsung dengan lesi, air liur, atau cairan tubuh penderita.",
    handling: [
      "Konsultasikan ke dokter — antiviral (asiklovir, valasiklovir) dapat mempercepat penyembuhan.",
      "Hindari kontak langsung dengan orang lain saat lesi aktif.",
      "Kompres dingin untuk meredakan nyeri dan gatal.",
      "Jaga lesi tetap bersih dan kering, hindari memencah lepuh.",
    ],
    color: "#eab308",
  },
  varicella: {
    name: "Varicella (Cacar Air)",
    emoji: "🟣",
    description:
      "Cacar air adalah penyakit virus yang sangat menular disebabkan Varicella-Zoster Virus (VZV), ditandai dengan ruam lepuh gatal yang menyebar ke seluruh tubuh dan disertai demam.",
    causes:
      "Virus Varicella-Zoster yang menyebar melalui udara (batuk/bersin) atau kontak langsung dengan cairan lepuh.",
    handling: [
      "Istirahat total dan isolasi diri hingga semua lepuh mengering (≥7 hari).",
      "Minum antihistamin untuk mengurangi gatal; hindari menggaruk untuk cegah infeksi sekunder.",
      "Dokter dapat memberikan asiklovir untuk kasus berat atau risiko tinggi.",
      "Vaksinasi varicella tersedia dan direkomendasikan untuk pencegahan.",
    ],
    color: "#a855f7",
  },
  biduran: {
    name: "Biduran (Urtikaria)",
    emoji: "🩷",
    description:
      "Biduran adalah reaksi alergi kulit yang menyebabkan bentol merah, gatal, dan bengkak yang muncul tiba-tiba. Bentol bisa berpindah-pindah dan berubah ukuran.",
    causes:
      "Reaksi hipersensitivitas terhadap makanan, obat, sengatan serangga, infeksi, stres, atau bahan kimia tertentu.",
    handling: [
      "Identifikasi dan hindari pemicu (alergen) yang menyebabkan reaksi.",
      "Antihistamin (cetirizin, loratadin) efektif meredakan gejala.",
      "Kompres dingin pada area yang gatal.",
      "Segera ke IGD jika disertai sesak napas atau pembengkakan wajah/tenggorokan (anafilaksis).",
    ],
    color: "#ec4899",
  },
  kutil: {
    name: "Kutil (Veruka Vulgaris)",
    emoji: "🟤",
    description:
      "Kutil adalah pertumbuhan kulit jinak akibat infeksi Human Papillomavirus (HPV) yang menyebabkan tonjolan kasar berwarna keabuan atau coklat, terutama di tangan, kaki, dan jari.",
    causes:
      "Virus HPV masuk melalui kulit yang luka, tersebar melalui kontak langsung atau permukaan yang terkontaminasi.",
    handling: [
      "Oleskan salep asam salisilat secara rutin pada kutil setelah merendam dalam air hangat.",
      "Hindari menyentuh dan menggaruk kutil untuk mencegah penyebaran.",
      "Prosedur krioterapi (pembekuan) atau laser dapat dilakukan oleh dokter kulit.",
      "Kutil pada alat kelamin (kutil kondiloma) harus segera ditangani dokter.",
    ],
    color: "#a16207",
  },
};

// Normalize label from Roboflow → key in DISEASE_INFO
function normalizeLabel(label) {
  const map = {
    panu: "panu",
    kurap: "kurap",
    bisul: "bisul",
    herpes: "herpes",
    varicella: "varicella",
    cacar: "varicella",
    "cacar air": "varicella",
    biduran: "biduran",
    urtikaria: "biduran",
    kutil: "kutil",
    wart: "kutil",
  };
  const lw = label.toLowerCase().trim();
  for (const [k, v] of Object.entries(map)) {
    if (lw.includes(k)) return v;
  }
  return null;
}

// ── Navbar scroll effect ─────────────────────────────────────
(function initNavbar() {
  const nav = document.querySelector(".navbar");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

// ── Mobile menu ──────────────────────────────────────────────
(function initMobileMenu() {
  const btn = document.getElementById("hamburger");
  const menu = document.getElementById("mobile-menu");
  if (!btn || !menu) return;
  btn.addEventListener("click", () => {
    btn.classList.toggle("open");
    menu.classList.toggle("open");
  });
  // Close on link click
  menu.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      btn.classList.remove("open");
      menu.classList.remove("open");
    });
  });
})();

// ── Active nav link ──────────────────────────────────────────
(function setActiveLink() {
  const links = document.querySelectorAll(".nav-link");
  const path = location.pathname.split("/").pop() || "index.html";
  links.forEach((link) => {
    const href = (link.getAttribute("href") || "").split("/").pop();
    if (href === path) link.classList.add("active");
  });
})();

// ── Intersection Observer — reveal on scroll ─────────────────
(function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.1 },
  );
  els.forEach((el) => io.observe(el));
})();

// ── Toast system ─────────────────────────────────────────────
const ICONS = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };

function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${ICONS[type] || "ℹ️"}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => toast.classList.add("show")),
  );
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ── Confidence badge helper ───────────────────────────────────
function confidenceBadgeClass(conf) {
  if (conf >= 0.7) return "badge-high";
  if (conf >= 0.5) return "badge-medium";
  return "badge-low";
}

// ── Format seconds ────────────────────────────────────────────
function formatMs(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

// ── Call Roboflow API (image upload) ─────────────────────────
async function detectDisease(imageFile) {
  const url = roboflowUrl("image");
  const form = new FormData();
  form.append("file", imageFile);

  const t0 = Date.now();
  const res = await fetch(url, { method: "POST", body: form });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const time = Date.now() - t0;
  return { predictions: data.predictions || [], time };
}

// ── Call Roboflow API (base64) ────────────────────────────────
// ── Call Roboflow API (base64) ────────────────────────────────
async function detectDiseaseBase64(base64Str, width, height) {
  const url = `${roboflowUrl()}&format=json`; // ← Ditaruh di baris pertama setelah pembuka fungsi
  const t0 = Date.now();

  // Roboflow accepts image/jpeg base64 via multipart or raw body
  // Using the URL-based inference with base64
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: base64Str,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const time = Date.now() - t0;
  return { predictions: data.predictions || [], time };
}

// ── Draw bounding boxes on canvas ────────────────────────────
function drawBBoxes(canvas, predictions, imgW, imgH) {
  const ctx = canvas.getContext("2d");
  const scaleX = canvas.width / imgW;
  const scaleY = canvas.height / imgH;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  predictions.forEach((pred) => {
    const x = (pred.x - pred.width / 2) * scaleX;
    const y = (pred.y - pred.height / 2) * scaleY;
    const w = pred.width * scaleX;
    const h = pred.height * scaleY;

    const key = normalizeLabel(pred.class);
    const info = key ? DISEASE_INFO[key] : null;
    const color = info?.color || "#6366f1";
    const confPct = Math.round(pred.confidence * 100);
    const label = `${pred.class} ${confPct}%`;

    // Box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeRect(x, y, w, h);

    // Label background
    ctx.shadowBlur = 0;
    const fontSize = Math.max(12, Math.min(16, w / 6));
    ctx.font = `bold ${fontSize}px 'Syne', sans-serif`;
    const textW = ctx.measureText(label).width + 16;
    const textH = fontSize + 10;
    const labelY = y > textH ? y - textH : y + h;

    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 6;
    ctx.moveTo(x + r, labelY);
    ctx.lineTo(x + textW - r, labelY);
    ctx.quadraticCurveTo(x + textW, labelY, x + textW, labelY + r);
    ctx.lineTo(x + textW, labelY + textH - r);
    ctx.quadraticCurveTo(
      x + textW,
      labelY + textH,
      x + textW - r,
      labelY + textH,
    );
    ctx.lineTo(x + r, labelY + textH);
    ctx.quadraticCurveTo(x, labelY + textH, x, labelY + textH - r);
    ctx.lineTo(x, labelY + r);
    ctx.quadraticCurveTo(x, labelY, x + r, labelY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 8, labelY + textH - 7);
  });
}

// ── Animate stat counters ─────────────────────────────────────
function animateCounter(el, target, suffix = "%", duration = 1400) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    el.textContent = (target * ease).toFixed(1) + suffix;
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target + suffix;
  };
  requestAnimationFrame(update);
}

// ── Animate stat cards when visible ──────────────────────────
(function initStatCounters() {
  const cards = document.querySelectorAll("[data-stat]");
  if (!cards.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const el = e.target;
          const target = parseFloat(el.dataset.stat);
          const suffix = el.dataset.suffix || "%";
          animateCounter(el, target, suffix);
          io.unobserve(el);
        }
      });
    },
    { threshold: 0.5 },
  );
  cards.forEach((c) => io.observe(c));
})();

// expose globals
window.DISEASE_INFO = DISEASE_INFO;
window.normalizeLabel = normalizeLabel;
window.detectDisease = detectDisease;
window.detectDiseaseBase64 = detectDiseaseBase64;
window.drawBBoxes = drawBBoxes;
window.showToast = showToast;
window.confidenceBadgeClass = confidenceBadgeClass;
window.formatMs = formatMs;
