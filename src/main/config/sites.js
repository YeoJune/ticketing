// config/sites.js
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ImageToTextConverter = require('../core/ImageToTextConverter');
const os = require('os');
const fs = require('fs/promises');
const path = require('path');

async function waitForImageLoad(page, selector) {
    await page.waitForFunction(
        (sel) => {
            const img = document.querySelector(sel);
            if (!img) return false; // 엘리먼트가 없으면 false
            return img.complete && img.naturalWidth > 0; // 이미지가 로드되었는지 확인
        },
        { timeout: 10000 }, // 최대 10초 대기
        selector // 선택자 전달
    );
}

const sites = {
    'yes24 global': {
        id: 'yes24 global',
        name: 'YES24 global',
        loginUrl: 'https://ticket.yes24.com/Pages/English/Member/FnLoginNew.aspx',
        selectors: {
            id: '#txtEmail',
            pw: '#txtPassword',
            login: '#btnLogin'
        }
    },
    'yes24': {
        id: 'yes24',
        name: 'YES24',
        loginUrl: 'https://www.yes24.com/Templates/FTLogin.aspx',
        selectors: {
            id: '#SMemberID',
            pw: '#SMemberPassword',
            login: '#btnLogin'
        }
    }
};

const ticketingFunctions = {
    'yes24 global': async (page, params) => {
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
            await page.evaluate(async (date, time) => {
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
            const areaCount = (await frame.$$('map[name="maphall"] area'))?.length || 1;
            
            let seatsWithDistances = [];
            for (let i = 0; i < areaCount; i++) {
                if (i != 0) {
                    frame.evaluate((i) => {
                        ChangeBlock(i);
                    }, i);
                }
                await frame.waitForSelector('.bx_top');
                const [topCenterX, topCenterY] = await frame.$eval('.bx_top', (el) => {
                    const rect = el.getBoundingClientRect()
                    return [rect.left + (rect.width / 2), rect.top + (rect.height / 2)];
                });
                await frame.waitForSelector('div[title]');
                const res = await frame.evaluate((params, topCenterX, topCenterY) => {
                    const res = [];
                    const seats = document.querySelectorAll(`div${params.grade ? '[grade=\"' + params.grade + '석\"]' : ''}[title${params.floor ? '^="' + params.floor + '"' : ''}]`);
                    for (const seat of seats) {
                        if (seat) {
                            const rect = seat.getBoundingClientRect();
                            const seatCenterX = rect.left + (rect.width / 2);
                            const seatCenterY = rect.top + (rect.height / 2);
                            
                            const deltaX = topCenterX - seatCenterX;
                            const deltaY = topCenterY - seatCenterY;
                            
                            res.push({ title: seat.title, distance: deltaX * deltaX + deltaY * deltaY });
                        }
                    }
                    return res;
                }, params, topCenterX, topCenterY);
                if (res && res.length) {
                    seatsWithDistances = res;
                    break;
                }
            }
            // 거리순으로 정렬
            seatsWithDistances.sort((a, b) => a.distance - b.distance);
            // 상위 5% 좌석 수 계산 (최소 1개)
            const topPercentage = 0.05; // 5%
            const topCount = Math.max(1, Math.ceil(seatsWithDistances.length * topPercentage));
            // 상위 5% 중에서 랜덤 선택
            const randomIndex = Math.floor(Math.random() * topCount);
            let selectedSeatTitle = seatsWithDistances[randomIndex].title;
            if (!selectedSeatTitle) selectedSeatTitle = seatsWithDistances[0];
            await frame.click(`div[title="${selectedSeatTitle}"]`);
            while (!(await frame.$('div.son'))) await frame.click(`div[title="${selectedSeatTitle}"]`);
            await frame.evaluate(() => {
                ChoiceEnd();
            });
            await page.waitForSelector('#spanPromotionSeat input[value]');
            // 프로모션 처리
            await page.evaluate(() => {
                fdc_PromotionEnd();
            });
            await Promise.all([
                page.waitForSelector('#rdoDeliveryBase[value]'),
                page.waitForSelector('#LUAddr_UserName[value]'),
            ]);
            await page.evaluate(() => {
                fdc_DeliveryEnd();
            });
            
            await Promise.all([
                page.waitForSelector('#rdoPays2'),
                page.waitForSelector('#cbxUserInfoAgree'),
                page.waitForSelector('#cbxCancelFeeAgree'),
                page.waitForSelector('#captchaImg'),
            ]);

            const MAX_ATTEMPT = 10;
            let attempt = 0;
            let captchaText = ''
            while (attempt < MAX_ATTEMPT && !/^\d{6}$/.test(captchaText)) {
                if (attempt) {
                    await page.evaluate(() => { 
                        initCaptcha();
                    });
                    await sleep(50);
                }
                
                await waitForImageLoad(page, '#captchaImg');
                const captchaElement = await page.$('#captchaImg');
                const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

                const tempPath = path.join(os.tmpdir(), `captcha-${Date.now()}.png`);
                const buffer = Buffer.from(captchaBase64, 'base64');
                await fs.writeFile(tempPath, buffer);
    
                // OCR 수행
                const converter = new ImageToTextConverter();
                captchaText = await converter.extractText(tempPath);
                attempt += 1;
            }

            // 인식된 캡챠 텍스트 입력
            await page.evaluate((text) => {
                document.querySelector('#captchaText').value = text;
            }, captchaText);

            await page.evaluate(() => {
                document.querySelector('#rdoPays2').click();
                document.querySelector('#cbxUserInfoAgree').click();
                document.querySelector('#cbxCancelFeeAgree').click();
                fdc_PrePayCheck();
            });
        } catch (error) {
            console.error('Ticketing execution failed:', error);
            throw error;
        }
    },
    'yes24': async (page, params) => {
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
            targetTime = `${targetTime.split(':')[0]}시 ${targetTime.split(':')[1]}분`

            await page.goto(params.url);
            console.log(`Starting ticketing process for ${targetDate} ${targetTime}`);
            const newPagePromise = new Promise((resolve) =>
                page.browser().on('targetcreated', async (target) => {
                    if (target.type() === 'page') {
                        const page = await target.page();
                        resolve(page); // Promise를 완료시킴
                    }
                })
              );
            await page.waitForSelector('body');
            await page.evaluate(() => {
                jsf_pdi_GoPerfSale();
            });
            page = await newPagePromise;
            await page.waitForSelector(`[id="${targetDate}"]`);
            await page.click(`[id="${targetDate}"]`);
            await page.waitForSelector('#ulTime li');
            await page.click(`[timeinfo="${targetTime}"]`);
            await page.click('#btnSeatSelect');

            await page.waitForSelector('iframe[name="ifrmSeatFrame"]');
            const frame = await (await page.$('iframe[name="ifrmSeatFrame"]')).contentFrame();
            await frame.waitForSelector('div[title]');
            const areaCount = (await frame.$$('map[name="maphall"] area'))?.length || 1;
            let seatsWithDistances = [];
            for (let i = 0; i < areaCount; i++) {
                if (i != 0) {
                    frame.evaluate((i) => {
                        ChangeBlock(i);
                    }, i);
                }
                await frame.waitForSelector('.bx_top');
                const [topCenterX, topCenterY] = await frame.$eval('.bx_top', (el) => {
                    const rect = el.getBoundingClientRect()
                    return [rect.left + (rect.width / 2), rect.top + (rect.height / 2)];
                });
                await frame.waitForSelector('div[title]');
                const res = await frame.evaluate((params, topCenterX, topCenterY) => {
                    const res = [];
                    const seats = document.querySelectorAll(`div${params.grade ? '[grade=\"' + params.grade + '석\"]' : ''}[title${params.floor ? '^="' + params.floor + '"' : ''}]`);
                    console.log(`div${params.grade ? '[grade=\"' + params.grade + '석\"]' : ''}[title${params.floor ? '^="' + params.floor + '"' : ''}]`);
                    for (const seat of seats) {
                        if (seat) {
                            const rect = seat.getBoundingClientRect();
                            const seatCenterX = rect.left + (rect.width / 2);
                            const seatCenterY = rect.top + (rect.height / 2);
                            
                            const deltaX = topCenterX - seatCenterX;
                            const deltaY = topCenterY - seatCenterY;
                            
                            res.push({ title: seat.title, distance: deltaX * deltaX + deltaY * deltaY });
                        }
                    }
                    return res;
                }, params, topCenterX, topCenterY);
                if (res && res.length) {
                    seatsWithDistances = res;
                    break;
                }
            }
            
            // 거리순으로 정렬
            seatsWithDistances.sort((a, b) => a.distance - b.distance);
            // 상위 5% 좌석 수 계산 (최소 1개)
            const topPercentage = 0.05; // 5%
            const topCount = Math.max(1, Math.ceil(seatsWithDistances.length * topPercentage));
            // 상위 5% 중에서 랜덤 선택
            const randomIndex = Math.floor(Math.random() * topCount);
            const selectedSeatTitle = seatsWithDistances[randomIndex].title;
            if (!selectedSeatTitle) selectedSeatTitle = seatsWithDistances[0];
            await frame.click(`div[title="${selectedSeatTitle}"]`);
            while(!(await frame.$('div.son'))) await frame.click(`div[title="${selectedSeatTitle}"]`);
            frame.evaluate(() => {
                ChoiceEnd();
            });

            await page.waitForSelector('#spanPromotionSeat input[value]');
            // 프로모션 처리
            await page.evaluate(() => {
                fdc_PromotionEnd();
            });
            await Promise.all([
                page.waitForSelector('#deliveryPos input[value]'),
                page.waitForSelector('#LUAddr_UserName[value]'),
                page.waitForSelector('#LUAddr_MailH[value]'),
                page.waitForSelector('#LUAddr_MailD[value]'),
            ]);
            await page.evaluate(() => {
                document.querySelector('#ordererMobile1').value = '010';
                document.querySelector('#ordererMobile2').value = '0000';
                document.querySelector('#ordererMobile3').value = '0000';
                fdc_DeliveryEnd();
            });
            await Promise.all([
                page.waitForSelector('#rdoPays2'),
                page.waitForSelector('#cbxAllAgree'),
                page.waitForSelector('#captchaImg'),
            ]);
            
            const MAX_ATTEMPT = 10;
            let attempt = 0;
            let captchaText = ''
            while (attempt < MAX_ATTEMPT && !/^\d{6}$/.test(captchaText)) {
                if (attempt) {
                    await page.evaluate(() => { 
                        initCaptcha();
                    });
                    await sleep(50);
                }
                
                await waitForImageLoad(page, '#captchaImg');
                const captchaElement = await page.$('#captchaImg');
                const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

                const tempPath = path.join(os.tmpdir(), `captcha-${Date.now()}.png`);
                const buffer = Buffer.from(captchaBase64, 'base64');
                await fs.writeFile(tempPath, buffer);
    
                // OCR 수행
                const converter = new ImageToTextConverter();
                captchaText = await converter.extractText(tempPath);
                attempt += 1;
            }

            // 인식된 캡챠 텍스트 입력
            await page.evaluate((text) => {
                document.querySelector('#captchaText').value = text;
            }, captchaText);

            await page.evaluate(() => {
                document.querySelector('#rdoPays2').click();
                document.querySelector('#cbxAllAgree').click();
                fdc_PrePayCheck();
            });
        } catch (error) {
            console.error('Ticketing execution failed:', error);
            throw error;
        }
    },
};

const loginFunctions = {
    'yes24 global': async (page, site, account) => {
        page.goto(site.loginUrl);
        await Promise.all([
            page.waitForSelector(site.selectors.id),
            page.waitForSelector(site.selectors.pw),
        ]);
        await page.evaluate((q1, v1, q2, v2) => {
            document.querySelector(q1).setAttribute('value', v1);
            document.querySelector(q2).setAttribute('value', v2);
            jsf_mem_login();
        }, site.selectors.id, account.username, site.selectors.pw, account.password);
    },
    'yes24': async (page, site, account) => {
        page.goto(site.loginUrl);
        await Promise.all([
            page.waitForSelector(site.selectors.id),
            page.waitForSelector(site.selectors.pw),
        ]);
        await page.evaluate((q1, v1, q2, v2) => {
            document.querySelector(q1).setAttribute('value', v1);
            document.querySelector(q2).setAttribute('value', v2);
        }, site.selectors.id, account.username, site.selectors.pw, account.password);
        await page.click(site.selectors.login);
    },
};
module.exports = {
    sites,
    ticketingFunctions,
    loginFunctions
};