// renderer/script.js
class App {
    constructor() {
        this.sites = [];
        this.accounts = [];
        this.currentSite = null;
        this.showView('siteView');
        this.setupEventListeners();
        this.loadSites();
    }

    async loadSites() {
        this.sites = await window.api.getSites();
        this.renderSites();
    }

    async loadAccounts(siteId) {
        this.accounts = await window.api.getAccounts(siteId);
        this.renderAccounts();
    }

    renderSites() {
        const container = document.getElementById('siteList');
        container.innerHTML = this.sites.map(site => `
            <div class="site-item">
                <span>${site.name}</span>
                <button onclick="app.selectSite('${site.id}')">선택</button>
            </div>
        `).join('');
    }

    renderAccounts() {
        const container = document.getElementById('accountList');
        container.innerHTML = this.accounts.map((account, index) => `
            <div class="account-item">
                <input type="checkbox" id="account-${index}">
                <span>${account.username}</span>
                <button onclick="app.removeAccount(${index})">삭제</button>
            </div>
        `).join('');
    }

    async selectSite(siteId) {
        this.currentSite = siteId;
        await this.loadAccounts(siteId);
        this.showView('accountView');
    }

    async addAccount(event) {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        await window.api.saveAccount(this.currentSite, { username, password });
        await this.loadAccounts(this.currentSite);
        
        event.target.reset();
    }

    async removeAccount(index) {
        await window.api.removeAccount(this.currentSite, index);
        await this.loadAccounts(this.currentSite);
    }

    async startExecution() {
        const selectedAccounts = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => this.accounts[checkbox.id.split('-')[1]]);

        if (selectedAccounts.length === 0) {
            alert('계정을 선택해주세요.');
            return;
        }

        await window.api.startExecution({
            siteId: this.currentSite,
            accounts: selectedAccounts
        });

        this.showView('executionView');
    }

    async scheduleTicketing(event) {
        event.preventDefault();
        const params = {
            url: document.getElementById('targetUrl').value,
            date: document.getElementById('targetDate').value,
            time: document.getElementById('targetTime').value,
            grade: document.getElementById('grade').value || null,
            floor: document.getElementById('floor').value || null
        };
        const executionTime = document.getElementById('executionTime').value;
    
        await window.api.scheduleTicketing({
            siteId: this.currentSite,
            params,
            time: executionTime
        });
    
        alert('예약이 완료되었습니다.');
    }

    showView(viewId) {
        ['siteView', 'accountView', 'executionView'].forEach(id => {
            document.getElementById(id).style.display = id === viewId ? 'block' : 'none';
        });
    }

    setupEventListeners() {
        document.getElementById('accountForm').onsubmit = e => this.addAccount(e);
        document.getElementById('executionForm').onsubmit = e => this.scheduleTicketing(e);
    }
}

const app = new App();