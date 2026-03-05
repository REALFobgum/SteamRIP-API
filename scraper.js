console.log("--- ENGINE STARTING ---");

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const axios = require('axios');

console.log("--- LIBRARIES LOADED ---");

puppeteer.use(StealthPlugin());

const DB_FILE = './lastGames.json';
const DISCORD_URL = process.env.DISCORD_WEBHOOK;

async function run() {
  console.log("Launching Browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage','--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    console.log("Heading to SteamRIP...");
    await page.goto('https://steamrip.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('article h2.entry-title a');

    const currentGames = await page.evaluate(() => {
      const elements = document.querySelectorAll('article h2.entry-title a');
      return Array.from(elements).map(el => el.innerText.trim());
    });

    console.log(`Scraped ${currentGames.length} titles.`);

    let lastGames = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    const newGames = currentGames.filter(game => !lastGames.includes(game));

    if (newGames.length > 0) {
      const list = newGames.map(g => `- ${g}`).join('\n');
      await axios.post(DISCORD_WEBHOOK,{
        content: `🚀 **New Updates Found:**\n${list}`
      });
  } catch (e) {
    console.error("SCRAPE FAILED:", e.message);
  } finally {
    await browser.close();
    console.log("--- ENGINE STOPPED ---");
  }
}

// CRITICAL: Catch errors in the execution promise
run().catch(err => {
  console.error("FATAL BOOT ERROR:", err);
  process.exit(1);
});

