const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const axios = require('axios');

puppeteer.use(StealthPlugin());

const DB_FILE = './lastGames.json';
const DISCORD_URL = process.env.DISCORD_WEBHOOK;

async function run() {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.goto('https://steamrip.com', { waitUntil: 'networkidle2' });
    const currentGames = await page.evaluate(() => {
      const elements = document.querySelectorAll('article h2.entry-title a');
      return Array.from(elements).map(el => el.innerText.trim());
    });

    let lastGames = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    const newGames = currentGames.filter(game => !lastGames.includes(game));

    if (newGames.length > 0) {
      for (const game of newGames) {
        await axios.post(DISCORD_URL, { content: `🚀 **New Game on SteamRIP:** ${game}` });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(currentGames, null, 2));
    }
  } catch (e) { console.error(e); }
  await browser.close();
}
run();

