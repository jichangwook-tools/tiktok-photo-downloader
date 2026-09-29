class TikTokImage {
  final String url;
  final int index;
  bool isSelected;

  TikTokImage({
    required this.url,
    required this.index,
    this.isSelected = true,
  });
}

class TikTokPost {
  final String postId;
  final String author;
  final String authorName;
  final String title;
  final List<TikTokImage> images;

  TikTokPost({
    required this.postId,
    required this.author,
    required this.authorName,
    required this.title,
    required this.images,
  });

  factory TikTokPost.fromTikWM(Map<String, dynamic> data, String fallbackPostId) {
    final rawImages = data['images'] as List<dynamic>? ?? [];
    final authorMap = data['author'] as Map<String, dynamic>? ?? {};

    return TikTokPost(
      postId: data['id']?.toString() ?? fallbackPostId,
      author: authorMap['unique_id']?.toString() ?? 'tiktok',
      authorName: authorMap['nickname']?.toString() ?? 'TikTok Creator',
      title: data['title']?.toString() ?? '',
      images: rawImages
          .asMap()
          .entries
          .map((e) => TikTokImage(
                url: e.value.toString(),
                index: e.key,
                isSelected: true,
              ))
          .toList(),
    );
  }
}
