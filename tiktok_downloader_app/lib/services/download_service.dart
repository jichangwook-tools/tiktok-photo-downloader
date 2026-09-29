import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:gal/gal.dart';
import '../models/tiktok_post.dart';

class DownloadService {
  final Dio _dio = Dio();

  /// Xin quyền truy cập thư viện ảnh của thiết bị
  Future<bool> requestStoragePermission() async {
    final hasAccess = await Gal.hasAccess();
    if (!hasAccess) {
      return await Gal.requestAccess();
    }
    return true;
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

        await Gal.putImageBytes(
          bytes,
          name: fileName,
          album: 'TikTok Downloader',
        );

        savedSuccess++;
      } catch (e) {
        // Tiếp tục tải các ảnh còn lại nếu một ảnh bị lỗi mạng
      }

      onProgress(i + 1, total);
    }

    return savedSuccess;
  }
}
