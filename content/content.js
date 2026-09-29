// Content script - extracts photo data from TikTok photo pages

/**
 * Extract photo info from the JSON-LD structured data embedded in the page.
 * TikTok embeds a SocialMediaPosting schema with all image URLs and counts.
 */
function extractPhotoDataFromLD() {
  const ldScript = document.querySelector('script#SocialMediaPosting[type="application/ld+json"]');
  if (!ldScript) return null;

  try {
    const data = JSON.parse(ldScript.textContent);
    if (!data.image || !Array.isArray(data.image)) return null;

    return {
      images: data.image.map((img, i) => ({
        url: img.url,
        width: img.width?.value || img.width,
        height: img.height?.value || img.height,
        index: i
      })),
      title: data.headline || document.title,
      author: data.author?.alternateName || data.author?.name || 'tiktok',
      postId: extractPostId()
    };
  } catch (e) {
    return null;
  }
}

/**
 * Extract post ID from the current URL
 */
function extractPostId() {
  const match = window.location.pathname.match(/\/photo\/(\d+)/);
  return match ? match[1] : Date.now().toString();
}

/**
 * Fallback: Build image URLs from the TikTok API img endpoint
 * Pattern: https://www.tiktok.com/api/img/?itemId=<id>&location=3&aid=1988&index=<n>
 */
function buildApiImageUrls(postId, count) {
  const images = [];
  for (let i = 0; i < count; i++) {
    images.push({
      url: `https://www.tiktok.com/api/img/?itemId=${postId}&location=3&aid=1988&index=${i}`,
      index: i
    });
  }
  return images;
}

/**
 * Try to get actual CDN image URLs from the DOM (higher quality)
 * Looks for swiper/slideshow images
 */
function extractImagesFromDOM() {
  // Look for images in the photo swiper/carousel
  const selectors = [
    '[class*="PhotoSlide"] img',
    '[class*="photo-slide"] img',
    '[class*="SwipeItem"] img',
    '[class*="swipe-item"] img',
    'div[class*="DivPhotoContainer"] img',
    '[data-e2e="photo-swiper"] img',
    'picture img[src*="tiktokcdn"]',
    'img[src*="tiktokcdn"]'
  ];

  const found = new Set();
  const images = [];

  for (const selector of selectors) {
    try {
      const els = document.querySelectorAll(selector);
      els.forEach(img => {
        // Skip avatar/profile/logo images — they're small and square
        const src = img.src || img.dataset.src || '';
        if (!src || found.has(src)) return;

        // Filter out profile avatars
        if (src.includes('location=2') || src.includes('userId=')) return;
        if (img.width < 100 || img.height < 100) return;

        found.add(src);
        images.push({
          url: src,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          index: images.length
        });
      });
    } catch (e) {}
  }

  return images.length > 0 ? images : null;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PHOTO_INFO') {
    const info = getPhotoInfo();
    sendResponse(info);
  }
  return false;
});

function getPhotoInfo() {
  // Check if we're on a photo post
  const isPhotoPage = window.location.pathname.includes('/photo/');
  if (!isPhotoPage) {
    return { error: 'Trang này không phải bài đăng ảnh TikTok. Hãy mở bài đăng có dạng: tiktok.com/@username/photo/...' };
  }

  const postId = extractPostId();

  // Try JSON-LD first (most reliable, has all images listed)
  const ldData = extractPhotoDataFromLD();
  if (ldData && ldData.images.length > 0) {
    return {
      success: true,
      postId,
      title: ldData.title,
      author: ldData.author,
      images: ldData.images,
      source: 'json-ld'
    };
  }

  // Try DOM extraction
  const domImages = extractImagesFromDOM();
  if (domImages && domImages.length > 0) {
    return {
      success: true,
      postId,
      title: document.title,
      author: 'tiktok',
      images: domImages,
      source: 'dom'
    };
  }

  // Fallback: can't determine count, return error
  return {
    error: 'Không thể lấy thông tin ảnh. Hãy đảm bảo trang đã tải xong và thử lại.',
    postId
  };
}
