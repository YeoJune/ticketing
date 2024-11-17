// core/browser.js
const puppeteer = require('puppeteer');

class BrowserManager {
    constructor() {
        this.instances = [];
    }

    async createBrowser(position) {
        const browser = await puppeteer.launch({
            headless: false,
            args: [
                `--window-position=${(position % 3) * 800},${Math.floor(position / 3) * 600}`,
                '--window-size=800,600'
            ]
        });
        const page = await browser.newPage();
        this.instances.push({ browser, page });
        return { browser, page };
    }

    async login(page, site, account) {
        await page.goto(site.loginUrl);
        await page.type(site.selectors.id, account.username);
        await page.type(site.selectors.pw, account.password);
        await page.click(site.selectors.login);
    }

    async closeAll() {
        for (const { browser } of this.instances) {
            await browser.close();
        }
        this.instances = [];
    }
}

module.exports = BrowserManager;