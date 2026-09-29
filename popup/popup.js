// popup.js — TikTok Photo Downloader v1.2.1
// © JiChangWook · Wook @J2TeamDev · Telegram
'use strict';

// ── DOM Elements ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const elUrlInput           = $('url-input');
const elBtnPaste           = $('btn-paste');
const elBtnClearInput      = $('btn-clear-input');
const elBtnFetch           = $('btn-fetch');
const elCurrentTabPill     = $('current-tab-pill');
const elBtnUseTab          = $('btn-use-tab');
const elBtnOpenTab         = $('btn-open-tab');
const elFolderNameDisplay  = $('folder-name-display');
const elBtnPickFolder      = $('btn-pick-folder');

const elLoadingMsg         = $('loading-message');
const elErrorDetails       = $('error-details');
const elBtnRetry           = $('btn-retry');
const elBtnOpenLink        = $('btn-open-link');

const elPostAuthorName     = $('post-author-name');
const elPostBadge          = $('post-badge');
const elPostCaption        = $('post-caption');
const elBtnCopyLinks       = $('btn-copy-links');
const elCheckSelectAll     = $('check-select-all');
const elSelectionCounter   = $('selection-counter');
const elGalleryGrid        = $('gallery-grid');

const elProgressWrap       = $('download-progress-wrap');
const elProgressBar        = $('download-progress-bar');
const elProgressText       = $('progress-text');
const elProgressPct        = $('progress-pct');

const elSuccessBanner      = $('success-banner');
const elSuccessHeadline    = $('success-headline');
const elSuccessLocation    = $('success-dest');

const elBtnBackNew         = $('btn-back-new');
const elBtnDownloadMain    = $('btn-download-selected');
const elDownloadBtnText    = $('download-btn-text');

const views = {
  idle: $('state-idle'),
  loading: $('state-loading'),
  error: $('state-error'),
  photos: $('state-photos')
};

// ── State Variables ──────────────────────────────────────────────────────────
let currentPhotoData = null;
let selectedIndices = new Set();
let savedDirectoryHandle = null;
let currentTabPostUrl = null;
let lastAttemptedUrl = null;

// ── IndexedDB Helpers (Lưu Folder Handle qua các phiên) ────────────────────────
const IDB_NAME = 'TikTokPhotoDownloaderDB';
const IDB_STORE = 'handles';

function getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFolderHandleToIDB(handle) {
  try {
    const db = await getDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, 'chosenFolder');
  } catch (e) {
    console.warn('IDB Save error:', e);
  }
}

async function loadFolderHandleFromIDB() {
  try {
    const db = await getDB();
    return new Promise(res => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('chosenFolder');
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch (e) {
    return null;
  }
}

// ── View State Switcher ──────────────────────────────────────────────────────
function switchView(target) {
  Object.entries(views).forEach(([k, el]) => {
    if (el) el.classList.toggle('hidden', k !== target);
  });
}

function sanitizeName(str) {
  return (str || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 40).trim();
}

function extractPostId(url) {
  const m = (url || '').match(/\/photo\/(\d+)/);
  return m ? m[1] : null;
}

function extractAuthor(url) {
  const m = (url || '').match(/@([^/?#]+)/);
  return m ? m[1] : null;
}

// ── Check Full Tab Mode ──────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('tab') === '1') {
  document.body.classList.add('full-tab-mode');
  if (elBtnOpenTab) elBtnOpenTab.classList.add('hidden');
}

// ── Event: Mở Tab mới song song ──────────────────────────────────────────────
if (elBtnOpenTab) {
  elBtnOpenTab.addEventListener('click', () => {
    const extUrl = chrome.runtime.getURL('popup/popup.html?tab=1');
    chrome.tabs.create({ url: extUrl, active: true });
  });
}

// ── Folder Selection Handler ─────────────────────────────────────────────────
async function initFolder() {
  const handle = await loadFolderHandleFromIDB();
  if (handle) {
    try {
      const opts = { mode: 'readwrite' };
      if ((await handle.queryPermission(opts)) === 'granted' || (await handle.requestPermission(opts)) === 'granted') {
        savedDirectoryHandle = handle;
        updateFolderDisplay(handle.name, true);
        return;
      }
    } catch (e) {
      console.warn('Could not restore directory permission:', e);
    }
  }
  updateFolderDisplay('Downloads / TikTok Photos', false);
}

function updateFolderDisplay(name, isCustom) {
  elFolderNameDisplay.textContent = isCustom ? `📁 ${name}` : name;
  elBtnPickFolder.classList.toggle('selected', isCustom);
  elBtnPickFolder.querySelector('span').textContent = isCustom ? 'Đổi thư mục' : 'Chọn thư mục';
}

elBtnPickFolder.addEventListener('click', async () => {
  if (!window.showDirectoryPicker) {
    alert('Trình duyệt không hỗ trợ File System Access API. Ảnh sẽ lưu vào Downloads.');
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    savedDirectoryHandle = handle;
    await saveFolderHandleToIDB(handle);
    updateFolderDisplay(handle.name, true);
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('Directory Picker error:', e);
  }
});

// ── Input & Clipboard Controls ───────────────────────────────────────────────
elUrlInput.addEventListener('input', () => {
  elBtnClearInput.classList.toggle('hidden', !elUrlInput.value);
});

elUrlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleFetchTrigger();
});

elBtnClearInput.addEventListener('click', () => {
  elUrlInput.value = '';
  elBtnClearInput.classList.add('hidden');
  elUrlInput.focus();
});

elBtnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      elUrlInput.value = text.trim();
      elBtnClearInput.classList.remove('hidden');
      handleFetchTrigger();
    }
  } catch (err) {
    elUrlInput.focus();
  }
});

// ── Detect Currently Open TikTok Tab ─────────────────────────────────────────
async function detectActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && tab.url.includes('tiktok.com') && tab.url.includes('/photo/')) {
      currentTabPostUrl = tab.url;
      elCurrentTabPill.classList.remove('hidden');
      if (!elUrlInput.value) {
        elUrlInput.value = tab.url;
        elBtnClearInput.classList.remove('hidden');
      }
    }
  } catch (e) {}
}

elBtnUseTab.addEventListener('click', () => {
  if (currentTabPostUrl) {
    elUrlInput.value = currentTabPostUrl;
    elBtnClearInput.classList.remove('hidden');
    handleFetchTrigger();
  }
});

// ── CORE EXTRACTION: Multi-Tier in Popup (Direct & Instant) ───────────────────
async function extractPhotosDirectly(rawUrl) {
  const postId = extractPostId(rawUrl);
  if (!postId) {
    throw new Error('Link không hợp lệ. Vui lòng nhập link bài ảnh TikTok dạng: tiktok.com/@user/photo/...');
  }

  const author = extractAuthor(rawUrl) || 'tiktok';
  const canonicalUrl = `https://www.tiktok.com/@${author}/photo/${postId}`;

  // ── Strategy 1: Gọi TikWM API trực tiếp từ popup (0.3s, ảnh gốc full HD) ───
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(canonicalUrl)}`;
    const apiRes = await fetch(apiUrl, { method: 'GET' });
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json && json.code === 0 && json.data?.images?.length > 0) {
        const item = json.data;
        return {
          success: true,
          postId,
          author: item.author?.unique_id || author,
          authorName: item.author?.nickname || author,
          title: item.title || '',
          images: item.images.map((url, i) => ({ url, index: i })),
          source: 'tikwm'
        };
      }
    }
  } catch (e) {
    console.warn('[Popup] TikWM direct fetch failed:', e);
  }

  // ── Strategy 2: Đọc trực tiếp từ tab TikTok đang mở trên trình duyệt ─────────
  try {
    const tabs = await chrome.tabs.query({ url: ['https://*.tiktok.com/*', 'https://tiktok.com/*'] });
    const matchingTab = tabs.find(t => t.url && t.url.includes(postId));
    if (matchingTab && matchingTab.id) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: matchingTab.id },
        func: extractPhotosFromTikTokDom,
        args: [postId]
      });
      const tabData = results?.[0]?.result;
      if (tabData && tabData.success && tabData.images?.length > 0) {
        return tabData;
      }
    }
  } catch (e) {
    console.warn('[Popup] In-tab execution failed:', e);
  }

  // ── Strategy 3: Nhờ Background Service Worker hỗ trợ ────────────────────────
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'FETCH_PHOTO_INFO', url: rawUrl }, res => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res && res.success && res.images?.length > 0) {
        resolve(res);
      } else {
        reject(new Error(res?.error || 'Không tìm thấy ảnh nào trong bài đăng này.'));
      }
    });
  });
}

// ── In-Tab DOM Script (Inject vào tab TikTok) ──────────────────────────────────
function extractPhotosFromTikTokDom(targetPostId) {
  const pathname = window.location.pathname;
  const currentPostId = (pathname.match(/\/photo\/(\d+)/) || [])[1] || targetPostId;
  const authorMatch = pathname.match(/@([^/?#]+)/);
  const author = authorMatch ? authorMatch[1] : 'tiktok';

  // 1. Rehydration data
  try {
    const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    const raw = el?.textContent || (window.__UNIVERSAL_DATA_FOR_REHYDRATION__ ? JSON.stringify(window.__UNIVERSAL_DATA_FOR_REHYDRATION__) : null);
    if (raw) {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const detail = data?.['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct;
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
            images: urls
          };
        }
      }
    }
  } catch (e) {}

  // 2. JSON-LD SocialMediaPosting
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of ldScripts) {
    try {
      const d = JSON.parse(s.textContent);
      if (d['@type'] === 'SocialMediaPosting' && Array.isArray(d.image) && d.image.length > 0) {
        return {
          success: true,
          postId: currentPostId,
          author: d.author?.alternateName || d.author?.name || author,
          title: d.headline || '',
          images: d.image.map((img, i) => ({
            url: typeof img === 'string' ? img : img.url,
            index: i
          }))
        };
      }
    } catch (e) {}
  }

  // 3. Rendered images
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
      images: Array.from(found.keys()).map((url, i) => ({ url, index: i }))
    };
  }

  return { success: false };
}

// ── Core Fetch Flow ──────────────────────────────────────────────────────────
async function handleFetchTrigger() {
  const rawUrl = elUrlInput.value.trim();
  if (!rawUrl) {
    showErrorView('Vui lòng dán link bài đăng ảnh TikTok.');
    return;
  }

  lastAttemptedUrl = rawUrl;
  switchView('loading');
  elLoadingMsg.textContent = 'Đang trích xuất ảnh không logo...';
  elProgressWrap.classList.add('hidden');
  elSuccessBanner.classList.add('hidden');

  try {
    const data = await extractPhotosDirectly(rawUrl);
    displayPhotos(data);
  } catch (err) {
    showErrorView(err.message || 'Không tìm thấy dữ liệu ảnh. Vui lòng kiểm tra lại link bài đăng.');
  }
}

elBtnFetch.addEventListener('click', handleFetchTrigger);
elBtnRetry.addEventListener('click', handleFetchTrigger);

elBtnBackNew.addEventListener('click', () => {
  currentPhotoData = null;
  selectedIndices.clear();
  switchView('idle');
  elUrlInput.focus();
});

function showErrorView(msg) {
  elErrorDetails.textContent = msg;
  switchView('error');
  if (lastAttemptedUrl && lastAttemptedUrl.includes('tiktok.com')) {
    elBtnOpenLink.classList.remove('hidden');
    elBtnOpenLink.onclick = () => chrome.tabs.create({ url: lastAttemptedUrl });
  } else {
    elBtnOpenLink.classList.add('hidden');
  }
}

// ── Render Photos Grid ───────────────────────────────────────────────────────
function displayPhotos(data) {
  currentPhotoData = data;
  const { images, author, authorName, title, postId } = data;

  elPostAuthorName.textContent = authorName ? `${authorName} (@${author})` : `@${author}`;
  elPostBadge.textContent = `${images.length} ảnh gốc`;
  elPostCaption.textContent = title ? title.replace(/#\S+/g, '').trim() || title : `Bài đăng ảnh ID: ${postId}`;

  selectedIndices = new Set(images.map((_, i) => i));

  elGalleryGrid.innerHTML = '';
  images.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'grid-photo-card selected';

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = `Ảnh ${index + 1}`;
    img.loading = 'lazy';
    img.onerror = () => { img.style.opacity = '0.3'; };

    const tag = document.createElement('span');
    tag.className = 'photo-index-tag';
    tag.textContent = `#${index + 1}`;

    const checkIndicator = document.createElement('div');
    checkIndicator.className = 'photo-check-indicator';

    card.append(img, tag, checkIndicator);

    card.addEventListener('click', () => {
      togglePhotoSelection(index, card);
    });

    elGalleryGrid.appendChild(card);
  });

  updateSelectionState();
  switchView('photos');
}

function togglePhotoSelection(idx, cardEl) {
  if (selectedIndices.has(idx)) {
    selectedIndices.delete(idx);
    cardEl.classList.remove('selected');
  } else {
    selectedIndices.add(idx);
    cardEl.classList.add('selected');
  }
  updateSelectionState();
}

function updateSelectionState() {
  const total = currentPhotoData?.images?.length || 0;
  const count = selectedIndices.size;

  elSelectionCounter.textContent = `${count} / ${total} đã chọn`;
  elCheckSelectAll.checked = count === total && total > 0;
  elBtnDownloadMain.disabled = count === 0;

  if (count === total) {
    elDownloadBtnText.textContent = `Tải tất cả (${count} ảnh)`;
  } else if (count > 0) {
    elDownloadBtnText.textContent = `Tải ${count} ảnh đã chọn`;
  } else {
    elDownloadBtnText.textContent = `Chưa chọn ảnh nào`;
  }
}

elCheckSelectAll.addEventListener('change', () => {
  const total = currentPhotoData?.images?.length || 0;
  const cards = elGalleryGrid.querySelectorAll('.grid-photo-card');

  if (elCheckSelectAll.checked) {
    selectedIndices = new Set([...Array(total)].keys());
    cards.forEach(c => c.classList.add('selected'));
  } else {
    selectedIndices.clear();
    cards.forEach(c => c.classList.remove('selected'));
  }
  updateSelectionState();
});

elBtnCopyLinks.addEventListener('click', () => {
  if (!currentPhotoData?.images) return;
  const urls = currentPhotoData.images.map(img => img.url).join('\n');
  navigator.clipboard.writeText(urls).then(() => {
    const originalText = elBtnCopyLinks.innerHTML;
    elBtnCopyLinks.innerHTML = '✓ Đã chép!';
    setTimeout(() => { elBtnCopyLinks.innerHTML = originalText; }, 1800);
  });
});

// ── Download Execution Flow ──────────────────────────────────────────────────
elBtnDownloadMain.addEventListener('click', async () => {
  if (!currentPhotoData || selectedIndices.size === 0) return;

  const { images, postId, author } = currentPhotoData;
  const selectedList = [...selectedIndices].sort((a, b) => a - b);
  const totalToDownload = selectedList.length;

  elProgressWrap.classList.remove('hidden');
  elSuccessBanner.classList.add('hidden');
  elBtnDownloadMain.disabled = true;
  elBtnBackNew.disabled = true;

  let successCount = 0;
  let failCount = 0;

  const safeAuthor = sanitizeName(author);
  const subFolderName = `${safeAuthor}_${postId}`;

  if (savedDirectoryHandle) {
    // ── Save Direct to Custom Directory ──────────────────────────────────────
    let targetDir = savedDirectoryHandle;
    try {
      targetDir = await savedDirectoryHandle.getDirectoryHandle(subFolderName, { create: true });
    } catch (e) {
      console.warn('Could not create subfolder, saving to root handle:', e);
    }

    for (let i = 0; i < totalToDownload; i++) {
      const idx = selectedList[i];
      const imgObj = images[idx];
      const filename = `tiktok_${safeAuthor}_${postId}_${String(idx + 1).padStart(2, '0')}.jpg`;

      try {
        const resp = await fetch(imgObj.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();

        const fileHandle = await targetDir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        successCount++;
      } catch (err) {
        console.warn('Direct file write failed, trying chrome.downloads fallback:', err);
        try {
          await downloadViaChrome(`TikTok Photos/${subFolderName}/${filename}`, imgObj.url);
          successCount++;
        } catch {
          failCount++;
        }
      }

      updateProgressBar(i + 1, totalToDownload);
      await new Promise(r => setTimeout(r, 100));
    }

  } else {
    // ── Save via chrome.downloads ────────────────────────────────────────────
    for (let i = 0; i < totalToDownload; i++) {
      const idx = selectedList[i];
      const imgObj = images[idx];
      const filename = `TikTok Photos/${subFolderName}/tiktok_${safeAuthor}_${postId}_${String(idx + 1).padStart(2, '0')}.jpg`;

      try {
        await downloadViaChrome(filename, imgObj.url);
        successCount++;
      } catch (err) {
        console.warn('Download error:', err);
        failCount++;
      }

      updateProgressBar(i + 1, totalToDownload);
      await new Promise(r => setTimeout(r, 150));
    }
  }

  elBtnDownloadMain.disabled = false;
  elBtnBackNew.disabled = false;

  elSuccessHeadline.textContent = `Tải thành công ${successCount}/${totalToDownload} ảnh!`;
  elSuccessLocation.textContent = savedDirectoryHandle
    ? `📁 Thư mục: ${savedDirectoryHandle.name} / ${subFolderName}`
    : `📁 Downloads / TikTok Photos / ${subFolderName}`;
  elSuccessBanner.classList.remove('hidden');

  setTimeout(() => {
    elProgressWrap.classList.add('hidden');
    elProgressBar.style.width = '0%';
  }, 4000);
});

function downloadViaChrome(filename, url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_IMAGE',
      url,
      filename
    }, res => {
      if (res && res.success) resolve(res);
      else reject(new Error(res?.error || 'Download failed'));
    });
  });
}

function updateProgressBar(current, total) {
  const pct = Math.round((current / total) * 100);
  elProgressBar.style.width = `${pct}%`;
  elProgressPct.textContent = `${pct}%`;
  elProgressText.textContent = `Đang tải: ${current}/${total} ảnh...`;
}

// ── Startup Initialization ───────────────────────────────────────────────────
(async () => {
  switchView('idle');
  await initFolder();
  await detectActiveTab();
})();
