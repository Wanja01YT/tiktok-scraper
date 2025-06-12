console.log("✅ TikTok content script loaded!");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'scrape') {
      scrapeComments(); // Run the full logic on user interaction
    }
  });
  
  async function scrapeComments() {
    function copy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  
    var commentsDivXPath = '//div[contains(@class, "DivCommentListContainer")]';
            var allCommentsXPath = '//div[contains(@class, "DivCommentContentContainer")]';
        
            var publisherProfileUrlXPath = '//span[contains(@class, "SpanUniqueId")]';
            var nicknameAndTimePublishedAgoXPath = '//span[contains(@class, "SpanOtherInfos")]';
        
            var likesCommentsSharesXPath = "//strong[contains(@class, 'StrongText')]";
            var postUrlXPath = '//div[contains(@class, "CopyLinkText")]'
            var descriptionXPath = '//h4[contains(@class, "H4Link")]/preceding-sibling::div'
        
            function getElementsByXPath(xpath, parent) {
                let results = [];
                let query = document.evaluate(xpath, parent || document,
                    null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
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
        
            function getNickname(comment) {
                return getElementsByXPath('./div[1]/a', comment)[0].outerText;
            }
        
            function formatDate(strDate) {
                if (typeof strDate !== 'undefined' && strDate !== null) {
                    f = strDate.split('-');
                    if (f.length == 1) return strDate;
                    if (f.length == 2) return f[1] + '-' + f[0] + '-' + (new Date().getFullYear());
                    if (f.length == 3) return f[2] + '-' + f[1] + '-' + f[0];
                    return 'Malformed date';
                } else return 'No date';
            }
        
            function extractNumericStats() {
                var strongTags = getElementsByXPath(likesCommentsSharesXPath);
                let likesCommentsShares = parseInt(strongTags[(strongTags.length - 3)]?.outerText) ? strongTags.slice(-3) : strongTags.slice(-2);
                return likesCommentsShares;
            }
        
            function csvFromComment(comment) {
                let nickname = getNickname(comment);
                let user = getElementsByXPath('./a', comment)[0]['href'].split('?')[0].split('/')[3].slice(1);
                let commentText = getElementsByXPath('./div[1]/p', comment)[0].outerText;
                let timeCommentedAgo = formatDate(getElementsByXPath('./div[1]/p[2]/span', comment)[0].outerText);
                let commentLikesCount = getElementsByXPath('./div[2]', comment)[0].outerText;
                let pic = getElementsByXPath('./a/span/img', comment)[0] ? getElementsByXPath('./a/span/img', comment)[0]['src'] : "N/A";
              
                // Extract UID from comment text
                let uidMatch = commentText.match(/\b\d{8,9}\b/);
                let uid = uidMatch ? uidMatch[0] : "N/A";
              
                return quoteString(nickname) + ',' + quoteString(user) + ',' + 'https://www.tiktok.com/@' + user + ','
                  + quoteString(commentText) + ',' + timeCommentedAgo + ',' + commentLikesCount + ',' + quoteString(pic) + ',' + quoteString(uid);
              }
              
            
            console.log(getElementsByXPath(allCommentsXPath)); // See if anything is returned


            // Loading 1st level comments
            var loadingCommentsBuffer = 30;
            var numOfcommentsBeforeScroll = getAllComments().length;
            while (loadingCommentsBuffer > 0) {
                let allComments = getAllComments();
let lastComment = allComments[allComments.length - 1];
if (lastComment) {
  lastComment.scrollIntoView(false);
}
        
                let numOfcommentsAftScroll = getAllComments().length;
        
                if (numOfcommentsAftScroll !== numOfcommentsBeforeScroll) {
                    loadingCommentsBuffer = 15;
                } else {
                    let commentsDiv = getElementsByXPath(commentsDivXPath)[0];
if (commentsDiv) {
  commentsDiv.scrollIntoView(false);
}
                    loadingCommentsBuffer--;
                }
                numOfcommentsBeforeScroll = numOfcommentsAftScroll;
                console.log('Loading 1st level comment number ' + numOfcommentsAftScroll);
                chrome.runtime.sendMessage({ type: 'progress', count: numOfcommentsAftScroll });
                await new Promise(r => setTimeout(r, 300));
            }
            console.log('Opened all 1st level comments');
        
            // Reading and compiling CSV
            var comments = getAllComments();
            var publisherProfileUrl = getElementsByXPath(publisherProfileUrlXPath)[0].outerText;
            var nicknameAndTimePublishedAgo = getElementsByXPath(nicknameAndTimePublishedAgoXPath)[0].outerText.replaceAll('\n', ' ').split(' · ');
            var url = window.location.href.split('?')[0];
            var likesCommentsShares = extractNumericStats();
            var likes = likesCommentsShares[0]?.outerText ?? "N/A";
            var totalComments = likesCommentsShares[1]?.outerText ?? "N/A";
            var shares = likesCommentsShares[2]?.outerText ?? "N/A";
            var commentNumberDifference = Math.abs(parseInt(totalComments) - comments.length);
        
            var csv = 'Now,' + Date() + '\n';
            csv += 'Post URL,' + url + '\n';
            csv += 'Publisher Nickname,' + nicknameAndTimePublishedAgo[0] + '\n';
            csv += 'Publisher @,' + publisherProfileUrl + '\n';
            csv += 'Publisher URL,https://www.tiktok.com/@' + publisherProfileUrl + '\n';
            csv += 'Publish Time,' + formatDate(nicknameAndTimePublishedAgo[1]) + '\n';
            csv += 'Post Likes,' + likes + '\n';
            csv += 'Post Shares,' + shares + '\n';
            csv += 'Description,' + quoteString(getElementsByXPath(descriptionXPath)[0].outerText) + '\n';
            csv += 'Number of 1st level comments,' + comments.length + '\n';
            csv += '"Total Comments (actual, rendered)",' + comments.length + '\n';
            csv += '"Total Comments (TikTok reported)",' + totalComments + '\n';
            csv += 'Difference,' + commentNumberDifference + '\n';
            csv += 'Comment Number (ID),Nickname,User @,User URL,Comment Text,Time,Likes,Profile Picture URL,UID\n';
        
            for (let i = 0; i < comments.length; i++) {
                csv += (i + 1) + ',' + csvFromComment(comments[i]) + '\n';
            }
        
            console.log('CSV copied to clipboard!');
            copy(csv);
chrome.runtime.sendMessage({ type: 'done', csv });
  }
  