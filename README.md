# PKM Command Center — Panduan Deploy

Aplikasi ini punya 2 mode login:
- **Manajemen** — password tunggal, akses penuh ke semua tim
- **Ketua Tim** — login pakai *kode akses* unik per tim (dibuat otomatis saat manajemen menambah tim), hanya bisa lihat & update timnya sendiri

## Langkah 1 — Bikin database (Supabase, gratis)
1. Daftar di https://supabase.com → buat project baru (pilih region Singapore biar dekat)
2. Buka **SQL Editor** di dashboard Supabase → New query
3. Copy-paste isi file `schema.sql` → klik **Run**
4. Buka **Project Settings > API** → catat dua nilai ini:
   - `Project URL`
   - `anon public key`

## Langkah 2 — Siapkan project di komputer
```bash
# masuk ke folder project
cd pkm-app
npm install
```
Buat file `.env` (copy dari `.env.example`) dan isi:
```
VITE_SUPABASE_URL=<Project URL dari Supabase>
VITE_SUPABASE_ANON_KEY=<anon public key dari Supabase>
VITE_MANAJEMEN_PASSWORD=<password bebas untuk login manajemen>
```

Coba jalankan lokal dulu untuk memastikan semua jalan:
```bash
npm run dev
```
Buka `http://localhost:5173` — login sebagai Manajemen pakai password di `.env`.

## Langkah 3 — Deploy ke Vercel (gratis)
1. Push folder project ini ke repo GitHub baru
2. Daftar/login di https://vercel.com dengan akun GitHub
3. **Add New Project** → pilih repo tadi → Vercel otomatis mendeteksi Vite
4. Sebelum klik Deploy, buka **Environment Variables** → masukkan 3 variabel yang sama seperti di `.env`
5. Klik **Deploy** → tunggu ± 1 menit → Anda dapat URL publik (mis. `pkm-command.vercel.app`)

## Langkah 4 — Bagikan akses ke ketua tim
1. Login sebagai Manajemen di URL yang sudah live
2. Tambah tim seperti biasa lewat menu **Tim PKM**
3. Klik tim tersebut untuk melihat **kode akses**-nya (juga tampil di daftar tim)
4. Kirim ke ketua tim: **URL aplikasi** + **kode akses** miliknya
5. Ketua tim buka URL → pilih tab "Ketua Tim" → masukkan kode akses → langsung masuk ke ruang timnya sendiri (checklist milestone, catatan progres, lihat skor & jadwal bimbingan)

## Catatan keamanan
- Setup ini pakai kontrol akses sederhana (kode akses + password), cocok untuk skala kecil-menengah (belasan-puluhan tim). Cukup aman selama kode akses tidak disebar sembarangan.
- Untuk keamanan lebih ketat (login email+password per ketua tim, audit log, dll), bisa upgrade pakai **Supabase Auth** — beri tahu saya kalau butuh versi ini.
- Data tersimpan real-time: begitu ketua tim update progres, dashboard manajemen otomatis ter-refresh tanpa perlu reload.
