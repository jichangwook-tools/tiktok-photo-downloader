import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/tiktok_post.dart';

class TikTokService {
  static final RegExp _postIdRegex = RegExp(r'/photo/(\d+)');
  static final RegExp _authorRegex = RegExp(r'@([^/?#]+)');

  static String? extractPostId(String url) {
    final match = _postIdRegex.firstMatch(url);
    return match?.group(1);
  }

  static String? extractAuthor(String url) {
    final match = _authorRegex.firstMatch(url);
    return match?.group(1);
  }

  /// Trích xuất danh sách ảnh không logo từ link bài đăng TikTok
  static Future<TikTokPost> fetchPostInfo(String rawUrl) async {
    final cleanUrl = rawUrl.trim();
    final postId = extractPostId(cleanUrl);

    if (postId == null) {
      throw Exception(
        'Đường link không hợp lệ! Vui lòng dán link ảnh dạng: tiktok.com/@username/photo/...',
      );
    }

    final author = extractAuthor(cleanUrl) ?? 'tiktok';
    final canonicalUrl = 'https://www.tiktok.com/@$author/photo/$postId';

    // Gọi API TikWM Dedicated Photo Engine
    final uri = Uri.parse('https://www.tikwm.com/api/?url=${Uri.encodeComponent(canonicalUrl)}');
    final response = await http.get(uri, headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36',
    });

    if (response.statusCode != 200) {
      throw Exception('Không kết nối được tới máy chủ (Mã lỗi: ${response.statusCode})');
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (json['code'] != 0 || json['data'] == null) {
      throw Exception(
        json['msg']?.toString() ?? 'Bài đăng này không phải bài ảnh hoặc không tìm thấy dữ liệu.',
      );
    }

    final post = TikTokPost.fromTikWM(json['data'], postId);
    if (post.images.isEmpty) {
      throw Exception('Bài đăng này không có ảnh nào hoặc là video TikTok.');
    }

    return post;
  }
}
