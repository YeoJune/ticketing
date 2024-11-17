// src/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { createWorker } = require('tesseract.js');

//process.env.NODE_ENV = 'development';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const BATCH_SIZE = 5; // 동시에 처리할 계정 수

let scheduledTasks = new Map(); // 예약된 작업 저장

// 이미지 전처리 함수
async function preprocessCaptchaImage(page) {
    return await page.evaluate(() => {
        const img = document.querySelector('#captchaImg');
        if (!img) return null;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 캔버스 크기를 2배로 확대
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;

        // 이미지를 확대하여 그리기
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // 이미지 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 평균 밝기 계산
        let totalBrightness = 0;
        for (let i = 0; i < data.length; i += 4) {
            totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        const averageBrightness = totalBrightness / (data.length / 4);

        // 동적 임계값 설정 (평균 밝기 기반)
        const threshold = averageBrightness * 0.9;

        // 이미지 처리
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            
            // 이진화 및 선명도 향상
            if (brightness > threshold) {
                data[i] = data[i + 1] = data[i + 2] = 255;   // 흰색
            } else {
                data[i] = data[i + 1] = data[i + 2] = 0;     // 검정색
            }
            data[i + 3] = 255; // 알파 채널을 최대로
        }

        // 노이즈 제거
        const tempData = new Uint8ClampedArray(data);
        for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
                const idx = (y * canvas.width + x) * 4;
                let surroundingBlackPixels = 0;
                
                // 주변 8픽셀 검사
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const surroundingIdx = ((y + dy) * canvas.width + (x + dx)) * 4;
                        if (tempData[surroundingIdx] === 0) {
                            surroundingBlackPixels++;
                        }
                    }
                }
                
                // 고립된 픽셀 제거
                if (surroundingBlackPixels <= 2) {
                    data[idx] = data[idx + 1] = data[idx + 2] = 255;
                }
            }
        }

        // 처리된 이미지 데이터 적용
        ctx.putImageData(imageData, 0, 0);

        return canvas.toDataURL('image/png').split(',')[1];
    });
}

// OCR 결과 후처리 함수
function postProcessOCRResult(text) {
    console.log('Raw OCR text:', text);
    
    // 모든 공백 제거
    let processed = text.replace(/\s/g, '');
    
    // OCR 일반적인 오류 수정
    const corrections = {
        'O': '0',
        'o': '0',
        'D': '0',
        'Q': '0',
        'l': '1',
        'I': '1',
        'i': '1',
        'Z': '2',
        'z': '2',
        'B': '8',
        'S': '5',
        'A': '4',
        'G': '6',
        'b': '6',
        'T': '7',
        'g': '9',
        'q': '9'
    };

    // 문자 교정
    for (const [wrong, correct] of Object.entries(corrections)) {
        processed = processed.replace(new RegExp(wrong, 'g'), correct);
    }

    // 숫자만 추출
    processed = processed.replace(/[^0-9]/g, '');
    
    console.log('Processed text:', processed);
    return processed;
}

// 캡챠 처리 메인 함수
async function processCaptcha(page) {
    try {
        // 캡챠 이미지 대기 및 확인
        try {
            await page.waitForSelector('#captchaImg', { 
                visible: true, 
                timeout: 5000 
            });
        } catch (error) {
            console.log('No CAPTCHA found or not visible');
            return true;
        }

        // 이미지 로드 완료 대기
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const img = document.querySelector('#captchaImg');
                if (img.complete) resolve();
                else {
                    img.onload = resolve;
                    img.onerror = resolve;
                }
            });
        });

        // 이미지 전처리
        console.log('Starting image preprocessing...');
        const processedImage = await preprocessCaptchaImage(page);
        if (!processedImage) {
            throw new Error('Failed to preprocess CAPTCHA image');
        }

        // OCR 워커 생성 및 실행
        console.log('Creating OCR worker...');
        const worker = await createWorker();

        // 다양한 OCR 설정으로 시도
        const ocrConfigs = [
            {
                tessedit_char_whitelist: '0123456789',
                tessedit_ocr_engine_mode: 2,
                tessedit_pageseg_mode: 7,
            },
            {
                tessedit_char_whitelist: '0123456789',
                tessedit_ocr_engine_mode: 2,
                tessedit_pageseg_mode: 6,
            },
            {
                tessedit_char_whitelist: '0123456789',
                tessedit_ocr_engine_mode: 2,
                tessedit_pageseg_mode: 13,
            }
        ];

        let bestResult = '';
        
        for (const config of ocrConfigs) {
            const { data: { text } } = await worker.recognize(Buffer.from(processedImage, 'base64'), config);
            const processed = postProcessOCRResult(text);
            
            if (processed.length > 0) {
                bestResult = processed;
                break;
            }
        }

        if (!bestResult) {
            throw new Error('Failed to recognize any numbers in CAPTCHA after multiple attempts');
        }

        console.log('Final recognized text:', bestResult);

        // 캡챠 텍스트 입력
        await page.evaluate((captchaText) => {
            const input = document.querySelector('#captchaText');
            if (input) {
                input.value = captchaText;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, bestResult);

        await worker.terminate();
        return true;

    } catch (error) {
        console.error('CAPTCHA processing failed:', error);
        throw error;
    }
}

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
            await frame.waitForSelector('div[title]');
            await frame.evaluate(() => {
                // 좌석들의 거리 계산 및 정렬을 위한 배열 생성
                const top = document.querySelector('.bx_top');
                const topRect = top.getBoundingClientRect();
                const topCenterX = topRect.left + (topRect.width / 2);
                const topCenterY = topRect.top + (topRect.height / 2);
                
                // 좌석과 거리 정보를 저장할 배열
                const seatsWithDistances = [];
                
                // 모든 좌석의 거리 계산
                for (const seat of document.querySelectorAll('div[title]')) {
                    const rect = seat.getBoundingClientRect();
                    const seatCenterX = rect.left + (rect.width / 2);
                    const seatCenterY = rect.top + (rect.height / 2);
                    
                    const deltaX = topCenterX - seatCenterX;
                    const deltaY = topCenterY - seatCenterY;
                    const distance = deltaX * deltaX + deltaY * deltaY;
                    
                    seatsWithDistances.push({ seat, distance });
                }
                
                // 거리순으로 정렬
                seatsWithDistances.sort((a, b) => a.distance - b.distance);
                
                // 상위 10% 좌석 수 계산 (최소 1개)
                const topPercentage = 0.1; // 10%
                const topCount = Math.max(1, Math.ceil(seatsWithDistances.length * topPercentage));
                
                // 상위 10% 중에서 랜덤 선택
                const randomIndex = Math.floor(Math.random() * topCount);
                const selectedSeat = seatsWithDistances[randomIndex].seat;
                
                // 선택된 좌석 클릭
                selectedSeat.click();
                ChoiceEnd();
                
                // 디버깅을 위한 정보 반환 (필요시 사용)
                return {
                    totalSeats: seatsWithDistances.length,
                    topSeatsCount: topCount,
                    selectedIndex: randomIndex,
                    selectedDistance: Math.sqrt(seatsWithDistances[randomIndex].distance)
                };
            });
            await page.waitForSelector('#spanPromotionSeat input');
            await page.click('#spanPromotionSeat input');
            await sleep(500);

            // 프로모션 처리
            await page.evaluate(() => {
                fdc_PromotionEnd();
            });
            await page.waitForSelector('#deliveryPos input');
            await page.waitForSelector('.delivery input');
            await sleep(1000);
            await page.click('#deliveryPos input');
            await page.evaluate(() => {
                fdc_DeliveryEnd();
            });
            await page.waitForSelector('#rdoPays2');
            await sleep(500);
            
            await page.evaluate(() => {
                document.querySelector('#rdoPays2')?.click();
                document.querySelector('#cbxUserInfoAgree')?.click();
                document.querySelector('#cbxCancelFeeAgree')?.click();
            });

            // 캡챠 처리
            const captchaSuccess = await processCaptcha(page);
            if (!captchaSuccess) {
                throw new Error('CAPTCHA processing failed');
            }

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
        name: 'yes24 global',
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

// main.js
ipcMain.handle('schedule-batch-execution', async (event, data) => {
    try {
        console.log('Received schedule request:', data);

        // 시간 데이터 검증
        const executionTime = new Date(data.executionTime);
        const now = new Date();

        if (isNaN(executionTime.getTime())) {
            throw new Error('Invalid execution time format');
        }

        if (executionTime < now) {
            throw new Error('Execution time must be in the future');
        }

        // 여기서 기존 예약 작업 취소
        cancelScheduledTasks();

        // 새로운 예약 설정
        const timeUntilExecution = executionTime.getTime() - now.getTime();
        
        console.log('Time until execution:', timeUntilExecution, 'ms');

        browserInstances.forEach(({ page }, index) => {
            const taskId = setTimeout(async () => {
                try {
                    await EXECUTION_FUNCTIONS['ticketing'](page, data.params);
                } catch (error) {
                    console.error(`Execution failed for instance ${index}:`, error);
                }
            }, timeUntilExecution);
            
            scheduledTasks.set(index, taskId);
        });

        console.log('Scheduled tasks:', scheduledTasks.size);
        
        return true;
    } catch (error) {
        console.error('Schedule execution error in main:', error);
        throw error; // 에러를 renderer로 전파
    }
});

function cancelScheduledTasks() {
    scheduledTasks.forEach((taskId) => {
        clearTimeout(taskId);
    });
    scheduledTasks.clear();
}

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

async function createBrowserInstances(site, selectedAccounts) {
    await closeBrowserInstances();

    const { cellWidth, cellHeight } = calculateGridPositions();
    mainWindow.setPosition(0, 0);
    mainWindow.setSize(cellWidth, cellHeight);

    // 계정을 BATCH_SIZE 크기의 배치로 나누기
    const batches = [];
    for (let i = 0; i < selectedAccounts.length; i += BATCH_SIZE) {
        batches.push(selectedAccounts.slice(i, i + BATCH_SIZE));
    }

    let completedCount = 0;
    const totalAccounts = selectedAccounts.length;

    // 각 배치 처리
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStart = batchIndex * BATCH_SIZE;

        // 현재 배치의 모든 계정을 병렬로 처리
        await Promise.all(batch.map(async (account, index) => {
            const position = batchStart + index + 1;
            const row = Math.floor(position / 3);
            const col = position % 3;
            
            const adjustedRow = position >= 8 ? Math.floor((position - 8) / 3) : row;
            const adjustedCol = position >= 8 ? (position - 8) % 3 : col;

            try {
                const browser = await puppeteer.launch({
                    headless: false,
                    defaultViewport: null,
                    executablePath: getChromiumExecPath(),
                    args: [
                        `--window-size=${cellWidth},${cellHeight}`,
                        `--window-position=${adjustedCol * cellWidth},${adjustedRow * cellHeight}`,
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-first-run',
                        '--disable-extensions',
                        '--disable-popup-blocking',
                        '--disable-notifications',
                        '--disable-web-security'
                    ],
                    ignoreHTTPSErrors: true,
                    timeout: 30000
                });

                const page = (await browser.pages())[0];
                await page.setUserAgent(USER_AGENT);
                await page.setDefaultNavigationTimeout(30000);
                
                browserInstances.push({ browser, page });

                // 에러 핸들링
                page.on('error', err => {
                    console.error('Page error:', err);
                    mainWindow.webContents.send('login-error', { 
                        username: account.username, 
                        error: err.message 
                    });
                });
                
                page.on('pageerror', err => {
                    console.error('Page error:', err);
                    mainWindow.webContents.send('login-error', { 
                        username: account.username, 
                        error: err.message 
                    });
                });

                // 로그인 프로세스
                await page.goto(site.loginUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });

                await page.waitForSelector(site.idSelector);
                await page.waitForSelector(site.pwSelector);
                
                await page.evaluate((idSelector, pwSelector) => {
                    document.querySelector(idSelector).value = '';
                    document.querySelector(pwSelector).value = '';
                }, site.idSelector, site.pwSelector);

                await page.type(site.idSelector, account.username);
                await page.type(site.pwSelector, account.password);

                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
                    page.click(site.loginBtnSelector)
                ]);

                completedCount++;
                
                // 로그인 성공 알림
                mainWindow.webContents.send('login-progress', {
                    completed: completedCount,
                    total: totalAccounts,
                    currentBatch: batchIndex + 1,
                    totalBatches: batches.length,
                    username: account.username,
                    status: 'success'
                });

            } catch (error) {
                console.error(`Login failed for account: ${account.username}`, error);
                mainWindow.webContents.send('login-progress', {
                    completed: ++completedCount,
                    total: totalAccounts,
                    currentBatch: batchIndex + 1,
                    totalBatches: batches.length,
                    username: account.username,
                    status: 'error',
                    error: error.message
                });
            }
        }));

        // 각 배치 완료 후 알림
        mainWindow.webContents.send('batch-completed', {
            batchIndex: batchIndex + 1,
            totalBatches: batches.length
        });
    }

    // 모든 로그인 완료 알림
    mainWindow.webContents.send('all-logins-completed', {
        totalSuccess: browserInstances.length,
        totalAccounts: selectedAccounts.length
    });
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

// IPC 이벤트 핸들러 추가
ipcMain.handle('get-login-status', () => {
    return {
        totalInstances: browserInstances.length,
        browserStatus: browserInstances.map((instance, index) => ({
            index,
            isLoaded: instance.page !== null,
            url: instance.page ? instance.page.url() : null
        }))
    };
});

// 앱 종료 처리
app.on('window-all-closed', async () => {
    await closeBrowserInstances();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.whenReady().then(createMainWindow);