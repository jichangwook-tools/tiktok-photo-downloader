// service-worker.js — TikTok Photo Downloader Background Service Worker
// © JiChangWook · Wook @J2TeamDev · Telegram

'use strict';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_PHOTO_INFO') {
    getPhotoInfoUniversal(message.url)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message || 'Lỗi không xác định khi lấy ảnh.' }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'DOWNLOAD_IMAGE') {
    downloadImage(message.url, message.filename)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'OPEN_FULL_TAB') {
    const extUrl = chrome.runtime.getURL('popup/popup.html?tab=1');
    chrome.tabs.create({ url: extUrl, active: true })
      .then(tab => sendResponse({ success: true, tabId: tab.id }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ── Universal Photo Info Resolver (Multi-Tier) ─────────────────────────────────
async function getPhotoInfoUniversal(rawUrl) {
  const cleanUrl = extractTikTokUrl(rawUrl);
  if (!cleanUrl || !cleanUrl.includes('tiktok.com')) {
    throw new Error('Link không hợp lệ. Cần link TikTok (vd: vt.tiktok.com/... hoặc tiktok.com/@user/photo/...)');
  }

  const postId = extractPostId(cleanUrl);
  const author = extractAuthor(cleanUrl) || 'tiktok';
  const canonicalUrl = postId ? `https://www.tiktok.com/@${author}/photo/${postId}` : cleanUrl;

  // ── Tier 1: Kiểm tra các tab TikTok đang mở trên trình duyệt ─────────────────
  try {
    const tabs = await chrome.tabs.query({ url: ['https://*.tiktok.com/*', 'https://tiktok.com/*'] });
    const matchingTab = tabs.find(t => t.url && t.url.includes(postId));
    if (matchingTab && matchingTab.id) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: matchingTab.id },
        func: extractDataFromOpenPage,
        args: [postId]
      });
      const tabData = results?.[0]?.result;
      if (tabData && tabData.success && tabData.images?.length > 0) {
        return tabData;
      }
    }
  } catch (e) {
    console.warn('[Tier 1 Tab Check Failed]', e);
  }

  // ── Tier 2: TikWM Dedicated Photo API (Cực nhanh 0.3s, không dính logo, full HD) ───
  try {
    const apiRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(canonicalUrl)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json && json.code === 0 && json.data) {
        const item = json.data;
        const images = (item.images || []).map((imgUrl, idx) => ({
          url: imgUrl,
          index: idx
        }));

        if (images.length > 0) {
          return {
            success: true,
            postId,
            author: item.author?.unique_id || author,
            authorName: item.author?.nickname || author,
            title: item.title || '',
            images,
            source: 'tikwm'
          };
        }
      }
    }
  } catch (e) {
    console.warn('[Tier 2 TikWM API Failed]', e);
  }

  // ── Tier 3: Fetch SSR HTML trực tiếp ──────────────────────────────────────────
  try {
    const htmlRes = await fetch(canonicalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const extracted = parseHtmlForImages(html, postId, author);
      if (extracted && extracted.success && extracted.images?.length > 0) {
        return extracted;
      }
    }
  } catch (e) {
    console.warn('[Tier 3 SSR Fetch Failed]', e);
  }

  // ── Tier 4: Fallback mở tab song song kiểm tra ──────────────────────────────
  try {
    const tabExtracted = await fetchViaTemporaryTab(canonicalUrl, postId);
    if (tabExtracted && tabExtracted.success) {
      return tabExtracted;
    }
  } catch (e) {
    console.warn('[Tier 4 Tab Fallback Failed]', e);
  }

  throw new Error('Không thể tìm thấy ảnh từ link này. Vui lòng kiểm tra lại link bài đăng hoặc mở bài đăng trên TikTok rồi thử lại.');
}

// ── In-Tab Extractor (Runs inside open TikTok page) ───────────────────────────
function extractDataFromOpenPage(targetPostId) {
  const pathname = window.location.pathname;
  const currentPostId = (pathname.match(/\/photo\/(\d+)/) || [])[1] || targetPostId;
  const authorMatch = pathname.match(/@([^/?#]+)/);
  const author = authorMatch ? authorMatch[1] : 'tiktok';

  // 1. Check window.__UNIVERSAL_DATA_FOR_REHYDRATION__
  try {
    const scriptEl = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    const raw = scriptEl?.textContent || (window.__UNIVERSAL_DATA_FOR_REHYDRATION__ ? JSON.stringify(window.__UNIVERSAL_DATA_FOR_REHYDRATION__) : null);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const scope = parsed?.['__DEFAULT_SCOPE__'] || {};
      const detail = scope['webapp.video-detail']?.itemInfo?.itemStruct;
      if (detail && detail.imagePost?.images?.length > 0) {
        const urls = detail.imagePost.images.map((img, i) => ({
          url: img.imageURL?.urlList?.[0] || img.displayImage?.urlList?.[0],
          index: i
        })).filter(x => Boolean(x.url));

        if (urls.length > 0) {
          return {
            success: true,
            postId: currentPostId,
            author: detail.author?.uniqueId || author,
            title: detail.desc || '',
            images: urls,
            source: 'rehydration'
          };
        }
      }
    }
  } catch (e) {}

  // 2. Check JSON-LD
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of ldScripts) {
    try {
      const data = JSON.parse(s.textContent);
      if (data['@type'] === 'SocialMediaPosting' && Array.isArray(data.image) && data.image.length > 0) {
        return {
          success: true,
          postId: currentPostId,
          author: data.author?.alternateName || data.author?.name || author,
          title: data.headline || '',
          images: data.image.map((img, i) => ({
            url: typeof img === 'string' ? img : img.url,
            index: i
          })),
          source: 'json-ld'
        };
      }
    } catch (e) {}
  }

  // 3. Check rendered images
  const found = new Map();
  document.querySelectorAll('img').forEach(img => {
    const src = img.src || '';
    if (!src || src.includes('userId=') || src.includes('location=2')) return;
    if (img.naturalWidth > 150 && (src.includes('photomode-image') || src.includes('tiktokcdn') || src.includes('api/img'))) {
      found.set(src, img.naturalWidth);
    }
  });

  if (found.size > 0) {
    return {
      success: true,
      postId: currentPostId,
      author,
      title: document.title,
      images: Array.from(found.keys()).map((url, i) => ({ url, index: i })),
      source: 'dom-images'
    };
  }

  return { success: false };
}

// ── HTML Parser for SSR ──────────────────────────────────────────────────────
function parseHtmlForImages(html, postId, author) {
  // Check Rehydration JSON
  const rehydMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i);
  if (rehydMatch) {
    try {
      const data = JSON.parse(rehydMatch[1]);
      const scope = data?.['__DEFAULT_SCOPE__'] || {};
      const detail = scope['webapp.video-detail']?.itemInfo?.itemStruct;
      if (detail && detail.imagePost?.images?.length > 0) {
        const urls = detail.imagePost.images.map((img, i) => ({
          url: img.imageURL?.urlList?.[0] || img.displayImage?.urlList?.[0],
          index: i
        })).filter(x => Boolean(x.url));

        if (urls.length > 0) {
          return {
            success: true,
            postId,
            author: detail.author?.uniqueId || author,
            title: detail.desc || '',
            images: urls
          };
        }
      }
    } catch (e) {}
  }

  // Check SocialMediaPosting
  const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (ldMatch) {
    for (const tag of ldMatch) {
      try {
        const content = tag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
        const data = JSON.parse(content);
        if (data['@type'] === 'SocialMediaPosting' && Array.isArray(data.image) && data.image.length > 0) {
          return {
            success: true,
            postId,
            author: data.author?.alternateName || data.author?.name || author,
            title: data.headline || '',
            images: data.image.map((img, i) => ({
              url: typeof img === 'string' ? img : img.url,
              index: i
            }))
          };
        }
      } catch (e) {}
    }
  }

  return null;
}

// ── Temporary Tab Fallback ────────────────────────────────────────────────────
async function fetchViaTemporaryTab(pageUrl, postId) {
  let tab = null;
  try {
    tab = await chrome.tabs.create({ url: pageUrl, active: false });
    await new Promise(res => {
      const timeout = setTimeout(res, 8000);
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          setTimeout(res, 1200);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractDataFromOpenPage,
      args: [postId]
    });
    return results?.[0]?.result;
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

function extractTikTokUrl(text) {
  const m = (text || '').match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?tiktok\.com\/[^\s]+/i);
  return m ? m[0] : (text || '').trim();
}

function extractPostId(url) {
  const m = (url || '').match(/\/(?:photo|video)\/(\d+)/);
  return m ? m[1] : null;
}

function extractAuthor(url) {
  const m = (url || '').match(/@([^/?#]+)/);
  return m ? m[1] : null;
}

// ── Download Image ────────────────────────────────────────────────────────────
async function downloadImage(url, filename) {
  const downloadId = await chrome.downloads.download({
    url,
    filename,
    saveAs: false,
    conflictAction: 'uniquify'
  });
  return { success: true, downloadId };
}
