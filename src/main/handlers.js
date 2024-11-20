// handlers.js
const { calculateGridSize } = require('../utils');

function setupHandlers(browserManager, storeManager, { sites, ticketingFunctions, cancelTicketingFunctions, loginFunctions }, mainWindow) {
    // 기존 핸들러 유지
    const existingHandlers = {
        'get-sites': () => {
            return Object.values(sites).map(site => ({
                id: site.id,
                name: site.name,
                loginUrl: site.loginUrl
            }));
        },
        'get-accounts': (siteId) => 
            storeManager.getAccounts(siteId),
        'save-account': (siteId, account) => 
            storeManager.saveAccount(siteId, account),
        'remove-account': (siteId, index) => 
            storeManager.removeAccount(siteId, index),
        'start-execution': async ({ siteId, accounts }) => {
            const { cellWidth, cellHeight } = calculateGridSize(3);
            mainWindow.setPosition(0, 0);
            mainWindow.setSize(cellWidth, cellHeight);
            for (const [index, account] of accounts.entries()) {
                (async () => {
                    const { page } = await browserManager.createBrowser(index);
                    await loginFunctions[siteId](page, sites[siteId], account);
                })()
            }
        },
        'return-to-main': async () => {
            mainWindow.setSize(800, 600);
            mainWindow.center();
        },
        'close-browsers': async () => {
            await browserManager.closeAll();
        },
        'schedule-ticketing': async ({ siteId, params, time }) => {
            const delay = new Date(time) - new Date();
            setTimeout(() => {
                browserManager.instances.forEach(({ page }) => {
                    ticketingFunctions[siteId](page, params);
                });
            }, delay);
        },
    };

    // 취소 티켓팅을 위한 새로운 핸들러
    const cancelTicketingHandlers = {
        'start-cancel-ticketing': async ({ siteId, params, accounts }) => {
            try {
                const { cellWidth, cellHeight } = calculateGridSize(3);
                mainWindow.setPosition(0, 0);
                mainWindow.setSize(cellWidth, cellHeight);
                
                // 각 계정별로 취소 티켓팅 실행
                for (const [index, account] of accounts.entries()) {
                    (async () => {
                        const { page } = await browserManager.createBrowser(index);
                        // 로그인 수행
                        await loginFunctions[siteId](page, sites[siteId], account);
                        // 취소 티켓팅 시작
                        const result = await cancelTicketingFunctions[siteId](page, params);
                        // 결과를 프론트엔드로 전송
                        mainWindow.webContents.send('cancel-ticketing-status', {
                            accountIndex: index,
                            success: result
                        });
                    })();
                }
                return true;
            } catch (error) {
                console.error('Cancel ticketing execution failed:', error);
                return false;
            }
        },
        'stop-cancel-ticketing': async () => {
            try {
                await browserManager.closeAll();
                mainWindow.webContents.send('cancel-ticketing-stopped');
                return true;
            } catch (error) {
                console.error('Failed to stop cancel ticketing:', error);
                return false;
            }
        }
    };

    // 모든 핸들러 통합
    return {
        ...existingHandlers,
        ...cancelTicketingHandlers
    };
}

module.exports = setupHandlers;