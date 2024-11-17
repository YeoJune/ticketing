const { ipcRenderer } = require('electron');

// 전역 변수
let currentSiteId = null;
let accounts = [];
let editingIndex = -1;
let isDatePickerVisible = false;

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    initializeTimeOptions();
    initializeDateTimeInputs();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    loadSites();
    setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 계정 폼 제출
    document.getElementById('accountForm').addEventListener('submit', handleAccountFormSubmit);

    // 전체 선택 체크박스
    document.getElementById('selectAllAccounts').addEventListener('change', handleSelectAll);

    // 취소 버튼
    document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

    // 삭제 선택 버튼
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedAccounts);

    // 실행 폼 제출
    document.getElementById('executionForm').addEventListener('submit', handleExecutionFormSubmit);

    // 시간 입력 자동 포맷팅
    document.getElementById('targetTime').addEventListener('input', handleTimeInput);

    // 날짜 입력 자동 포맷팅
    document.getElementById('targetDateText').addEventListener('input', handleDateInput);

    // 창 크기 조절
    window.addEventListener('resize', handleWindowResize);
}

// 사이트 관리
async function loadSites() {
    const sites = await ipcRenderer.invoke('get-target-sites');
    const siteList = document.getElementById('siteList');
    siteList.innerHTML = '';

    sites.forEach(site => {
        const div = document.createElement('div');
        div.className = 'site-card hover:bg-gray-50';
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-medium">${site.name}</h3>
                <button onclick="selectSite('${site.id}')" class="btn-primary">선택</button>
            </div>
        `;
        siteList.appendChild(div);
    });
}

async function selectSite(siteId) {
    currentSiteId = siteId;
    document.getElementById('siteSelection').style.display = 'none';
    document.getElementById('accountManagement').style.display = 'block';
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step2').classList.add('active');
    await loadAccounts();
}

// 계정 관리
async function loadAccounts() {
    accounts = await ipcRenderer.invoke('get-accounts', currentSiteId);
    const accountList = document.getElementById('accountList');
    accountList.innerHTML = '';

    accounts.forEach((account, index) => {
        const div = document.createElement('div');
        div.className = 'account-item';
        div.innerHTML = `
            <div class="flex items-center flex-1 cursor-pointer" onclick="toggleAccountSelection(${index})">
                <input type="checkbox" 
                       id="account-${index}" 
                       data-index="${index}" 
                       class="mr-3"
                       onclick="event.stopPropagation()">
                <label class="flex-1 cursor-pointer">${account.username}</label>
            </div>
            <div class="account-actions">
                <button onclick="editAccount(${index})" class="action-btn edit-btn">수정</button>
                <button onclick="deleteAccount(${index})" class="action-btn delete-btn">삭제</button>
            </div>
        `;
        accountList.appendChild(div);
    });

    updateDeleteSelectedButton();
}

async function handleAccountFormSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (editingIndex === -1) {
        await saveAccount();
    } else {
        await updateAccount(editingIndex, { username, password });
    }
    
    resetForm();
}

async function saveAccount() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showNotification('아이디와 비밀번호를 모두 입력해주세요.', 'error');
        return;
    }

    const account = { username, password };
    await ipcRenderer.invoke('save-account', { 
        siteId: currentSiteId, 
        account 
    });
    
    showNotification('계정이 추가되었습니다.', 'success');
    resetForm();
    await loadAccounts();
}

async function updateAccount(index, account) {
    accounts[index] = account;
    await ipcRenderer.invoke('save-accounts', { 
        siteId: currentSiteId, 
        accounts 
    });
    
    showNotification('계정이 수정되었습니다.', 'success');
    resetForm();
    await loadAccounts();
}

async function deleteAccount(index) {
    if (!confirm('선택한 계정을 삭제하시겠습니까?')) return;

    accounts.splice(index, 1);
    await ipcRenderer.invoke('save-accounts', { 
        siteId: currentSiteId, 
        accounts 
    });
    
    showNotification('계정이 삭제되었습니다.', 'success');
    await loadAccounts();
}

async function deleteSelectedAccounts() {
    const selectedIndexes = Array.from(document.querySelectorAll('#accountList input[type="checkbox"]:checked'))
        .map(checkbox => parseInt(checkbox.dataset.index));
    
    if (selectedIndexes.length === 0) {
        showNotification('선택된 계정이 없습니다.', 'error');
        return;
    }

    if (!confirm(`선택한 ${selectedIndexes.length}개의 계정을 삭제하시겠습니까?`)) return;

    accounts = accounts.filter((_, index) => !selectedIndexes.includes(index));
    await ipcRenderer.invoke('save-accounts', { 
        siteId: currentSiteId, 
        accounts 
    });
    
    showNotification(`${selectedIndexes.length}개의 계정이 삭제되었습니다.`, 'success');
    await loadAccounts();
}

// 실행 관리
async function startExecution() {
    const checkboxes = document.querySelectorAll('#accountList input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        showNotification('최소 하나의 계정을 선택해주세요.', 'error');
        return;
    }

    const sites = await ipcRenderer.invoke('get-target-sites');
    const site = sites.find(s => s.id === currentSiteId);
    
    const selectedAccounts = accounts.filter((_, index) => 
        document.getElementById(`account-${index}`).checked
    );

    document.getElementById('accountManagement').style.display = 'none';
    document.getElementById('executionMode').style.display = 'block';
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step3').classList.add('active');

    loginProgress.show();
    
    await ipcRenderer.invoke('start-execution', { site, selectedAccounts });
}

// 날짜/시간 관리
function toggleDateInputType() {
    const textInput = document.getElementById('targetDateText');
    const dateInput = document.getElementById('targetDate');
    const toggleBtn = document.getElementById('toggleDateInput');
    
    isDatePickerVisible = !isDatePickerVisible;
    if (isDatePickerVisible) {
        textInput.style.display = 'none';
        dateInput.style.display = 'block';
        toggleBtn.textContent = '직접입력';
        if (textInput.value) {
            dateInput.value = textInput.value;
        }
    } else {
        textInput.style.display = 'block';
        dateInput.style.display = 'none';
        toggleBtn.textContent = '달력';
        if (dateInput.value) {
            textInput.value = dateInput.value;
        }
    }
}

function handleTimeInput(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 4) {
        const hours = value.slice(0, 2);
        const minutes = value.slice(2, 4);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            e.target.value = `${hours}:${minutes}`;
        }
    }
}

function handleDateInput(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 8) {
        const year = value.slice(0, 4);
        const month = value.slice(4, 6);
        const day = value.slice(6, 8);
        e.target.value = `${year}-${month}-${day}`;
    }
}

// 실행 예약 시간 설정
function setExecutionTime(secondsOffset) {
    const targetDate = document.getElementById(isDatePickerVisible ? 'targetDate' : 'targetDateText').value.trim();
    const targetTime = document.getElementById('targetTime').value.trim();
    
    if (!targetDate || !targetTime) {
        showNotification('먼저 티켓팅 날짜와 시간을 입력해주세요.', 'error');
        return;
    }

    try {
        const ticketingTime = new Date(`${targetDate}T${targetTime}`);
        const executionTime = new Date(ticketingTime.getTime() + (secondsOffset * 1000));
        const now = new Date();

        // 실행 시간이 현재 시간보다 이전인 경우
        if (executionTime < now) {
            showNotification('실행 시간이 현재 시간보다 이전일 수 없습니다.', 'error');
            return;
        }

        // YYYY-MM-DD HH:MM:SS 형식으로 변환
        const formattedDateTime = executionTime.toISOString()
            .slice(0, 19)
            .replace('T', ' ');
        
        document.getElementById('executionDateTime').value = formattedDateTime;
    } catch (error) {
        showNotification('날짜/시간 형식이 올바르지 않습니다.', 'error');
        console.error('Execution time setting error:', error);
    }
}
// 현재 시간 사용
function useCurrentTime() {
    const now = new Date();
    const formattedDateTime = now.toISOString()
        .slice(0, 19)
        .replace('T', ' ');
    document.getElementById('executionDateTime').value = formattedDateTime;
}

function updateCurrentTime() {
    const currentTimeElement = document.getElementById('currentTime');
    const now = new Date();
    currentTimeElement.textContent = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// 유틸리티 함수들
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${
        type === 'error' ? 'bg-red-500' : 'bg-green-500'
    } text-white`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function resetForm() {
    editingIndex = -1;
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('saveAccountBtn').textContent = '계정 추가';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

// IPC 이벤트 리스너
ipcRenderer.on('login-progress', (event, data) => {
    loginProgress.updateProgress(data);
});

ipcRenderer.on('batch-completed', (event, data) => {
    loginProgress.showBatchCompletion(data);
});

ipcRenderer.on('all-logins-completed', (event, data) => {
    loginProgress.showCompletion(data);
});
const loginProgress = {
    show() {
        const progressElement = document.getElementById('loginProgress');
        if (progressElement) {
            progressElement.style.display = 'block';
        }
    },
    
    updateProgress(data) {
        const { completed, total, username, status } = data;
        const percentage = (completed / total) * 100;
        
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const accountStatus = document.getElementById('accountStatus');
        const recentStatus = document.getElementById('recentStatus');

        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${completed} / ${total}`;
        }

        if (accountStatus) {
            const existingBadge = document.getElementById(`status-${username}`);
            
            if (!existingBadge) {
                const badge = document.createElement('div');
                badge.id = `status-${username}`;
                badge.className = `account-badge ${status === 'success' ? 'success' : 'error'}`;
                badge.textContent = username;
                accountStatus.appendChild(badge);
            } else {
                existingBadge.className = `account-badge ${status === 'success' ? 'success' : 'error'}`;
            }
        }

        if (recentStatus) {
            recentStatus.textContent = `${username}: ${status === 'success' ? '로그인 성공' : '로그인 실패'}`;
            recentStatus.className = `text-sm ${status === 'success' ? 'text-green-600' : 'text-red-600'}`;
        }
    },

    showBatchCompletion(data) {
        const { batchIndex, totalBatches } = data;
        const recentStatus = document.getElementById('recentStatus');
        if (recentStatus) {
            recentStatus.textContent = `배치 ${batchIndex}/${totalBatches} 완료`;
            recentStatus.className = 'text-sm text-blue-600';
        }
    },

    showCompletion(data) {
        const { totalSuccess, totalAccounts } = data;
        const recentStatus = document.getElementById('recentStatus');
        const cancelBtn = document.getElementById('cancelExecutionBtn');

        if (recentStatus) {
            recentStatus.textContent = `로그인 완료: ${totalSuccess}/${totalAccounts} 성공`;
            recentStatus.className = 'text-sm text-green-600 font-medium';
        }

        if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
        }
    }
};

// 날짜/시간 초기화 함수들
function initializeTimeOptions() {
    const timeSelect = document.getElementById('targetTime');
    timeSelect.innerHTML = '<option value="">선택하세요</option>';
    
    for(let hour = 0; hour < 24; hour++) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${hour}시`;
        
        for(let minute of ['00', '30']) {
            const timeValue = `${hour.toString().padStart(2, '0')}:${minute}`;
            const option = new Option(timeValue, timeValue);
            optgroup.appendChild(option);
        }
        
        timeSelect.appendChild(optgroup);
    }
}

function initializeDateTimeInputs() {
    const now = new Date();
    
    // 티켓팅 날짜 설정
    const targetDateInput = document.getElementById('targetDate');
    const targetDateText = document.getElementById('targetDateText');
    const today = now.toISOString().split('T')[0];
    
    targetDateInput.min = today;
    targetDateInput.value = today;
    targetDateText.value = today;
    
    // 예약 실행 시간 설정
    const executionDateTime = document.getElementById('executionDateTime');
    const defaultTime = new Date(now.getTime() + 60000); // 현재 시간 + 1분
    executionDateTime.value = defaultTime.toISOString().slice(0, 19).replace('T', ' ');
}
// 실행 예약 핸들러
async function handleExecutionFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        targetUrl: document.getElementById('targetUrl').value.trim(),
        targetDate: document.getElementById(isDatePickerVisible ? 'targetDate' : 'targetDateText').value.trim(),
        targetTime: document.getElementById('targetTime').value.trim(),
        executionDateTime: document.getElementById('executionDateTime').value.trim()
    };

    if (!formData.targetUrl || !formData.targetDate || !formData.targetTime || !formData.executionDateTime) {
        alert('모든 필드를 입력해주세요.');
        return;
    }

    try {
        const result = await ipcRenderer.invoke('schedule-batch-execution', {
            executionTime: formData.executionDateTime,
            params: {
                url: formData.targetUrl,
                date: formData.targetDate,
                time: formData.targetTime
            }
        });

        if (result) {
            // 취소 버튼 표시 전에 요소 존재 확인
            const cancelBtn = document.getElementById('cancelExecutionBtn');
            if (cancelBtn) {
                cancelBtn.style.display = 'inline-block';  // block 대신 inline-block 사용
            }

            alert(`실행이 예약되었습니다.\n\n` +
                  `티켓팅 시간: ${formData.targetDate} ${formData.targetTime}\n` +
                  `실행 예약 시간: ${formData.executionDateTime}`);
        }
    } catch (error) {
        console.error('Execution scheduling error:', error);
        alert('실행 예약 중 오류가 발생했습니다.');
    }
}

// setExecutionTime 함수도 수정
function setExecutionTime(secondsOffset) {
    const targetDate = document.getElementById(isDatePickerVisible ? 'targetDate' : 'targetDateText').value.trim();
    const targetTime = document.getElementById('targetTime').value.trim();
    
    if (!targetDate || !targetTime) {
        alert('먼저 티켓팅 날짜와 시간을 입력해주세요.');
        return;
    }

    try {
        // 티켓팅 시간으로부터 실행 시간 계산
        const ticketingTime = new Date(`${targetDate}T${targetTime}`);
        const executionTime = new Date(ticketingTime.getTime() + (secondsOffset * 1000));
        
        // 로컬 시간대로 변환하여 표시
        const year = executionTime.getFullYear();
        const month = String(executionTime.getMonth() + 1).padStart(2, '0');
        const day = String(executionTime.getDate()).padStart(2, '0');
        const hours = String(executionTime.getHours()).padStart(2, '0');
        const minutes = String(executionTime.getMinutes()).padStart(2, '0');
        const seconds = String(executionTime.getSeconds()).padStart(2, '0');

        const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        document.getElementById('executionDateTime').value = formattedDateTime;
        
        console.log('Set Execution Time:', formattedDateTime);
    } catch (error) {
        console.error('Set execution time error:', error);
        alert('날짜/시간 설정 중 오류가 발생했습니다.');
    }
}

// 현재 시간 설정 함수 수정
function useCurrentTime() {
    const now = new Date();
    const formatted = now.toISOString()
        .replace('T', ' ')
        .slice(0, 19);
    document.getElementById('executionDateTime').value = formatted;
}

// 실행 취소
async function cancelExecution() {
    if (!confirm('예약된 실행을 취소하시겠습니까?')) return;
    
    try {
        await ipcRenderer.invoke('cancel-execution');
        
        // 취소 버튼 숨기기 전에 요소 존재 확인
        const cancelBtn = document.getElementById('cancelExecutionBtn');
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
        
        alert('예약된 실행이 취소되었습니다.');
    } catch (error) {
        console.error('Cancel execution error:', error);
        alert('실행 취소 중 오류가 발생했습니다.');
    }
}

// 날짜/시간 입력 자동 포맷팅
document.getElementById('targetTime').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 4) {
        const hours = value.slice(0, 2);
        const minutes = value.slice(2, 4);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            e.target.value = `${hours}:${minutes}`;
        }
    }
});

document.getElementById('targetDateText').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 8) {
        const year = value.slice(0, 4);
        const month = value.slice(4, 6);
        const day = value.slice(6, 8);
        e.target.value = `${year}-${month}-${day}`;
    }
});

// 계정 선택 관리
function toggleAccountSelection(index) {
    const checkbox = document.getElementById(`account-${index}`);
    checkbox.checked = !checkbox.checked;
    updateDeleteSelectedButton();
}

function handleSelectAll() {
    const isChecked = this.checked;
    const checkboxes = document.querySelectorAll('#accountList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    updateDeleteSelectedButton();
}

function updateDeleteSelectedButton() {
    const selectedCount = document.querySelectorAll('#accountList input[type="checkbox"]:checked').length;
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    deleteSelectedBtn.style.display = selectedCount > 0 ? 'block' : 'none';
    deleteSelectedBtn.textContent = `선택 삭제 (${selectedCount})`;
}

// 네비게이션
function showSiteSelection() {
    const accountManagement = document.getElementById('accountManagement');
    const siteSelection = document.getElementById('siteSelection');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');

    if (accountManagement) accountManagement.style.display = 'none';
    if (siteSelection) siteSelection.style.display = 'block';
    if (step2) step2.classList.remove('active');
    if (step1) step1.classList.add('active');
}

function returnToAccountManagement() {
    const executionMode = document.getElementById('executionMode');
    const accountManagement = document.getElementById('accountManagement');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    if (executionMode) executionMode.style.display = 'none';
    if (accountManagement) accountManagement.style.display = 'block';
    if (step3) step3.classList.remove('active');
    if (step2) step2.classList.add('active');
}

// 반응형 처리
function handleWindowResize() {
    const container = document.querySelector('.container');
    if (window.innerWidth < 768) {
        container.classList.remove('px-4');
        container.classList.add('px-2');
    } else {
        container.classList.remove('px-2');
        container.classList.add('px-4');
    }
}

// 편의 기능
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showNotification('클립보드에 복사되었습니다.', 'success'))
        .catch(() => showNotification('복사에 실패했습니다.', 'error'));
}

document.addEventListener('DOMContentLoaded', () => {
    // 취소 버튼 초기 상태 설정
    const cancelBtn = document.getElementById('cancelExecutionBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
});