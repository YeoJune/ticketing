const puppeteer = require('puppeteer');
const path = require('path');

async function checkChromiumPath() {
    try {
        // 브라우저 인스턴스 생성
        const browser = await puppeteer.launch();
        
        // 브라우저 프로세스 정보 가져오기
        const browserProcess = browser.process();
        if (browserProcess && browserProcess.spawnfile) {
            console.log('\nChrome Executable Path:', browserProcess.spawnfile);
            console.log('Chrome Directory Path:', path.dirname(browserProcess.spawnfile));
        }
        
        // 현재 설치된 Puppeteer 버전 출력
        const version = require('puppeteer/package.json').version;
        console.log('\nPuppeteer Version:', version);
        
        await browser.close();
    } catch (error) {
        console.error('Error:', error);
    }
}

// 스크립트 실행
checkChromiumPath();