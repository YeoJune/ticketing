// config/sites.js
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ImageToTextConverter = require('../core/ImageToTextConverter');
const os = require('os');
const fs = require('fs/promises');
const path = require('path');
const { timeout } = require('puppeteer');

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
            await page.click('.sinfo a');
            page = await newPagePromise;
            await page.setViewport({ width: 0, height: 0 });
            await page.waitForSelector(`[id="${targetDate}"]`);
            await page.click(`[id="${targetDate}"]`);
            await page.waitForSelector('#ulTime li');
            await page.click(`[timeinfo="${targetTime}"]`);
            await page.click('#btnSeatSelect');

            await page.waitForSelector('iframe[name="ifrmSeatFrame"]');
            const frame = await (await page.$('iframe[name="ifrmSeatFrame"]')).contentFrame();
            await frame.waitForSelector('.minimap_m');
            try {
                await frame.waitForSelector('.minimap_m .btn_all', {timeout: 100});
            } catch (err) {

            }
            
            let sortedBlockIndices = [-1];
            if (await frame.$('.minimap_m .btn_all')) {
                await frame.waitForSelector('map[name="map_ticket"] area');
                sortedBlockIndices = await frame.evaluate(() => {
                    const areas = document.querySelectorAll('map[name="map_ticket"] area');
                    const areaShapes = Array.from(areas)
                        .map(area => {
                            const blockNumber = parseInt(area.getAttribute('href').match(/ChangeBlock\((\d+)\)/)[1]);
                            if (typeof ArBlockRemain !== 'undefined' && ArBlockRemain[blockNumber] > 0) {
                                const coords = area.getAttribute('coords').split(',').map(Number);
                                let centerX = 0, centerY = 0;
                                for (let i = 0; i < coords.length; i += 2) {
                                    centerX += coords[i];
                                    centerY += coords[i + 1];
                                }
                                centerX /= (coords.length / 2);
                                centerY /= (coords.length / 2);
                                
                                return {
                                    center: { x: centerX, y: centerY },
                                    blockNumber: blockNumber
                                };
                            }
                            return null;
                        })
                        .filter(shape => shape !== null); // null 값 제거

                    if (areaShapes.length === 0) return [-1]; // 사용 가능한 블록이 없는 경우

                    // 무대는 전체 영역의 상단 중앙
                    const minY = Math.min(...areaShapes.map(s => s.center.y));
                    const centerX = areaShapes.reduce((sum, s) => sum + s.center.x, 0) / areaShapes.length;
                    
                    return areaShapes
                        .map(shape => ({
                            index: shape.blockNumber,
                            distance: 
                                Math.pow(shape.center.x - centerX, 2) + 
                                Math.pow(shape.center.y - minY, 2)
                        }))
                        .sort((a, b) => a.distance - b.distance)
                        .map(block => block.index);
                });
            } else if (await frame.$('#blockFile')) {
                await frame.waitForSelector('map[name="maphall"] area');
                sortedBlockIndices = await frame.evaluate(() => {
                    const areas = document.querySelectorAll('map[name="maphall"] area');
                    const areaShapes = Array.from(areas)
                        .map(area => {
                            const blockNumber = parseInt(area.getAttribute('onclick').match(/ChangeBlock\((\d+)\)/)[1]);
                            if (typeof ArBlockRemain !== 'undefined' && ArBlockRemain[blockNumber] > 0) {
                                const coords = area.getAttribute('coords').split(',').map(Number);
                                let centerX = 0, centerY = 0;
                                for (let i = 0; i < coords.length; i += 2) {
                                    centerX += coords[i];
                                    centerY += coords[i + 1];
                                }
                                centerX /= (coords.length / 2);
                                centerY /= (coords.length / 2);
                                
                                return {
                                    center: { x: centerX, y: centerY },
                                    blockNumber: blockNumber
                                };
                            }
                            return null;
                        })
                        .filter(shape => shape !== null); // null 값 제거

                    if (areaShapes.length === 0) return [-1]; // 사용 가능한 블록이 없는 경우

                    // 무대는 전체 영역의 상단 중앙
                    const minY = Math.min(...areaShapes.map(s => s.center.y));
                    const centerX = areaShapes.reduce((sum, s) => sum + s.center.x, 0) / areaShapes.length;
                    
                    return areaShapes
                        .map(shape => ({
                            index: shape.blockNumber,
                            distance: 
                                Math.pow(shape.center.x - centerX, 2) + 
                                Math.pow(shape.center.y - minY, 2)
                        }))
                        .sort((a, b) => a.distance - b.distance)
                        .map(block => block.index);
                });
            }
            let success = false;
            let blockIndex = 0;

            await page.on('dialog', async (dialog) => await dialog.accept());

            while (blockIndex < sortedBlockIndices.length && !success) {
                try {
                    if (sortedBlockIndices[blockIndex] !== -1) {
                        await frame.evaluate((blockNumber) => {
                            ChangeBlock(blockNumber);
                        }, sortedBlockIndices[blockIndex]);
                    }

                    await frame.waitForSelector('div[name=tk]');
                    const seats = await frame.evaluate((params) => {
                        const seats = Array.from(document.querySelectorAll(`div${params.grade ? '[grade=\"' + params.grade + '석\"]' : ''}[name="tk"]`));
                        if (!seats.length) return [];

                        // 모든 좌석의 평균 위치 계산에 title 유무와 관계없이 모든 좌석 사용
                        const seatPositions = seats.map(seat => ({
                            x: parseInt(seat.style.left),
                            y: parseInt(seat.style.top)
                        }));
                        
                        const centerX = seatPositions.reduce((sum, p) => sum + p.x, 0) / seatPositions.length;
                        const minY = Math.min(...seatPositions.map(p => p.y));

                        // 실제 선택 가능한 좌석만 필터링
                        return seats
                            .filter(seat => seat.title)
                            .map(seat => {
                                const x = parseInt(seat.style.left);
                                const y = parseInt(seat.style.top);
                                
                                return { 
                                    id: seat.id, 
                                    distance: Math.sqrt(
                                        Math.pow(x - centerX, 2) + 
                                        Math.pow(y - minY, 2)
                                    )
                                };
                            })
                            .sort((a, b) => a.distance - b.distance);
                    }, params);

                    if (seats.length > 0) {
                        for (const seat of seats) {
                            try {
                                await frame.click(`#${seat.id}`);
                                const result = await frame.evaluate(() => {
                                    return new Promise((resolve) => {
                                        const originalAlert = window.alert;
                                        window.alert = (message) => {
                                            window.alert = originalAlert;
                                            resolve(false);
                                        };
                                        try {
                                            ChoiceEnd();
                                            setTimeout(() => {
                                                window.alert = originalAlert;
                                                resolve(true);
                                            }, 500);
                                        } catch {
                                            window.alert = originalAlert;
                                            resolve(false);
                                        }
                                    });
                                });

                                if (result) {
                                    success = true;
                                    break;
                                }
                            } catch {
                                continue;
                            }
                        }
                    }
                    
                    if (!success) blockIndex++;
                } catch {
                    blockIndex++;
                    continue;
                }
            }

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
            ]);

            if (await page.$('#captchaImg')) {
                const MAX_ATTEMPT = 15;
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
            }
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
            await page.setViewport({ width: 0, height: 0 });

            await page.waitForSelector(`[id="${targetDate}"]`);
            await page.click(`[id="${targetDate}"]`);
            await page.waitForSelector('#ulTime li');
            await page.click(`[timeinfo="${targetTime}"]`);
            await page.click('#btnSeatSelect');

            await page.waitForSelector('iframe[name="ifrmSeatFrame"]');
            const frame = await (await page.$('iframe[name="ifrmSeatFrame"]')).contentFrame();
            await frame.waitForSelector('.minimap_m');
            try {
                await frame.waitForSelector('.minimap_m .btn_all', {timeout: 100});
            } catch (err) {

            }
            
            let sortedBlockIndices = [-1];
            if (await frame.$('.minimap_m .btn_all')) {
                await frame.waitForSelector('map[name="map_ticket"] area');
                sortedBlockIndices = await frame.evaluate(() => {
                    const areas = document.querySelectorAll('map[name="map_ticket"] area');
                    const areaShapes = Array.from(areas)
                        .map(area => {
                            const blockNumber = parseInt(area.getAttribute('href').match(/ChangeBlock\((\d+)\)/)[1]);
                            if (typeof ArBlockRemain !== 'undefined' && ArBlockRemain[blockNumber] > 0) {
                                const coords = area.getAttribute('coords').split(',').map(Number);
                                let centerX = 0, centerY = 0;
                                for (let i = 0; i < coords.length; i += 2) {
                                    centerX += coords[i];
                                    centerY += coords[i + 1];
                                }
                                centerX /= (coords.length / 2);
                                centerY /= (coords.length / 2);
                                
                                return {
                                    center: { x: centerX, y: centerY },
                                    blockNumber: blockNumber
                                };
                            }
                            return null;
                        })
                        .filter(shape => shape !== null); // null 값 제거

                    if (areaShapes.length === 0) return [-1]; // 사용 가능한 블록이 없는 경우

                    // 무대는 전체 영역의 상단 중앙
                    const minY = Math.min(...areaShapes.map(s => s.center.y));
                    const centerX = areaShapes.reduce((sum, s) => sum + s.center.x, 0) / areaShapes.length;
                    
                    return areaShapes
                        .map(shape => ({
                            index: shape.blockNumber,
                            distance: 
                                Math.pow(shape.center.x - centerX, 2) + 
                                Math.pow(shape.center.y - minY, 2)
                        }))
                        .sort((a, b) => a.distance - b.distance)
                        .map(block => block.index);
                });
            } else if (await frame.$('#blockFile')) {
                await frame.waitForSelector('map[name="maphall"] area');
                sortedBlockIndices = await frame.evaluate(() => {
                    const areas = document.querySelectorAll('map[name="maphall"] area');
                    const areaShapes = Array.from(areas)
                        .map(area => {
                            const blockNumber = parseInt(area.getAttribute('onclick').match(/ChangeBlock\((\d+)\)/)[1]);
                            if (typeof ArBlockRemain !== 'undefined' && ArBlockRemain[blockNumber] > 0) {
                                const coords = area.getAttribute('coords').split(',').map(Number);
                                let centerX = 0, centerY = 0;
                                for (let i = 0; i < coords.length; i += 2) {
                                    centerX += coords[i];
                                    centerY += coords[i + 1];
                                }
                                centerX /= (coords.length / 2);
                                centerY /= (coords.length / 2);
                                
                                return {
                                    center: { x: centerX, y: centerY },
                                    blockNumber: blockNumber
                                };
                            }
                            return null;
                        })
                        .filter(shape => shape !== null); // null 값 제거

                    if (areaShapes.length === 0) return [-1]; // 사용 가능한 블록이 없는 경우

                    // 무대는 전체 영역의 상단 중앙
                    const minY = Math.min(...areaShapes.map(s => s.center.y));
                    const centerX = areaShapes.reduce((sum, s) => sum + s.center.x, 0) / areaShapes.length;
                    
                    return areaShapes
                        .map(shape => ({
                            index: shape.blockNumber,
                            distance: 
                                Math.pow(shape.center.x - centerX, 2) + 
                                Math.pow(shape.center.y - minY, 2)
                        }))
                        .sort((a, b) => a.distance - b.distance)
                        .map(block => block.index);
                });
            }
            let success = false;
            let blockIndex = 0;

            await page.on('dialog', async (dialog) => await dialog.accept());

            while (blockIndex < sortedBlockIndices.length && !success) {
                try {
                    if (sortedBlockIndices[blockIndex] !== -1) {
                        await frame.evaluate((blockNumber) => {
                            ChangeBlock(blockNumber);
                        }, sortedBlockIndices[blockIndex]);
                    }

                    await frame.waitForSelector('div[name=tk]');
                    const seats = await frame.evaluate((params) => {
                        const seats = Array.from(document.querySelectorAll(`div${params.grade ? '[grade=\"' + params.grade + '석\"]' : ''}[name="tk"]`));
                        if (!seats.length) return [];

                        // 모든 좌석의 평균 위치 계산에 title 유무와 관계없이 모든 좌석 사용
                        const seatPositions = seats.map(seat => ({
                            x: parseInt(seat.style.left),
                            y: parseInt(seat.style.top)
                        }));
                        
                        const centerX = seatPositions.reduce((sum, p) => sum + p.x, 0) / seatPositions.length;
                        const minY = Math.min(...seatPositions.map(p => p.y));

                        // 실제 선택 가능한 좌석만 필터링
                        return seats
                            .filter(seat => seat.title)
                            .map(seat => {
                                const x = parseInt(seat.style.left);
                                const y = parseInt(seat.style.top);
                                
                                return { 
                                    id: seat.id, 
                                    distance: Math.sqrt(
                                        Math.pow(x - centerX, 2) + 
                                        Math.pow(y - minY, 2)
                                    )
                                };
                            })
                            .sort((a, b) => a.distance - b.distance);
                    }, params);

                    if (seats.length > 0) {
                        for (const seat of seats) {
                            try {
                                await frame.click(`#${seat.id}`);
                                const result = await frame.evaluate(() => {
                                    return new Promise((resolve) => {
                                        const originalAlert = window.alert;
                                        window.alert = (message) => {
                                            window.alert = originalAlert;
                                            resolve(false);
                                        };
                                        try {
                                            ChoiceEnd();
                                            setTimeout(() => {
                                                window.alert = originalAlert;
                                                resolve(true);
                                            }, 500);
                                        } catch {
                                            window.alert = originalAlert;
                                            resolve(false);
                                        }
                                    });
                                });

                                if (result) {
                                    success = true;
                                    break;
                                }
                            } catch {
                                continue;
                            }
                        }
                    }
                    
                    if (!success) blockIndex++;
                } catch {
                    blockIndex++;
                    continue;
                }
            }
            
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
            ]);

            if (await page.$('#captchaImg')) {
                const MAX_ATTEMPT = 15;
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
            }

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