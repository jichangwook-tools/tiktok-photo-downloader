import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:image_gallery_saver_plus/image_gallery_saver_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/tiktok_post.dart';

class DownloadService {
  final Dio _dio = Dio();

  /// Xin quyền truy cập thư viện ảnh của thiết bị Android
  Future<bool> requestStoragePermission() async {
    // Android 13+ (API 33+) dùng photos, Android cũ dùng storage
    if (await Permission.photos.request().isGranted) {
      return true;
    }
    if (await Permission.storage.request().isGranted) {
      return true;
    }
    return false;
  }

  /// Tải danh sách ảnh được chọn và lưu vào Thư viện ảnh / Bộ sưu tập
  Future<int> downloadSelectedImages({
    required TikTokPost post,
    required Function(int current, int total) onProgress,
  }) async {
    final granted = await requestStoragePermission();
    if (!granted) {
      throw Exception('Vui lòng cấp quyền lưu trữ để ứng dụng có thể lưu ảnh vào máy.');
    }

    final selectedImages = post.images.where((img) => img.isSelected).toList();
    if (selectedImages.isEmpty) {
      throw Exception('Chưa có ảnh nào được chọn để tải.');
    }

    int savedSuccess = 0;
    final total = selectedImages.length;

    for (int i = 0; i < total; i++) {
      final img = selectedImages[i];
      try {
        final response = await _dio.get(
          img.url,
          options: Options(responseType: ResponseType.bytes),
        );

        final Uint8List bytes = Uint8List.fromList(response.data);
        final fileName = 'TikTok_${post.author}_${post.postId}_${img.index + 1}';

        final result = await ImageGallerySaverPlus.saveImage(
          bytes,
          name: fileName,
          quality: 100,
        );

        if (result != null && (result['isSuccess'] == true || result['isSuccess'] == 1)) {
          savedSuccess++;
        }
      } catch (e) {
        // Tiếp tục tải các ảnh còn lại nếu một ảnh bị lỗi mạng
      }

      onProgress(i + 1, total);
    }

    return savedSuccess;
  }
}
