const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const axios = require('axios');

console.log("--- ENGINE STARTING ---");
console.log("--- LIBRARIES LOADED ---");

puppeteer.use(StealthPlugin());

const DB_FILE = './lastGames.json';
const DISCORD_URL = process.env.DISCORD_WEBHOOK;

async function run() {
  console.log("Launching Browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  let page; // Declared outside to be accessible in catch block

  try {
    page = await browser.newPage();

    // Set a modern User-Agent to avoid "Headless" detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log("Heading to SteamRIP...");
    await page.goto('https://steamrip.com', { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the specific container shown in your screenshot
    console.log("Waiting for container: .posts-items");
    await page.waitForSelector('.posts-items', { timeout: 30000 });

    const currentGames = await page.evaluate(() => {
      // Targets the links within the list items you showed
      const elements = document.querySelectorAll('.posts-items li.post-item a');
      return Array.from(elements)
      .map(el => el.innerText.trim())
      .filter(text => text.length > 3); // Filter out UI noise or empty strings
    });

    // Remove duplicates
    const uniqueGames = [...new Set(currentGames)];
    console.log(`Scraped ${uniqueGames.length} titles.`);

    let lastGames = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    const newGames = uniqueGames.filter(game => !lastGames.includes(game));

    if (newGames.length > 0) {
      console.log(`Alerting Discord about ${newGames.length} new games.`);
      for (const game of newGames) {
        await axios.post(DISCORD_URL, { content: `🚀 **New Game on SteamRIP:** ${game}` });
        // Small delay to prevent Discord rate limits
        await new Promise(r => setTimeout(r, 500));
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(uniqueGames, null, 2));
    } else {
      console.log("Status: Up to date.");
    }
  } catch (e) {
    console.error("SCRAPE FAILED:", e.message);
    // Take a screenshot on failure to see if Cloudflare blocked it
    if (page) {
      await page.screenshot({ path: 'debug.png' });
      console.log("Saved debug.png for troubleshooting.");
    }
  } finally {
    await browser.close();
    console.log("--- ENGINE STOPPED ---");
  }
}

run().catch(err => {
  console.error("FATAL BOOT ERROR:", err);
  process.exit(1);
});
