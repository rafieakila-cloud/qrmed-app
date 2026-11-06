# QRmed! — Scanner & QR Maker

QRmed! adalah PWA/aplikasi web untuk scan QR apa pun dan membuat QR, dengan tampilan e-wallet hijau dan penyimpanan lokal di perangkat.

Fitur MVP:
- Scan QR dari kamera (butuh HTTPS atau localhost) atau upload gambar QR.
- Smart action untuk QR umum: link, email, telepon, SMS, lokasi, WiFi, kontak/vCard, kalender.
- QRmed! lokal: buat QR berisi ID unik, lalu scan untuk menampilkan centang hijau + nama.
- WiFi QR: deteksi SSID, keamanan, password (bisa disalin) dan buka pengaturan WiFi. Koneksi tetap butuh konfirmasi Android.
- Riwayat scan/buat QR tersimpan lokal, search, filter, export CSV, hapus per item/semua.
- Download QR sebagai PNG/SVG dan cetak.

## Menjalankan lokal untuk HP Android
HP dan laptop harus satu WiFi.

```powershell
python -m http.server 8080 --bind 0.0.0.0
```

Lalu di HP buka:

```text
http://<IP-LAPTOP>:8080/
```

Catatan penting: Android biasanya tidak mengizinkan kamera dari alamat `http://IP-​LAPTOP`. Untuk memakai kamera asli dari Android, buka lewat HTTPS (misalnya deploy atau tunnel) atau localhost dari perangkat itu sendiri. Untuk sementara kamu tetap bisa pakai tombol **Scan Gambar** pada mode HTTP lokal.

## Install sebagai PWA
Install PWA membutuhkan konteks aman (HTTPS atau localhost). Jika sudah ada URL HTTPS:
1. Buka URL di Chrome Android.
2. Menu ⋮ → **Tambahkan ke layar utama / Install aplikasi**.

## Catatan keamanan
QRmed! tidak bisa menyelesaikan pembayaran atau menyambungkan WiFi tanpa persetujuan pengguna. QRmed! hanya membaca/menampilkan informasi dan membuka alur resmi Android.
