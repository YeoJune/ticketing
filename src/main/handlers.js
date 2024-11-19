// handlers.js
const { calculateGridSize } = require('../utils');

function setupHandlers(browserManager, storeManager, { sites, ticketingFunctions, loginFunctions }, mainWindow) {
    return {
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
}

module.exports = setupHandlers;