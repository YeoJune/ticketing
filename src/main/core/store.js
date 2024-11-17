// core/store.js
const Store = require('electron-store');

class StoreManager {
    constructor() {
        this.store = new Store();
    }

    getAccounts(siteId) {
        return this.store.get(`accounts.${siteId}`, []);
    }

    saveAccount(siteId, account) {
        const accounts = this.getAccounts(siteId);
        accounts.push(account);
        this.store.set(`accounts.${siteId}`, accounts);
    }

    removeAccount(siteId, index) {
        const accounts = this.getAccounts(siteId);
        accounts.splice(index, 1);
        this.store.set(`accounts.${siteId}`, accounts);
    }
}

module.exports = StoreManager;