console.log("--- ENGINE STARTING ---"); // This MUST show up in logs

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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    console.log("Heading to SteamRIP...");
    await page.goto('https://steamrip.com', { waitUntil: 'networkidle2', timeout: 60000 });

    const currentGames = await page.evaluate(() => {
      const elements = document.querySelectorAll('article h2.entry-title a');
      return Array.from(elements).map(el => el.innerText.trim());
    });

    console.log(`Scraped ${currentGames.length} titles.`);

    let lastGames = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    const newGames = currentGames.filter(game => !lastGames.includes(game));

    if (newGames.length > 0) {
      console.log(`Alerting Discord about ${newGames.length} games.`);
      for (const game of newGames) {
        await axios.post(DISCORD_URL, { content: `🚀 **New Game on SteamRIP:** ${game}` });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(currentGames, null, 2));
    } else {
      console.log("Status: Up to date.");
    }
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

