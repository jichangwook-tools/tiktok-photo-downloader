import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../models/tiktok_post.dart';
import '../services/tiktok_service.dart';
import '../services/download_service.dart';
import '../theme/app_theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _urlController = TextEditingController();
  final DownloadService _downloadService = DownloadService();

  TikTokPost? _currentPost;
  bool _isLoading = false;
  String? _errorMessage;

  bool _isDownloading = false;
  int _downloadCurrent = 0;
  int _downloadTotal = 0;

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  // ── Dán từ Clipboard ────────────────────────────────────────────────────────
  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text != null && data!.text!.isNotEmpty) {
      setState(() {
        _urlController.text = data.text!.trim();
      });
      _fetchPhotos();
    }
  }

  // ── Lấy thông tin bài đăng ──────────────────────────────────────────────────
  Future<void> _fetchPhotos() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      _showToast('Vui lòng dán link bài ảnh TikTok');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _currentPost = null;
    });

    try {
      final post = await TikTokService.fetchPostInfo(url);
      setState(() {
        _currentPost = post;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  // ── Tải ảnh về Thư viện ─────────────────────────────────────────────────────
  Future<void> _startDownload() async {
    if (_currentPost == null) return;

    final selectedCount = _currentPost!.images.where((img) => img.isSelected).length;
    if (selectedCount == 0) {
      _showToast('Vui lòng chọn ít nhất 1 ảnh để tải');
      return;
    }

    setState(() {
      _isDownloading = true;
      _downloadCurrent = 0;
      _downloadTotal = selectedCount;
    });

    try {
      final saved = await _downloadService.downloadSelectedImages(
        post: _currentPost!,
        onProgress: (cur, tot) {
          setState(() {
            _downloadCurrent = cur;
            _downloadTotal = tot;
          });
        },
      );

      _showToast('✅ Đã lưu thành công $saved ảnh vào Bộ sưu tập!');
    } catch (e) {
      _showToast('Lỗi: ${e.toString().replaceAll('Exception: ', '')}');
    } finally {
      setState(() {
        _isDownloading = false;
      });
    }
  }

  void _showToast(String msg) {
    Fluttertoast.showToast(
      msg: msg,
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.BOTTOM,
      backgroundColor: AppTheme.cardHover,
      textColor: AppTheme.textMain,
      fontSize: 13.0,
    );
  }

  // ── Toggle chọn tất cả ──────────────────────────────────────────────────────
  void _toggleSelectAll(bool? val) {
    if (_currentPost == null) return;
    setState(() {
      final select = val ?? true;
      for (var img in _currentPost!.images) {
        img.isSelected = select;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.tiktokRed.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.tiktokRed.withOpacity(0.4)),
              ),
              child: const Icon(Icons.music_note, color: AppTheme.tiktokRed, size: 18),
            ),
            const SizedBox(width: 8),
            RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                children: [
                  TextSpan(text: 'TIKTOK ', style: TextStyle(color: Colors.white)),
                  TextSpan(text: 'PHOTO DL', style: TextStyle(color: AppTheme.tiktokRed)),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildInputCard(),
                    const SizedBox(height: 16),
                    if (_isLoading) _buildLoadingWidget(),
                    if (_errorMessage != null) _buildErrorWidget(),
                    if (_currentPost != null) _buildPhotosSection(),
                    if (!_isLoading && _errorMessage == null && _currentPost == null)
                      _buildIdleWidget(),
                  ],
                ),
              ),
            ),
            _buildFooter(),
          ],
        ),
      ),
      bottomNavigationBar: _currentPost != null ? _buildBottomActionBar() : null,
    );
  }

  // ── Input Box Widget ────────────────────────────────────────────────────────
  Widget _buildInputCard() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _urlController,
                  style: const TextStyle(fontSize: 13, color: AppTheme.textMain),
                  decoration: InputDecoration(
                    hintText: 'Dán link TikTok (tiktok.com/@.../photo/...)',
                    hintStyle: const TextStyle(color: AppTheme.textDim, fontSize: 12),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    prefixIcon: const Icon(Icons.link, color: AppTheme.textDim, size: 20),
                    suffixIcon: _urlController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close, size: 16, color: AppTheme.textDim),
                            onPressed: () {
                              setState(() {
                                _urlController.clear();
                              });
                            },
                          )
                        : null,
                  ),
                  onSubmitted: (_) => _fetchPhotos(),
                ),
              ),
              const SizedBox(width: 6),
              ElevatedButton(
                onPressed: _pasteFromClipboard,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.cardHover,
                  foregroundColor: AppTheme.textMain,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: const BorderSide(color: AppTheme.border),
                  ),
                ),
                child: const Text('Dán', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 42,
            child: ElevatedButton.icon(
              onPressed: _isLoading ? null : _fetchPhotos,
              icon: const Icon(Icons.search, size: 18),
              label: const Text(
                'Tìm tất cả ảnh',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.tiktokRed,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                elevation: 4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Photos Gallery Widget ───────────────────────────────────────────────────
  Widget _buildPhotosSection() {
    final post = _currentPost!;
    final total = post.images.length;
    final selectedCount = post.images.where((img) => img.isSelected).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Post summary header
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppTheme.cardBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: AppTheme.tiktokRed.withOpacity(0.2),
                    child: const Text('@', style: TextStyle(color: AppTheme.tiktokRed, fontSize: 11)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${post.authorName} (@${post.author})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.tiktokCyan.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '$total ảnh',
                      style: const TextStyle(
                        color: AppTheme.tiktokCyan,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              if (post.title.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  post.title,
                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Select All Bar
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Checkbox(
                  value: selectedCount == total,
                  activeColor: AppTheme.tiktokRed,
                  onChanged: _toggleSelectAll,
                ),
                const Text('Chọn tất cả', style: TextStyle(fontSize: 13)),
              ],
            ),
            Text(
              '$selectedCount / $total đã chọn',
              style: const TextStyle(color: AppTheme.textDim, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Grid Views
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 1,
          ),
          itemCount: post.images.length,
          itemBuilder: (context, index) {
            final img = post.images[index];
            return GestureDetector(
              onTap: () {
                setState(() {
                  img.isSelected = !img.isSelected;
                });
              },
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: CachedNetworkImage(
                      imageUrl: img.url,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        color: AppTheme.cardHover,
                        child: const Center(
                          child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppTheme.tiktokRed,
                            ),
                          ),
                        ),
                      ),
                      errorWidget: (context, url, error) => Container(
                        color: AppTheme.cardHover,
                        child: const Icon(Icons.broken_image, color: AppTheme.textDim),
                      ),
                    ),
                  ),
                  // Border overlay when selected
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: img.isSelected ? AppTheme.tiktokRed : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  // Index tag
                  Positioned(
                    top: 4,
                    left: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.65),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '#${index + 1}',
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  // Check icon
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      width: 18,
                      height: 18,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: img.isSelected ? AppTheme.tiktokRed : Colors.black45,
                        border: Border.all(color: Colors.white70, width: 1),
                      ),
                      child: img.isSelected
                          ? const Icon(Icons.check, size: 12, color: Colors.white)
                          : null,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  // ── Bottom Action Bar (Download Button) ──────────────────────────────────────
  Widget _buildBottomActionBar() {
    final selectedCount = _currentPost?.images.where((img) => img.isSelected).length ?? 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: AppTheme.cardBg,
        border: Border(top: BorderSide(color: AppTheme.border)),
      ),
      child: SafeArea(
        child: SizedBox(
          height: 48,
          child: ElevatedButton.icon(
            onPressed: _isDownloading || selectedCount == 0 ? null : _startDownload,
            icon: _isDownloading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.file_download, size: 20),
            label: Text(
              _isDownloading
                  ? 'Đang lưu $_downloadCurrent/$_downloadTotal ảnh...'
                  : 'Tải $selectedCount ảnh vào Thư viện',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.tiktokRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ),
      ),
    );
  }

  // ── State Widgets (Loading, Error, Idle) ─────────────────────────────────────
  Widget _buildLoadingWidget() {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              color: AppTheme.tiktokRed,
            ),
          ),
          SizedBox(height: 20),
          Text(
            'Đang trích xuất ảnh không logo...',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          SizedBox(height: 4),
          Text(
            'Chất lượng ảnh gốc chuẩn HD từ TikTok CDN',
            style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.tiktokRed.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.tiktokRed.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.error_outline, color: AppTheme.tiktokRed, size: 36),
          const SizedBox(height: 8),
          const Text(
            'Không tải được ảnh',
            style: TextStyle(color: AppTheme.tiktokRed, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 4),
          Text(
            _errorMessage ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _fetchPhotos,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: AppTheme.border),
            ),
            child: const Text('Thử lại'),
          ),
        ],
      ),
    );
  }

  Widget _buildIdleWidget() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 50),
      child: Column(
        children: [
          Icon(Icons.photo_library_outlined, size: 64, color: AppTheme.textDim.withOpacity(0.4)),
          const SizedBox(height: 14),
          const Text(
            'Sẵn sàng tải ảnh TikTok',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 6),
          const Text(
            'Dán đường link bài ảnh TikTok bất kỳ\nvào ô bên trên và nhấn Tìm tất cả ảnh',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      alignment: Alignment.center,
      child: const Text(
        'JiChangWook - Wook • @J2TeamDev Telegram',
        style: TextStyle(fontSize: 11, color: AppTheme.textDim),
      ),
    );
  }
}
