// config/sites.js
const ImageToTextConverter = require('../core/ImageToTextConverter');
const os = require('os');
const fs = require('fs/promises');
const path = require('path');

/**
 * Utility functions for ticketing automation
 */
const utils = {
    /**
     * Wait for image element to be fully loaded
     * @param {Page} page - Puppeteer page object
     * @param {string} selector - Image element selector
     */
    async waitForImageLoad(page, selector) {
        await page.waitForFunction(
            (sel) => {
                const img = document.querySelector(sel);
                if (!img) return false;
                return img.complete && img.naturalWidth > 0;
            },
            { timeout: 10000 },
            selector
        );
    },

    /**
     * Normalize date and time formats
     * @param {Object} params - Input parameters
     * @param {string} params.date - Target date
     * @param {string} params.time - Target time 
     * @returns {Object} Normalized date and time
     */
    normalizeDateTime(params) {
        let targetDate = params.date;
        if (!targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            targetDate = new Date(params.date).toISOString().split('T')[0];
        }
        
        let targetTime = params.time;
        if (!targetTime.match(/^\d{2}:\d{2}$/)) {
            targetTime = new Date(`2000-01-01T${params.time}`).toTimeString().slice(0, 5);
        }

        return { targetDate, targetTime };
    },

    /**
     * Handle CAPTCHA verification process
     * @param {Page} page - Puppeteer page object
     */
    async handleCaptcha(page) {
        if (await page.$('#captchaImg')) {
            const MAX_ATTEMPT = 15;
            let attempt = 0;
            let captchaText = '';
            while (attempt < MAX_ATTEMPT && !/^\d{6}$/.test(captchaText)) {
                if (attempt) {
                    await page.evaluate(() => { 
                        initCaptcha();
                    });
                    await sleep(50);
                }
                
                await this.waitForImageLoad(page, '#captchaImg');
                const captchaElement = await page.$('#captchaImg');
                const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

                const tempPath = path.join(os.tmpdir(), `captcha-${Date.now()}.png`);
                const buffer = Buffer.from(captchaBase64, 'base64');
                await fs.writeFile(tempPath, buffer);
    
                const converter = new ImageToTextConverter();
                captchaText = await converter.extractText(tempPath);
                attempt += 1;
            }

            await page.evaluate((text) => {
                document.querySelector('#captchaText').value = text;
            }, captchaText);    
        }
    },

    /**
     * Get sorted block indices for seat selection
     * @param {Frame} frame - Puppeteer frame object
     * @returns {Array<number>} Sorted block indices
     */
    async getSortedBlockIndices(frame) {
        try {
            await frame.waitForSelector('.minimap_m .btn_all', {timeout: 150});
        } catch (err) {

        }
        let sortedBlockIndices = [-1];
        if (await frame.$('.minimap_m .btn_all')) {
            await frame.waitForSelector('map[name="map_ticket"] area');
            sortedBlockIndices = await this.calculateBlockIndices(frame, 'map_ticket');
        } else if (await frame.$('#blockFile')) {
            await frame.waitForSelector('map[name="maphall"] area');
            sortedBlockIndices = await this.calculateBlockIndices(frame, 'maphall');
        }
        return sortedBlockIndices;
    },

    /**
     * Calculate block indices based on distance from stage
     * @param {Frame} frame - Puppeteer frame object
     * @param {string} mapName - Map element name
     * @returns {Array<number>} Calculated block indices
     */
    async calculateBlockIndices(frame, mapName) {
        return await frame.evaluate((mapName) => {
            const areas = document.querySelectorAll(`map[name="${mapName}"] area`);
            const areaShapes = Array.from(areas)
                .map(area => {
                    const blockNumber = parseInt(
                        area.getAttribute(mapName === 'map_ticket' ? 'href' : 'onclick')
                            .match(/ChangeBlock\((\d+)\)/)[1]
                    );
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
                .filter(shape => shape !== null);

            if (areaShapes.length === 0) return [-1];

            const minY = Math.min(...areaShapes.map(s => s.center.y));
            const centerX = areaShapes.reduce((sum, s) => sum + s.center.x, 0) / areaShapes.length;
            
            return areaShapes
                .map(shape => ({
                    index: shape.blockNumber,
                    distance: Math.pow(shape.center.x - centerX, 2) + Math.pow(shape.center.y - minY, 2)
                }))
                .sort((a, b) => a.distance - b.distance)
                .map(block => block.index);
        }, mapName);
    }
};

// Site configurations
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
/**
 * Main ticketing automation functions
 */
const ticketingFunctions = {
    'yes24 global': async (page, params) => {
        try {
            const { targetDate, targetTime } = utils.normalizeDateTime(params);
            
            // Navigate and select performance
            await page.goto(params.url);
            console.log(`Starting ticketing process for ${targetDate} ${targetTime}`);
            const newPage = await handleNewPageCreation(page, '.sinfo a');
            await newPage.setViewport({ width: 0, height: 0 });
            
            // Select date and time
            await selectDateTime(newPage, targetDate, targetTime);
            
            // Handle seat selection
            const success = await handleSeatSelection(newPage, params);
            if (!success) return false;
            
            // Complete booking process
            await completeBookingGlobal(newPage);
            
            return true;
        } catch (error) {
            console.error('Ticketing execution failed:', error);
            throw error;
        }
    },
    'yes24': async (page, params) => {
        try {
            const { targetDate, targetTime } = utils.normalizeDateTime(params);
            const formattedTime = `${targetTime.split(':')[0]}시 ${targetTime.split(':')[1]}분`;
            
            // Navigate and select performance
            await page.goto(params.url);
            console.log(`Starting ticketing process for ${targetDate} ${formattedTime}`);
            await page.evaluate(() => {
                jsf_pdi_GoPerfSale();
            });
            const newPage = await handleNewPageCreation(page, 'a.rn-bb03');
            await newPage.setViewport({ width: 0, height: 0 });
            
            // Select date and time
            await selectDateTimeLocal(newPage, targetDate, formattedTime);
            
            // Handle seat selection
            const success = await handleSeatSelection(newPage, params);
            if (!success) return false;
            
            // Complete booking process
            await completeBookingLocal(newPage);
            
            return true;
        } catch (error) {
            console.error('YES24 Ticketing execution failed:', error);
            throw error;
        }
    }
};

/**
 * Automated seat selection attempt
 * @param {Frame} frame - Puppeteer frame object
 * @param {Array<number>} sortedBlockIndices - Array of block indices sorted by preference
 * @param {Object} params - Seat selection parameters
 * @returns {Promise<boolean>} Success status of seat selection
 */
async function attemptSeatSelection(frame, sortedBlockIndices, params) {
    try {
        let blockIndex = 0;
        let success = false;

        await frame.on('dialog', async (dialog) => await dialog.accept());

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

                    // Calculate average position of all seats
                    const seatPositions = seats.map(seat => ({
                        x: parseInt(seat.style.left),
                        y: parseInt(seat.style.top)
                    }));
                    
                    const centerX = seatPositions.reduce((sum, p) => sum + p.x, 0) / seatPositions.length;
                    const minY = Math.min(...seatPositions.map(p => p.y));

                    // Filter and sort available seats
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

        return success;
    } catch (error) {
        console.error('Seat selection attempt failed:', error);
        return false;
    }
}
/**
 * Automation functions for cancel ticketing operations
 */
const cancelTicketingFunctions = {
    'yes24 global': async (page, params) => {
        try {
            const { targetDate, targetTime } = utils.normalizeDateTime(params);
            const startTime = new Date(params.startTime);
            const endTime = params.endTime ? new Date(params.endTime) : null;
            
            while (true) {
                const currentTime = new Date();
                if (endTime && currentTime > endTime) {
                    return false;
                }
                
                if (currentTime >= startTime) {
                    // Navigate and select performance
                    await page.goto(params.url);
                    console.log(`Attempting cancel ticketing for ${targetDate} ${targetTime}`);
                    const newPage = await handleNewPageCreation(page, '.sinfo a');
                    await newPage.setViewport({ width: 0, height: 0 });
                    
                    // Select date and time
                    await selectDateTime(newPage, targetDate, targetTime);
                    
                    // Handle seat selection with continuous retry
                    const success = await handleSeatSelection(newPage, params, true);
                    if (success) {
                        // Complete booking process
                        await completeBookingGlobal(newPage);
                        return true;
                    }
                }
                
                await sleep(1000); // Wait before next attempt
            }
        } catch (error) {
            console.error('Cancel ticketing execution failed:', error);
            throw error;
        }
    },
    'yes24': async (page, params) => {
        try {
            const { targetDate, targetTime } = utils.normalizeDateTime(params);
            const formattedTime = `${targetTime.split(':')[0]}시 ${targetTime.split(':')[1]}분`;
            const startTime = new Date(params.startTime);
            const endTime = params.endTime ? new Date(params.endTime) : null;
            
            while (true) {
                const currentTime = new Date();
                if (endTime && currentTime > endTime) {
                    return false;
                }
                
                if (currentTime >= startTime) {
                    // Navigate and select performance
                    await page.goto(params.url);
                    console.log(`Attempting cancel ticketing for ${targetDate} ${formattedTime}`);
                    
                    // Open ticketing window
                    await page.evaluate(() => {
                        jsf_pdi_GoPerfSale();
                    });
                    const newPage = await handleNewPageCreation(page, 'a.rn-bb03');
                    await newPage.setViewport({ width: 0, height: 0 });
                    
                    // Select date and time
                    await selectDateTimeLocal(newPage, targetDate, formattedTime);
                    
                    // Handle seat selection with continuous retry
                    const success = await handleSeatSelection(newPage, params, true);
                    if (success) {
                        // Complete booking process
                        await completeBookingLocal(newPage);
                        return true;
                    }
                }
                
                await sleep(1000); // Wait before next attempt
            }
        } catch (error) {
            console.error('YES24 Cancel ticketing execution failed:', error);
            throw error;
        }
    }
};

/**
 * Login automation functions for different sites
 */
const loginFunctions = {
    'yes24 global': async (page, site, account) => {
        try {
            await page.goto(site.loginUrl);
            await Promise.all([
                page.waitForSelector(site.selectors.id),
                page.waitForSelector(site.selectors.pw),
            ]);
            
            // Input login credentials and submit
            await page.evaluate((q1, v1, q2, v2) => {
                document.querySelector(q1).setAttribute('value', v1);
                document.querySelector(q2).setAttribute('value', v2);
                jsf_mem_login();
            }, site.selectors.id, account.username, site.selectors.pw, account.password);
        } catch (error) {
            console.error('YES24 Global Login failed:', error);
            throw error;
        }
    },
    'yes24': async (page, site, account) => {
        try {
            await page.goto(site.loginUrl);
            await Promise.all([
                page.waitForSelector(site.selectors.id),
                page.waitForSelector(site.selectors.pw),
            ]);
            
            // Input login credentials
            await page.evaluate((q1, v1, q2, v2) => {
                document.querySelector(q1).setAttribute('value', v1);
                document.querySelector(q2).setAttribute('value', v2);
            }, site.selectors.id, account.username, site.selectors.pw, account.password);
            
            // Click login button and wait for navigation
            await page.click(site.selectors.login);
            await page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 30000
            });
        } catch (error) {
            console.error('YES24 Login failed:', error);
            throw error;
        }
    }
};
/**
 * Helper functions for booking process
 */

/**
 * Handle creation of new page for ticketing
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<Page>} New page instance
 */
async function handleNewPageCreation(page, selector) {
    try {
        const newPagePromise = new Promise(resolve =>
            page.browser().on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    resolve(await target.page());
                }
            })
        );
        await page.click(selector);
        return await newPagePromise;
    } catch (error) {
        console.error('New page creation failed:', error);
        throw error;
    }
}

/**
 * Select date and time for global site
 * @param {Page} page - Puppeteer page object
 * @param {string} targetDate - Target date in YYYY-MM-DD format
 * @param {string} targetTime - Target time in HH:mm format
 */
async function selectDateTime(page, targetDate, targetTime) {
    try {
        await page.waitForSelector(`[id="${targetDate}"]`);
        await page.click(`[id="${targetDate}"]`);
        await page.waitForSelector('#ulTime li');
        await page.click(`[timeinfo="${targetTime}"]`);
        await page.click('#btnSeatSelect');
    } catch (error) {
        console.error('Date/Time selection failed:', error);
        throw error;
    }
}

/**
 * Select date and time for local site
 * @param {Page} page - Puppeteer page object
 * @param {string} targetDate - Target date in YYYY-MM-DD format
 * @param {string} targetTime - Target time in HH시 mm분 format
 */
async function selectDateTimeLocal(page, targetDate, targetTime) {
    try {
        await page.waitForSelector(`[id="${targetDate}"]`);
        await page.click(`[id="${targetDate}"]`);
        await page.waitForSelector('#ulTime li');
        await page.click(`[timeinfo="${targetTime}"]`);
        await page.click('#btnSeatSelect');
    } catch (error) {
        console.error('Local date/time selection failed:', error);
        throw error;
    }
}

/**
 * Handle seat selection process
 * @param {Page} page - Puppeteer page object
 * @param {Object} params - Seat selection parameters
 * @param {boolean} continousRetry - Whether to continuously retry seat selection
 * @returns {Promise<boolean>} Success status of seat selection
 */
async function handleSeatSelection(page, params, continousRetry = false) {
    try {
        await page.waitForSelector('iframe[name="ifrmSeatFrame"]');
        const frame = await (await page.$('iframe[name="ifrmSeatFrame"]')).contentFrame();
        await frame.waitForSelector('.minimap_m');
        
        do {
            const sortedBlockIndices = await utils.getSortedBlockIndices(frame);
            const success = await attemptSeatSelection(frame, sortedBlockIndices, params);
            if (success || !continousRetry) return success;
            await sleep(1000);
        } while (continousRetry);
    } catch (error) {
        console.error('Seat selection handling failed:', error);
        throw error;
    }
}

/**
 * Complete booking process for global site
 * @param {Page} page - Puppeteer page object
 */
async function completeBookingGlobal(page) {
    try {
        // Handle promotions
        await page.waitForSelector('#spanPromotionSeat input[value]');
        await page.evaluate(() => {
            fdc_PromotionEnd();
        });
        
        // Handle delivery information
        await Promise.all([
            page.waitForSelector('#rdoDeliveryBase[value]'),
            page.waitForSelector('#LUAddr_UserName[value]'),
        ]);
        await page.evaluate(() => {
            fdc_DeliveryEnd();
        });
        
        // Handle payment information
        await Promise.all([
            page.waitForSelector('#rdoPays2'),
            page.waitForSelector('#cbxUserInfoAgree'),
            page.waitForSelector('#cbxCancelFeeAgree'),
        ]);
        
        // Process CAPTCHA verification
        await utils.handleCaptcha(page);
        
        // Complete payment process
        await page.evaluate(() => {
            document.querySelector('#rdoPays2').click();
            document.querySelector('#cbxUserInfoAgree').click();
            document.querySelector('#cbxCancelFeeAgree').click();
            fdc_PrePayCheck();
        });
    } catch (error) {
        console.error('Global booking completion failed:', error);
        throw error;
    }
}

/**
 * Complete booking process for local site
 * @param {Page} page - Puppeteer page object
 */
async function completeBookingLocal(page) {
    try {
        // Handle promotions
        await page.waitForSelector('#spanPromotionSeat input[value]');
        await page.evaluate(() => {
            fdc_PromotionEnd();
        });
        
        // Handle delivery information
        await Promise.all([
            page.waitForSelector('#deliveryPos input[value]'),
            page.waitForSelector('#LUAddr_UserName[value]'),
            page.waitForSelector('#LUAddr_MailH[value]'),
            page.waitForSelector('#LUAddr_MailD[value]'),
        ]);
        
        // Input contact information
        await page.evaluate(() => {
            document.querySelector('#ordererMobile1').value = '010';
            document.querySelector('#ordererMobile2').value = '0000';
            document.querySelector('#ordererMobile3').value = '0000';
            fdc_DeliveryEnd();
        });
        
        // Handle payment information
        await Promise.all([
            page.waitForSelector('#rdoPays2'),
            page.waitForSelector('#cbxAllAgree'),
        ]);
        
        // Process CAPTCHA verification
        await utils.handleCaptcha(page);
        
        // Complete payment process
        await page.evaluate(() => {
            document.querySelector('#rdoPays2').click();
            document.querySelector('#cbxAllAgree').click();
            fdc_PrePayCheck();
        });
    } catch (error) {
        console.error('Local booking completion failed:', error);
        throw error;
    }
}

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    sites,
    ticketingFunctions,
    cancelTicketingFunctions,
    loginFunctions
};