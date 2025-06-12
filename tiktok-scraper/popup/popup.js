document.addEventListener('DOMContentLoaded', () => {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const status = document.getElementById('status');
  
    let currentCount = 0;
    let scrapingFinished = false;
    let scrapedCsv = "";
  
    scrapeBtn.addEventListener('click', async () => {
      scrapeBtn.disabled = true;
      scrapeBtn.textContent = 'Scraping...';
      status.textContent = 'Scraped 0 comments';
  
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
      // Listen for progress updates
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'progress') {
          currentCount = msg.count;
          status.textContent = `Scraped ${currentCount} comment${currentCount !== 1 ? 's' : ''}`;
        }
  
        if (msg.type === 'done') {
            scrapingFinished = true;
            scrapedCsv = msg.csv; // Store the CSV text
            scrapeBtn.textContent = 'Scraping finished';
            scrapeBtn.classList.remove('btn-secondary');
            scrapeBtn.classList.add('btn-dark');
            status.innerHTML = `Scraped ${currentCount} comment${currentCount !== 1 ? 's' : ''}<br>Comments saved to clipboard`;
          
            // Prompt XLSX download
            convertCsvToXlsx(scrapedCsv);
          }          
      });
  
      // Tell the content script to begin
      chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
    });
  });
  
  function convertCsvToXlsx(csvText) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.sheet_to_json(
      XLSX.read(csvText, { type: "string" }).Sheets.Sheet1,
      { header: 1, raw: false }
    );
  
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(worksheet), "Comments");
  
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  
    const blob = new Blob([wbout], { type: "application/octet-stream" });
  
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Comments_${timestamp}.xlsx`;
  
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  