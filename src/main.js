// src/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

let scheduledTasks = new Map(); // 예약된 작업 저장

const EXECUTION_FUNCTIONS = {
    'ticketing': async (page, params) => {
        // timeout 유틸리티 함수
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        try {
            // 날짜 형식 정규화 (YYYY-MM-DD)
            let targetDate = params.date;
            if (!targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                targetDate = new Date(params.date).toISOString().split('T')[0];
            }
            
            // 시간 형식 정규화 (HH:mm)
            let targetTime = params.time;
            if (!targetTime.match(/^\d{2}:\d{2}$/)) {
                targetTime = new Date(`2000-01-01T${params.time}`).toTimeString().slice(0, 5);
            }

            console.log(`Starting ticketing process for ${targetDate} ${targetTime}`);
            
            await page.goto(`http://ticket.yes24.com/Pages/English/Sale/FnPerfSaleProcess.aspx?IdPerf=${params.url.match(/IdPerf=(\d+)/)[1]}`);
            
            
            // 날짜 선택
            page.evaluate(async (date, time) => {
                jgCalSelDate = date;
                const data = await $j.ajax({
                    async: true,
                    type: "POST",
                    url: "/Pages/English/Sale/Ajax/Perf/FnPerfTime.aspx",
                    data: { pDay: $j.trim(date.replace(/-/g, "")), pIdPerf: $j.trim(jgIdPerf), pIdCode: $j.trim(jgIdCode), pIsMania: $j.trim(jgIsMania) },
                    dataType: "html",
                });
                
                const joData = $j("#divTimeTempData").html(data);

                $j("#ulTime").html(joData.find("#ulTimeData").html());
                $j("#ulTime > li").unbind('.step01_time_li').bind('click.step01_time_li', fdc_UlTimeClick);
                $j("#selFlashTime").html(joData.find("#selFlashTimeData").html());
                const matchingLi = $j("#ulTime > li").filter((_, li) => $j(li).attr("timeinfo") === time);

                const selectedValue = matchingLi.length > 0 ? matchingLi.attr("value") : null;
                
                if (selectedValue) {
                    $j("#selFlashTime").val(selectedValue).trigger("change");
                }
            }, targetDate, targetTime);

            await page.waitForSelector('iframe[name="ifrmSeatFrame"]');
            const frame = await (await page.$('iframe[name="ifrmSeatFrame"]')).contentFrame();
            await frame.waitForSelector('.s6');

            await frame.evaluate(async () => {
                document.querySelectorAll('.s6')[0].click();
                ChoiceEnd();
            });
            await page.waitForSelector('#spanPromotionSeat input');
            await page.click('#spanPromotionSeat input');
            // 프로모션 처리
            await page.evaluate(() => {
                fdc_PromotionEnd();
            });
            await page.waitForSelector('#deliveryPos input');
            await page.waitForSelector('.delivery input');
            await page.click('#deliveryPos input');
            await page.evaluate(() => {
                fdc_DeliveryEnd();
            });
            await page.waitForSelector('#rdoPays2');
            
            // 최종 옵션 선택
            await page.evaluate(() => {
                document.querySelector('#rdoPays2')?.click();
                document.querySelector('#cbxUserInfoAgree')?.click();
                document.querySelector('#cbxCancelFeeAgree')?.click();
            });
            await page.evaluate(() => {
                fdc_PrePayCheck();
            });
            
        } catch (error) {
            console.error('Ticketing execution failed:', error);
            throw error;
        }
    }
};

// 타겟 사이트 설정 (개발자 정의)
const TARGET_SITES = {
    'site1': {
        id: 'site1',
        name: 'yes24',
        loginUrl: 'https://ticket.yes24.com/Pages/English/Member/FnLoginNew.aspx',
        idSelector: '#txtEmail',
        pwSelector: '#txtPassword',
        loginBtnSelector: '#btnLogin'
    },
};

const store = new Store();
let mainWindow;
let browserInstances = [];

// 화면 크기 및 위치 계산 헬퍼
const calculateGridPositions = () => {
    const displays = require('electron').screen.getAllDisplays();
    const primaryDisplay = displays[0];
    const { width, height } = primaryDisplay.workAreaSize;
    
    const gridSize = 3;
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);

    return { cellWidth, cellHeight, screenWidth: width, screenHeight: height };
};

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('src/index.html');
}

// 타겟 사이트 목록 조회
ipcMain.handle('get-target-sites', () => {
    return Object.values(TARGET_SITES);
});

// 계정 관리
ipcMain.handle('save-account', async (event, { siteId, account }) => {
    const accounts = store.get(`accounts-${siteId}`) || [];
    accounts.push(account);
    store.set(`accounts-${siteId}`, accounts);
    return accounts;
});

ipcMain.handle('get-accounts', (event, siteId) => {
    return store.get(`accounts-${siteId}`) || [];
});

ipcMain.handle('schedule-batch-execution', async (event, { executionTime, params }) => {
    cancelScheduledTasks();
    
    const timestamp = new Date(executionTime).getTime();
    
    browserInstances.forEach(({ page }, index) => {
        const taskId = setTimeout(async () => {
            try {
                await EXECUTION_FUNCTIONS['ticketing'](page, params);
            } catch (error) {
                console.error(`Execution failed for instance ${index}:`, error);
            }
        }, timestamp - Date.now());
        
        scheduledTasks.set(index, taskId);
    });
    
    return true;
});

function cancelScheduledTasks() {
    scheduledTasks.forEach((taskId) => {
        clearTimeout(taskId);
    });
    scheduledTasks.clear();
}

async function createBrowserInstances(site, selectedAccounts) {
    await closeBrowserInstances();

    const { cellWidth, cellHeight } = calculateGridPositions();
    
    mainWindow.setPosition(0, 0);
    mainWindow.setSize(cellWidth, cellHeight);

    for (let i = 0; i < selectedAccounts.length; i++) {
        const position = i + 1;
        const row = Math.floor(position / 3);
        const col = position % 3;
        
        const adjustedRow = position >= 8 ? Math.floor((position - 8) / 3) : row;
        const adjustedCol = position >= 8 ? (position - 8) % 3 : col;

        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                `--window-size=${cellWidth},${cellHeight}`,
                `--window-position=${adjustedCol * cellWidth},${adjustedRow * cellHeight}`,
                '--no-user-data-dir',
                '--disable-infobars',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        const page = (await browser.pages())[0];
        browserInstances.push({ browser, page });

        try {
            // 페이지 로드 타임아웃 설정
            await page.setDefaultNavigationTimeout(30000);
            
            // 페이지 이동
            await page.goto(site.loginUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // 입력 필드 대기
            await page.waitForSelector(site.idSelector);
            await page.waitForSelector(site.pwSelector);
            
            // 기존 값 클리어
            await page.evaluate((idSelector, pwSelector) => {
                document.querySelector(idSelector).value = '';
                document.querySelector(pwSelector).value = '';
            }, site.idSelector, site.pwSelector);

            // ID 입력
            await page.type(site.idSelector, selectedAccounts[i].username);
            
            // 비밀번호 입력
            await page.type(site.pwSelector, selectedAccounts[i].password);

            // 로그인 버튼 클릭
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
                page.click(site.loginBtnSelector)
            ]);

        } catch (error) {
            console.error(`Login failed for account: ${selectedAccounts[i].username}`, error);
        }
    }
}

async function closeBrowserInstances() {
    cancelScheduledTasks(); // 브라우저 종료 시 예약된 작업도 취소
    for (const instance of browserInstances) {
        try {
            await instance.browser.close();
        } catch (error) {
            console.error('Error closing browser instance:', error);
        }
    }
    browserInstances = [];
}

// 실행 모드 전환
ipcMain.handle('start-execution', async (event, { site, selectedAccounts }) => {
    await createBrowserInstances(site, selectedAccounts);
});

// 메인 화면 복귀
ipcMain.handle('return-to-main', async () => {
    await closeBrowserInstances();
    mainWindow.setSize(800, 600);
    mainWindow.center();
});

// 앱 종료 처리
app.on('window-all-closed', async () => {
    await closeBrowserInstances();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.whenReady().then(createMainWindow);