# ⚕ Wotech — Deteksi Penyakit Kulit Infeksi Berbasis AI

Website berbasis HTML/CSS/JavaScript murni untuk mendeteksi penyakit kulit infeksi menggunakan model **YOLOv11 Nano** yang di-deploy di **Roboflow**.

---

## 📁 Struktur Folder

```
skin-detection/
├── index.html        ← Halaman utama (Home)
├── upload.html       ← Halaman upload gambar & deteksi
├── camera.html       ← Halaman deteksi real-time via kamera
├── css/
│   └── style.css     ← Custom styles + glassmorphism + animasi
├── js/
│   └── script.js     ← Logika utama, Roboflow API, utilities
└── README.md         ← Dokumentasi ini
```

---

## 🚀 Cara Menjalankan

### 1. Konfigurasi Roboflow API Key

Buka `js/script.js`, cari bagian konfigurasi di baris pertama dan isi:

```javascript
const ROBOFLOW_CONFIG = {
  apiKey:  "YOUR_ROBOFLOW_API_KEY",   // ← API Key dari dashboard Roboflow
  modelId: "skin-disease-detection",  // ← Model ID di Roboflow (URL slug)
  version: 1,                         // ← Versi model yang di-deploy
};
```

**Cara mendapatkan API Key:**
1. Login ke [roboflow.com](https://roboflow.com)
2. Buka **Settings → Roboflow API**
3. Copy **Private API Key**

**Cara mendapatkan Model ID & Version:**
1. Buka project Anda di Roboflow
2. Klik **Deploy → Roboflow Inference**
3. Salin URL inference, contoh:
   ```
   https://detect.roboflow.com/skin-disease-yolov11/1
   ```
   Maka: `modelId = "skin-disease-yolov11"`, `version = 1`

---

### 2. Jalankan dengan Live Server (Direkomendasikan)

Karena website menggunakan `fetch()` untuk API dan akses kamera (requires HTTPS/localhost), **tidak bisa dibuka langsung sebagai file HTML**.

**Opsi A — VS Code Live Server (termudah):**
```
1. Install ekstensi "Live Server" di VS Code
2. Klik kanan index.html → "Open with Live Server"
3. Browser otomatis terbuka di http://127.0.0.1:5500
```

**Opsi B — Python HTTP Server:**
```bash
# Python 3
python -m http.server 8080

# Lalu buka: http://localhost:8080
```

**Opsi C — Node.js serve:**
```bash
npx serve .
```

---

### 3. Catatan Kamera (camera.html)

- Browser memerlukan **HTTPS atau localhost** untuk mengakses kamera
- Saat pertama kali membuka, izinkan akses kamera
- Di smartphone: buka via URL lokal yang dapat diakses dari HP (misal dengan `ngrok` atau WiFi yang sama)

---

## 🧠 Teknologi

| Komponen | Teknologi |
|---|---|
| Frontend | HTML5, CSS3, JavaScript Vanilla |
| Styling | Tailwind CSS CDN + Custom CSS |
| Fonts | Syne (display) + DM Sans (body) |
| Model | YOLOv11 Nano |
| AI Platform | Roboflow Inference API |
| Animasi | CSS Keyframes + Intersection Observer |

---

## 🦠 Penyakit yang Dapat Dideteksi

| Kelas | Jenis Infeksi |
|---|---|
| Panu | Jamur (Malassezia) |
| Kurap | Jamur (Dermatofita) |
| Bisul | Bakteri (Staphylococcus aureus) |
| Herpes | Virus (HSV-1/2) |
| Varicella | Virus (VZV) |
| Biduran | Alergi/Imun |
| Kutil | Virus (HPV) |

---

## 📊 Performa Model

| Metrik | Nilai |
|---|---|
| mAP@50 | **88.7%** |
| Precision | **83.3%** |
| Recall | **89.9%** |
| F1 Score | **86.5%** |

---

## ⚙️ Cara Kerja Upload Detection

1. User upload gambar → preview tampil di browser
2. Klik "Deteksi Sekarang" → gambar dikirim ke Roboflow API via `FormData`
3. API mengembalikan array `predictions` dengan:
   - `class` — nama penyakit
   - `confidence` — tingkat keyakinan (0–1)
   - `x, y, width, height` — koordinat bounding box
4. Website menggambar bounding box di atas gambar menggunakan `<canvas>`
5. Informasi penyakit dan rekomendasi ditampilkan dari database lokal

## ⚙️ Cara Kerja Camera Detection

1. User klik "Mulai Kamera" → browser request akses kamera
2. Video stream ditampilkan di `<video>` element
3. Setiap X detik (dapat diatur), frame di-capture ke `<canvas>`
4. Frame dikonversi ke base64 JPEG dan dikirim ke Roboflow API
5. Bounding box digambar langsung di atas canvas

---

## 🔧 Kustomisasi

### Tambah Penyakit Baru
Edit objek `DISEASE_INFO` di `js/script.js` dan tambahkan mapping di fungsi `normalizeLabel()`.

### Ubah Interval Kamera
Default 1.5 detik. User dapat mengubah via slider di halaman kamera (0.5s – 5s).

### Ubah Tema Warna
Edit variabel CSS di `css/style.css`:
```css
:root {
  --indigo: #6366f1;
  --purple: #a855f7;
  --cyan:   #22d3ee;
}
```

---

## ⚠️ Disclaimer

Hasil deteksi bersifat **informatif** dan **tidak menggantikan** diagnosis medis profesional. Selalu konsultasikan ke dokter atau tenaga medis yang berpengalaman.

---

## 👥 Tim Wotech

Dibuat untuk project Machine Learning — Tugas Akhir.

© 2025 Team Wotech. All rights reserved.
