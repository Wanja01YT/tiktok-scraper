document.addEventListener('DOMContentLoaded', () => {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');

  let currentCount = 0;
  let scraping = false;
  let activeTabId = null;
  let scrapedCsv = '';

  function setStopVisible(visible) {
    stopBtn.classList.toggle('d-none', !visible);
  }

  function setScrapeUiRunning() {
    scraping = true;
    currentCount = 0;
    scrapedCsv = '';

    scrapeBtn.disabled = true;
    scrapeBtn.textContent = 'Scraping...';
    scrapeBtn.classList.remove('btn-dark');
    scrapeBtn.classList.add('btn-secondary');

    stopBtn.disabled = false;
    stopBtn.textContent = 'Stop scraping';
    setStopVisible(true);

    status.textContent = 'Scraped 0 comments';
  }

  function setScrapeUiFinished({ stopped } = {}) {
    scraping = false;

    setStopVisible(false);

    scrapeBtn.textContent = stopped ? 'Scraping stopped' : 'Scraping finished';
    scrapeBtn.classList.remove('btn-secondary');
    scrapeBtn.classList.add('btn-dark');

    status.innerHTML = `Scraped ${currentCount} comment${currentCount !== 1 ? 's' : ''}<br><b>Comments saved as spreadsheet</b>`;
  }

  // Listen for progress/done updates from content.js
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'progress') {
      // Only update UI if a scrape is currently running
      if (!scraping) return;

      currentCount = msg.count;
      status.textContent = `Scraped ${currentCount} comment${currentCount !== 1 ? 's' : ''}`;
    }

    if (msg.type === 'done') {
      // Update count if content script supplies it (partial stop case)
      if (typeof msg.count === 'number') currentCount = msg.count;

      scrapedCsv = msg.csv || '';
      setScrapeUiFinished({ stopped: !!msg.stopped });

      if (scrapedCsv) {
        convertCsvToXlsx(scrapedCsv);
      }
    }
  });

  scrapeBtn.addEventListener('click', async () => {
    setScrapeUiRunning();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id ?? null;

    if (!activeTabId) {
      status.textContent = 'No active tab found.';
      setStopVisible(false);
      return;
    }

    // Tell the content script to begin
    chrome.tabs.sendMessage(activeTabId, { action: 'scrape' });
  });

  stopBtn.addEventListener('click', async () => {
    if (!scraping) return;

    stopBtn.disabled = true;
    stopBtn.textContent = 'Stopping...';
    status.textContent = `Stopping… (captured ${currentCount} so far)`;

    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { action: 'stop' });
    }
  });
});

function convertCsvToXlsx(csvText) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.sheet_to_json(
    XLSX.read(csvText, { type: 'string' }).Sheets.Sheet1,
    { header: 1, raw: false }
  );

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(worksheet), 'Comments');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `Comments_${timestamp}.xlsx`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
