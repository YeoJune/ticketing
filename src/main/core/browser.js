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
                // 창 크기 및 위치 지정
                `--window-position=${posX * cellWidth},${posY * cellHeight}`,
                `--window-size=${cellWidth},${cellHeight}`,
        
                // 기본 Puppeteer 최적화 플래그
                '--no-user-data-dir',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // 메모리 사용 최적화
                '--disable-infobars', // 정보창 제거
                '--disable-background-timer-throttling', // 백그라운드에서 작업 스로틀링 방지
                '--disable-renderer-backgrounding', // 비활성 탭에서도 렌더링 유지
                '--disable-backgrounding-occluded-windows', // 가려진 창의 백그라운드 작업 방지
                '--enable-automation', // 자동화 감지 플래그 활성화
                '--metrics-recording-only', // 브라우저 성능 데이터만 기록
                '--disable-site-isolation-trials',
                '--disable-features=IsolateOrigins,SitePerProcess',
        
                // GPU 사용 최적화
                '--disable-accelerated-2d-canvas', // 2D 캔버스 가속 비활성화
                '--enable-unsafe-webgpu', // GPU 렌더링 지원
                '--use-gl=desktop', // OpenGL을 데스크톱 설정으로 강제
        
                // 네트워크 성능 최적화
                '--enable-features=NetworkService,NetworkServiceInProcess', // 네트워크 서비스 최적화
                '--disable-features=TranslateUI,BlinkGenPropertyTrees', // 번역 UI 및 성능 비활성화
        
                // SSL 인증서 무시 (테스트 환경에서 유용)
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-skip-list',
        
                // 사용자 경험 최적화
                '--force-color-profile=srgb', // 색상 프로파일 표준화
                '--mute-audio', // 오디오 비활성화
                '--disable-notifications', // 브라우저 알림 비활성화
                '--disable-breakpad', // 크래시 리포트 비활성화
                '--disable-component-extensions-with-background-pages', // 백그라운드 확장 비활성화
                '--disable-extensions', // 확장 프로그램 비활성화

                // 사용자 에이전트
                `--user-agent=${USER_AGENT}`
            ]
        });
        const page = (await browser.pages())[0];
        page.setViewport({ width: 0, height: 0 });
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