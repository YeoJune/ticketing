// core/browser.js
const puppeteer = require('puppeteer');
const path = require('path');
const { calculateGridSize, calculateWindowPos } = require('../../utils');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36';

//process.env.NODE_ENV = 'development';

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
        const { cellWidth, cellHeight } = calculateGridSize(3);
        const { posX, posY } = calculateWindowPos(position);

        const browser = await puppeteer.launch({
            headless: false,
            executablePath: getChromiumExecPath(),
            args: [
                // 창 크기 및 위치 설정
                `--window-position=${posX * cellWidth},${posY * cellHeight}`,
                `--window-size=${cellWidth},${cellHeight}`,
        
                // 핵심 성능 설정
                '--no-user-data-dir',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-features=site-per-process',
                '--disable-features=IsolateOrigins',
                
                // 백그라운드 작업 최적화
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
        
                // 필수적인 기능 비활성화
                '--disable-notifications',
                '--disable-translate',
                '--no-first-run',
                '--no-default-browser-check',
                
                // 사용자 에이전트
                `--user-agent=${USER_AGENT}`
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation']
        });
        const page = (await browser.pages())[0];
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Sec-Fetch-Site': 'none'
        });
        await page.setViewport({ width: 0, height: 0 });
        this.instances.push({ browser, page });
        return { browser, page };
    }

    async closeAll() {
        for (const { browser } of this.instances) {
            browser.close();
        }
        this.instances = [];
    }
}

module.exports = BrowserManager;