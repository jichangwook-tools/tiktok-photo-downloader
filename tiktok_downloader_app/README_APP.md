# 📱 TikTok Photo Downloader — Flutter Native Android App
> **Tác giả:** JiChangWook - Wook  
> **Kênh hỗ trợ:** [@J2TeamDev Telegram](https://t.me/J2TeamDev)

---

## 🌟 Tính năng nổi bật của App
1. **Tải ảnh TikTok không logo:** Lấy ảnh chất lượng gốc Full HD từ CDN TikTok.
2. **Lưu trực tiếp vào Thư viện ảnh (Gallery/Album):** Tương thích từ Android 5.0 đến Android 14 mới nhất.
3. **Giao diện chuẩn Dark Mode TikTok:** Font chữ **Alata**, hiệu ứng neon sắc nét, mượt mà 120Hz.
4. **Nút Dán nhanh (Paste):** Tự động đọc link từ bộ nhớ tạm clipboard.
5. **Chọn ảnh tùy ý:** Chọn từng ảnh hoặc chọn tất cả dễ dàng.

---

## 🚀 Cách lấy file `.apk` cài vào điện thoại

### Cách 1: Tự động Build bằng GitHub Actions (Khuyên dùng — Không cần cài gì trên máy)
1. Đẩy toàn bộ thư mục này lên một kho lưu trữ **GitHub** (chế độ Public hoặc Private đều được).
2. Vào tab **Actions** trên GitHub.
3. Bạn sẽ thấy workflow **"Build Flutter APK"** chạy tự động (hoặc bấm **Run workflow**).
4. Sau khoảng 2–3 phút, GitHub sẽ xuất ra file:
   👉 **`TikTok-Photo-Downloader-APK`** (bên trong chứa file `app-release.apk`).
5. Tải file về điện thoại Android và mở lên cài đặt là xong!

---

### Cách 2: Tự build trên máy tính (nếu bạn đã cài Flutter SDK & Android Studio)
```bash
# Di chuyển vào thư mục app
cd tiktok_downloader_app

# Cài thư viện
flutter pub get

# Chạy thử trên máy ảo hoặc điện thoại cắm cáp
flutter run

# Xuất file APK cài đặt
flutter build apk --release
```
File APK sau khi build sẽ nằm tại:  
`tiktok_downloader_app/build/app/outputs/flutter-apk/app-release.apk`
