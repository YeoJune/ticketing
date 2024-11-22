class App {
    constructor() {
        this.sites = [];
        this.accounts = [];
        this.currentSite = null;
        this.ticketingStatus = new Map(); // 티켓팅 상태 추적
        this.successMessages = new Set(); // 성공 메시지 저장
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

    updateTicketingStatus(accountIndex, status) {
        const statusContainer = document.getElementById(`status-${accountIndex}`);
        if (statusContainer) {
            statusContainer.textContent = status;
            statusContainer.className = `status ${status.toLowerCase()}`;
        }
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

    selectAllAccounts() {
        const accounts = document.querySelectorAll('#accountList input[type="checkbox"]');
        accounts.forEach(account => account.checked = true);
    }

    getSelectedAccounts() {
        return Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => this.accounts[checkbox.id.split('-')[1]]);
    }

    async startTicketing() {
        const selectedAccounts = this.getSelectedAccounts();
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

    async startCancelTicketing() {
        const selectedAccounts = this.getSelectedAccounts();
        if (selectedAccounts.length === 0) {
            alert('계정을 선택해주세요.');
            return;
        }

        await window.api.startExecution({
            siteId: this.currentSite,
            accounts: selectedAccounts
        });

        // 상태 초기화
        this.ticketingStatus.clear();
        selectedAccounts.forEach((_, index) => {
            this.ticketingStatus.set(index, 'RUNNING');
        });

        this.showView('cancelTicketingView');
        document.getElementById('stopCancelTicketing').style.display = 'block';
        this.renderTicketingStatus();
    }

    async executeCancelTicketing(event) {
        event.preventDefault();
        const params = {
            url: document.getElementById('cancelTargetUrl').value,
            date: document.getElementById('cancelTargetDate').value,
            time: document.getElementById('cancelTargetTime').value,
            grade: document.getElementById('cancelGrade').value || null,
            floor: document.getElementById('cancelFloor').value || null,
            startTime: document.getElementById('cancelStartTime').value,
            endTime: document.getElementById('cancelEndTime').value || null
        };

        await window.api.startCancelTicketing({
            siteId: this.currentSite,
            params
        });
    }

    async stopCancelTicketing() {
        await window.api.stopCancelTicketing();
        document.getElementById('stopCancelTicketing').style.display = 'none';
    }

    goBack(viewId) {
        if (viewId === 'siteView') {
            this.currentSite = null;
            this.accounts = [];
        } else if (viewId === 'accountView') {
            window.api.closeBrowsers();
            window.api.returnToMain();
        }
        
        this.showView(viewId);
    }
    
    showView(viewId) {
        ['siteView', 'accountView', 'executionView', 'cancelTicketingView'].forEach(id => {
            document.getElementById(id).style.display = id === viewId ? 'block' : 'none';
        });
    }
    startAlarm() {
        const successSound = document.getElementById('successSound');
        successSound.loop = true;
        successSound.play().catch(e => console.log('알림음 재생 실패:', e));
    }

    stopAlarm() {
        const successSound = document.getElementById('successSound');
        successSound.pause();
        successSound.currentTime = 0;
    }

    showSuccessModal() {
        const modal = document.getElementById('successModal');
        const messagesContainer = document.getElementById('successMessages');
        
        messagesContainer.innerHTML = Array.from(this.successMessages)
            .map(message => `<div class="success-message">${message}</div>`)
            .join('');
        
        modal.style.display = 'block';
    }

    closeSuccessModal() {
        const modal = document.getElementById('successModal');
        modal.style.display = 'none';
        this.successMessages.clear();
        this.stopAlarm();
    }

    setupEventListeners() {
        document.getElementById('accountForm').onsubmit = e => this.addAccount(e);
        document.getElementById('executionForm').onsubmit = e => this.scheduleTicketing(e);
        document.getElementById('cancelTicketingForm').onsubmit = e => this.executeCancelTicketing(e);
        document.getElementById('stopCancelTicketing').onclick = () => {
            this.stopAlarm();
            this.stopCancelTicketing();
        };

        // 취소표 티켓팅 상태 리스너
        window.api.onCancelTicketingStatus(({ accountIndex, success }) => {
            this.ticketingStatus.set(accountIndex, success ? 'SUCCESS' : 'RUNNING');
            this.renderTicketingStatus();
            
            if (success) {
                // 성공 메시지 추가
                this.successMessages.add(`계정 ${accountIndex + 1}번이 티켓팅에 성공했습니다!`);
                
                // 알람이 아직 재생 중이 아니면 시작
                const successSound = document.getElementById('successSound');
                if (successSound.paused) {
                    this.startAlarm();
                }
                
                // 모달 표시
                this.showSuccessModal();
            }
        });

        window.api.onCancelTicketingStopped(() => {
            this.stopAlarm();
            document.getElementById('stopCancelTicketing').style.display = 'none';
            this.successMessages.clear();
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeSuccessModal();
            }
        });

        // 모달 외부 클릭으로 닫기
        document.getElementById('successModal').onclick = (event) => {
            if (event.target.id === 'successModal') {
                this.closeSuccessModal();
            }
        };
    }

    renderTicketingStatus() {
        const statusContainer = document.getElementById('ticketingStatus');
        if (!statusContainer) return;

        statusContainer.innerHTML = Array.from(this.ticketingStatus.entries())
            .map(([index, status]) => `
                <div class="status-item">
                    <span>계정 ${index + 1}</span>
                    <span class="status ${status.toLowerCase()}">${status}</span>
                </div>
            `).join('');
    }
}

const app = new App();