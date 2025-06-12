# TikTok Comment Scraper
A Chrome extension to scrape TikTok comments for giveaways and events, saving them as a downloadable XLSX spreadsheet.    
</p>

[![Static Badge](https://img.shields.io/badge/chromium-1.0-blue?logo=GoogleChrome)]()
![Static Badge](https://img.shields.io/badge/license-MIT-lightgrey)

## Usage and Limits
- **Installation**

   * Go to `chrome://extensions`
   * Enable **Developer Mode**
   * Click **"Load unpacked"** and select the extension folder

- **Using the Extension**

   * Open any TikTok video from an account page (e.g. `tiktok.com/@username/video/...`)
   * Click the extension icon
   * Hit **"Scrape"** — the extension will begin collecting all first-level comments
   * Once done, a clean, organized `.xlsx` spreadsheet will automatically be generated and offered for download

- **Use Cases**
  * This tool is especially useful for scenarios like **giveaways**, where collecting usernames and user IDs from large comment sections is required.

- **Performance Notes**
  * The script has been tested on videos with **up to \~3,000 comments**
  * On heavier comment loads, you may experience some **lag or browser tab slowdowns**
  * In rare cases (especially on lower-end devices), the tab may become unresponsive or crash — simply retry or reduce load
  
## Downloads
- [Chromium]() <br> _Supported by any Chromium-based browser, such as Chrome, Edge, Opera_

## Credits
#### [cubernetes' TiktokCommentScraper](https://github.com/cubernetes/TikTokCommentScraper)
#### [SheetJS](https://git.sheetjs.com/sheetjs/sheetjs)
