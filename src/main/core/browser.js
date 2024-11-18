// core/browser.js
const puppeteer = require('puppeteer');
const path = require('path');

process.env.NODE_ENV = 'development';

// Chromium 실행 경로 설정 함수
function getChromiumExecPath() {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true') {
        return 'C:\\Users\\joyyo\\.cache\\puppeteer\\chrome\\win64-131.0.6778.69\\chrome-win64\\chrome.exe';
    }

    const platform = process.platform;
    const chromePath = path.join(process.resourcesPath, 'chromium');

    if (platform === 'win32') {
        return path.join(chromePath, 'chrome.exe');
    } else if (platform === 'darwin') {
        return path.join(chromePath, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
    } else {
        return path.join(chromePath, 'chrome');
    }
}

class BrowserManager {
    constructor() {
        this.instances = [];
    }

    async createBrowser(position) {
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: getChromiumExecPath(),
            args: [
                '--no-user-data-dir',
                `--window-position=${(position % 3) * 800},${Math.floor(position / 3) * 600}`,
                '--window-size=800,600',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--single-process',
                '--no-zygote',
                '--no-first-run',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-skip-list',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--hide-scrollbars',
                '--disable-notifications',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-extensions',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--force-color-profile=srgb',
                '--metrics-recording-only',
                '--mute-audio'
            ]
        });
        const page = (await browser.pages())[0];
        this.instances.push({ browser, page });
        return { browser, page };
    }

    async closeAll() {
        for (const { browser } of this.instances) {
            await browser.close();
        }
        this.instances = [];
    }
}

module.exports = BrowserManager;