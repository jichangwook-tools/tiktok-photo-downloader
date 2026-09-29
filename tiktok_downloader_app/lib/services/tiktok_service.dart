import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/tiktok_post.dart';

class TikTokService {
  static final RegExp _urlRegex = RegExp(
    r'https?://(?:[a-zA-Z0-9_-]+\.)?tiktok\.com/[^\s]+',
    caseSensitive: false,
  );
  static final RegExp _postIdRegex = RegExp(r'/(?:photo|video)/(\d+)');
  static final RegExp _authorRegex = RegExp(r'@([^/?#]+)');

  /// Trích xuất URL TikTok từ văn bản bất kỳ (kể cả khi copy kèm chữ, hashtag)
  static String? extractUrl(String text) {
    final match = _urlRegex.firstMatch(text.trim());
    return match?.group(0);
  }

  static String? extractPostId(String url) {
    final match = _postIdRegex.firstMatch(url);
    return match?.group(1);
  }

  static String? extractAuthor(String url) {
    final match = _authorRegex.firstMatch(url);
    return match?.group(1);
  }

  /// Tự động giải mã link rút gọn từ điện thoại (vt.tiktok.com, vm.tiktok.com, /t/...) thành link gốc
  static Future<String> resolveShortUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return url;

    final isShort = url.contains('vt.tiktok.com') ||
        url.contains('vm.tiktok.com') ||
        url.contains('/t/');

    if (isShort) {
      try {
        final client = http.Client();
        final request = http.Request('GET', uri)..followRedirects = false;
        request.headers['User-Agent'] =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        final streamedResponse =
            await client.send(request).timeout(const Duration(seconds: 4));
        final location = streamedResponse.headers['location'];
        if (location != null && location.isNotEmpty) {
          return location;
        }
      } catch (_) {
        // Nếu lỗi mạng hay timeout thì dùng link ban đầu để TikWM tự động giải mã
      }
    }
    return url;
  }

  /// Trích xuất danh sách ảnh không logo từ link bài đăng TikTok (hỗ trợ cả link ngắn vt.tiktok.com)
  static Future<TikTokPost> fetchPostInfo(String rawInput) async {
    // 1. Tự động trích xuất URL TikTok từ văn bản đầu vào
    final extractedUrl = extractUrl(rawInput) ?? rawInput.trim();

    if (!extractedUrl.toLowerCase().contains('tiktok.com')) {
      throw Exception(
        'Đường link không hợp lệ! Vui lòng dán link TikTok (vd: https://vt.tiktok.com/... hoặc tiktok.com/@user/photo/...)',
      );
    }

    // 2. Tự động giải mã link ngắn nếu là link vt.tiktok.com / vm.tiktok.com
    final resolvedUrl = await resolveShortUrl(extractedUrl);
    final fallbackPostId =
        extractPostId(resolvedUrl) ?? extractPostId(extractedUrl) ?? '';

    // 3. Gọi API TikWM Dedicated Photo Engine
    // Ưu tiên link đã giải mã có /photo/, nếu chưa thì truyền thẳng link gốc để TikWM tự xử lý
    final targetUrlForApi =
        resolvedUrl.contains('/photo/') ? resolvedUrl : extractedUrl;
    final apiUri = Uri.parse(
        'https://www.tikwm.com/api/?url=${Uri.encodeComponent(targetUrlForApi)}');

    final response = await http.get(apiUri, headers: {
      'Accept': 'application/json',
      'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36',
    }).timeout(const Duration(seconds: 15));

    if (response.statusCode != 200) {
      throw Exception(
          'Không kết nối được tới máy chủ (Mã lỗi: ${response.statusCode})');
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (json['code'] != 0 || json['data'] == null) {
      throw Exception(
        json['msg']?.toString() ??
            'Bài đăng này không phải bài ảnh hoặc không tìm thấy dữ liệu.',
      );
    }

    final data = json['data'] as Map<String, dynamic>;
    final finalPostId =
        (data['id']?.toString() != null && data['id'].toString().isNotEmpty)
            ? data['id'].toString()
            : fallbackPostId;

    final post = TikTokPost.fromTikWM(data, finalPostId);
    if (post.images.isEmpty) {
      throw Exception('Bài đăng này là Video hoặc không chứa bộ ảnh trượt.');
    }

    return post;
  }
}
