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

  let page;

  try {
    page = await browser.newPage();

    // Use a real User-Agent to bypass basic bot checks
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log("Heading to SteamRIP...");
    await page.goto('https://steamrip.com', { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the container shown in your screenshot
    console.log("Waiting for container: .posts-items");
    await page.waitForSelector('.posts-items', { timeout: 30000 });

    const currentGames = await page.evaluate(() => {
      /**
       * FIX: Targeting ONLY the anchor inside .post-details
       * This prevents grabbing the duplicate link attached to the thumbnail image.
       */
      const elements = document.querySelectorAll('.posts-items li.post-item .post-details a');

      return Array.from(elements)
      .map(el => el.innerText.trim())
      .filter(text => text.length > 2); // Removes empty or UI-only strings
    });

    // Final safety net: Convert to a Set to remove any logic-based duplicates
    const uniqueGames = [...new Set(currentGames)];
    console.log(`Scraped ${uniqueGames.length} unique titles.`);

    let lastGames = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];

    // Filter for truly new games not found in our JSON database
    const newGames = uniqueGames.filter(game => !lastGames.includes(game));

    if (newGames.length > 0) {
      console.log(`Alerting Discord about ${newGames.length} new games.`);

      for (const game of newGames) {
        try {
          await axios.post(DISCORD_URL, {
            content: `🚀 **New Game on SteamRIP:** ${game}`
          });
          // Avoid Discord Rate Limits (429)
          await new Promise(r => setTimeout(r, 1000));
        } catch (postError) {
          console.error(`Failed to post ${game}:`, postError.message);
        }
      }

      // Update the database with the FULL list of unique games found this run
      fs.writeFileSync(DB_FILE, JSON.stringify(uniqueGames, null, 2));
      console.log("Database updated.");
    } else {
      console.log("Status: No new games found.");
    }

  } catch (e) {
    console.error("SCRAPE FAILED:", e.message);
    if (page) {
      await page.screenshot({ path: 'debug.png' });
      console.log("Screenshot saved to debug.png");
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
