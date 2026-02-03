console.log('✅ TikTok content script loaded!');

let __scrapeStopRequested = false;
let __scrapeIsRunning = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.action !== 'string') return;

  if (msg.action === 'stop') {
    __scrapeStopRequested = true;
    sendResponse({ ok: true });
    return;
  }

  if (msg.action === 'scrape') {
    if (__scrapeIsRunning) {
      // Ignore duplicate start requests
      sendResponse({ ok: false, reason: 'already_running' });
      return;
    }

    scrapeComments();
    sendResponse({ ok: true });
    return;
  }
});

async function scrapeComments() {
  __scrapeIsRunning = true;
  __scrapeStopRequested = false;

  // Swallow "Receiving end does not exist" when popup isn't listening
  function safeSendMessage(payload) {
    try {
      chrome.runtime.sendMessage(payload, () => {
        // Important: reading lastError prevents console spam
        void chrome.runtime.lastError;
      });
    } catch (_) {
      // ignore
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function copy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  const commentsDivXPath = '//div[contains(@class, "DivCommentListContainer")]';
  const allCommentsXPath = '//div[contains(@class, "DivCommentContentContainer")]';

  const publisherProfileUrlXPath = '//span[contains(@class, "SpanUniqueId")]';
  const nicknameAndTimePublishedAgoXPath = '//span[contains(@class, "SpanOtherInfos")]';

  const likesCommentsSharesXPath = "//strong[contains(@class, 'StrongText')]";
  const descriptionXPath = '//h4[contains(@class, "H4Link")]/preceding-sibling::div';

  function getElementsByXPath(xpath, parent) {
    let results = [];
    let query = document.evaluate(
      xpath,
      parent || document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let i = 0, length = query.snapshotLength; i < length; ++i) {
      results.push(query.snapshotItem(i));
    }
    return results;
  }

  function getAllComments() {
    return getElementsByXPath(allCommentsXPath);
  }

  function quoteString(s) {
    return '"' + String(s).replaceAll('"', '""') + '"';
  }

  function formatDate(strDate) {
    if (typeof strDate !== 'undefined' && strDate !== null) {
      let f = String(strDate).split('-');
      if (f.length == 1) return strDate;
      if (f.length == 2) return f[1] + '-' + f[0] + '-' + new Date().getFullYear();
      if (f.length == 3) return f[2] + '-' + f[1] + '-' + f[0];
      return 'Malformed date';
    } else return 'No date';
  }

  function extractNumericStats() {
    const strongTags = getElementsByXPath(likesCommentsSharesXPath);
    // Original logic preserved
    let likesCommentsShares = parseInt(strongTags[strongTags.length - 3]?.outerText)
      ? strongTags.slice(-3)
      : strongTags.slice(-2);
    return likesCommentsShares;
  }

  // Updated selectors based on your posted TikTok comment DOM
  function getNickname(comment) {
    const node =
      getElementsByXPath('.//span[starts-with(@data-e2e,"comment-username")]', comment)[0] ||
      getElementsByXPath('.//a[contains(@class,"StyledUserLinkName")]//span', comment)[0];
    return node ? node.outerText.trim() : 'N/A';
  }

  function csvFromComment(comment) {
    let nickname = getNickname(comment);

    // profile link is usually relative: "/@user..."
    const userLink =
      getElementsByXPath('.//a[starts-with(@href,"/@")]', comment)[0] ||
      getElementsByXPath('./a', comment)[0];

    let href = userLink ? userLink.getAttribute('href') || userLink.href || '' : '';
    let user = 'N/A';

    if (href) {
      try {
        href = new URL(href, window.location.href).pathname; // normalize
      } catch (_) {}
      const m = href.match(/\/@([^\/\?]+)/);
      if (m && m[1]) user = m[1];
    }

    // comment body (as seen in your sample)
    const commentTextNode = getElementsByXPath(
      './/div[starts-with(@data-e2e,"comment-level")]',
      comment
    )[0];

    let commentText = commentTextNode ? commentTextNode.outerText : 'N/A';
    commentText = String(commentText).replaceAll('\n', ' ').trim();

    // time
    const timeNode = getElementsByXPath(
      './/span[starts-with(@data-e2e,"comment-time")]',
      comment
    )[0];

    let timeCommentedAgo = formatDate(timeNode ? timeNode.outerText.trim() : undefined);

    // likes
    const likesNode = getElementsByXPath(
      './/span[starts-with(@data-e2e,"comment-like-count")]',
      comment
    )[0];

    let commentLikesCount = likesNode ? likesNode.outerText.trim() : '0';

    // avatar
    const imgNode = getElementsByXPath('./a//img', comment)[0] || getElementsByXPath('.//img', comment)[0];
    let pic = imgNode ? imgNode.getAttribute('src') || imgNode.src || 'N/A' : 'N/A';

    // Extract UID from comment text (unchanged)
    let uidMatch = String(commentText).match(/\b\d{8,9}\b/);
    let uid = uidMatch ? uidMatch[0] : 'N/A';

    return (
      quoteString(nickname) +
      ',' +
      quoteString(user) +
      ',' +
      'https://www.tiktok.com/@' +
      user +
      ',' +
      quoteString(commentText) +
      ',' +
      timeCommentedAgo +
      ',' +
      commentLikesCount +
      ',' +
      quoteString(pic) +
      ',' +
      quoteString(uid)
    );
  }

  try {
    const commentsDiv = getElementsByXPath(commentsDivXPath)[0] || null;

    // Start at top to capture from the beginning
    if (commentsDiv) {
      commentsDiv.scrollTop = 0;
      await sleep(200);
    }

    // Virtualization-proof accumulation
    const seenIds = new Set();
    const capturedRows = [];

    // Stop condition: no new IDs AND scrollHeight stable for a while
    let stableLoops = 0;
    const STABLE_LIMIT = 14;
    let lastScrollHeight = commentsDiv ? commentsDiv.scrollHeight : 0;

    while (stableLoops < STABLE_LIMIT && !__scrapeStopRequested) {
      const rendered = getAllComments();

      // collect newly seen comments from current viewport
      let newlyAdded = 0;
      for (const c of rendered) {
        if (__scrapeStopRequested) break;

        const cid = c?.getAttribute?.('id') || '';
        if (!cid) continue;

        if (!seenIds.has(cid)) {
          seenIds.add(cid);
          capturedRows.push(csvFromComment(c));
          newlyAdded++;
        }
      }

      // progress is based on unique captured, not rendered count
      console.log(`Loading 1st level comments: ${seenIds.size} unique (rendered ${rendered.length})`);
      safeSendMessage({ type: 'progress', count: seenIds.size });

      if (__scrapeStopRequested) break;

      // scroll down (prefer container scroll for virtual lists)
      if (commentsDiv) {
        commentsDiv.scrollTop = commentsDiv.scrollHeight;
      } else if (rendered.length) {
        rendered[rendered.length - 1].scrollIntoView(false);
      }

      await sleep(450);

      if (__scrapeStopRequested) break;

      // stability detection
      const currentHeight = commentsDiv ? commentsDiv.scrollHeight : lastScrollHeight;
      const heightUnchanged = currentHeight === lastScrollHeight;

      if (newlyAdded === 0 && heightUnchanged) {
        stableLoops++;
      } else {
        stableLoops = 0;
      }

      lastScrollHeight = currentHeight;
    }

    const wasStopped = __scrapeStopRequested;

    // ----------------------------
    // Build CSV from capturedRows
    // ----------------------------

    const publisherProfileUrl = getElementsByXPath(publisherProfileUrlXPath)[0]?.outerText ?? 'N/A';

    const nicknameAndTimePublishedAgoRaw =
      getElementsByXPath(nicknameAndTimePublishedAgoXPath)[0]?.outerText ?? 'N/A · N/A';

    const nicknameAndTimePublishedAgo = nicknameAndTimePublishedAgoRaw
      .replaceAll('\n', ' ')
      .split(' · ');

    const url = window.location.href.split('?')[0];

    const likesCommentsShares = extractNumericStats();
    const likes = likesCommentsShares[0]?.outerText ?? 'N/A';
    const totalComments = likesCommentsShares[1]?.outerText ?? 'N/A';
    const shares = likesCommentsShares[2]?.outerText ?? 'N/A';

    const commentNumberDifference = Math.abs((parseInt(totalComments) || 0) - capturedRows.length);

    let csv = 'Now,' + Date() + '\n';
    csv += 'Post URL,' + url + '\n';
    csv += 'Publisher Nickname,' + (nicknameAndTimePublishedAgo[0] ?? 'N/A') + '\n';
    csv += 'Publisher @,' + publisherProfileUrl + '\n';
    csv += 'Publisher URL,https://www.tiktok.com/@' + publisherProfileUrl + '\n';
    csv += 'Publish Time,' + formatDate(nicknameAndTimePublishedAgo[1]) + '\n';
    csv += 'Post Likes,' + likes + '\n';
    csv += 'Post Shares,' + shares + '\n';
    csv += 'Description,' + quoteString(getElementsByXPath(descriptionXPath)[0]?.outerText ?? 'N/A') + '\n';
    csv += 'Number of 1st level comments,' + capturedRows.length + '\n';
    csv += '"Total Comments (actual, captured)",' + capturedRows.length + '\n';
    csv += '"Total Comments (TikTok reported)",' + totalComments + '\n';
    csv += 'Difference,' + commentNumberDifference + '\n';
    if (wasStopped) {
      csv += 'Stopped Early,TRUE\n';
    }
    csv += 'Comment Number (ID),Nickname,User @,User URL,Comment Text,Time,Likes,Profile Picture URL,UID\n';

    for (let i = 0; i < capturedRows.length; i++) {
      csv += i + 1 + ',' + capturedRows[i] + '\n';
    }

    copy(csv);
    safeSendMessage({ type: 'done', csv, count: capturedRows.length, stopped: wasStopped });
  } finally {
    __scrapeIsRunning = false;
    __scrapeStopRequested = false;
  }
}
