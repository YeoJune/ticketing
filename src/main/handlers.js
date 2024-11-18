// handlers.js
function setupHandlers(browserManager, storeManager, { sites, ticketingFunctions, loginFunctions }) {
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
            for (const [index, account] of accounts.entries()) {
                const { page } = await browserManager.createBrowser(index);
                loginFunctions[siteId](page, sites[siteId], account);
            }
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