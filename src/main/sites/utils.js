// sites/utils.js
const utils = {
    /**
     * 날짜와 시간 형식 정규화
     * @param {Object} params - 입력 파라미터
     * @param {string} params.date - 날짜 문자열
     * @param {string} params.time - 시간 문자열
     * @returns {Object} 정규화된 날짜와 시간
     */
    normalizeDateTime: (params) => {
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
     * 이미지 로딩 완료 대기
     * @param {Page} page - Puppeteer page 객체
     * @param {string} selector - 이미지 요소 선택자
     */
    waitForImageLoad: async (page, selector) => {
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
     * 새 페이지 생성 처리
     * @param {Page} page - Puppeteer page 객체
     * @param {string} selector - 클릭할 요소 선택자
     * @returns {Promise<Page>} 새로 생성된 페이지
     */
    handleNewPageCreation: async (page, selector) => {
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
    },
  
    /**
     * 지정된 시간 동안 대기
     * @param {number} ms - 대기할 밀리초
     * @returns {Promise<void>}
     */
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
    /**
     * 문자열을 정수로 변환 (기본값 0)
     * @param {string} intStr - 변환할 문자열
     * @returns {number} 변환된 정수 또는 0
     */
    getIntWithDefaultOf0: (intStr) => parseInt(intStr, 10) || 0,
  
    /**
     * 날짜 문자열을 원하는 형식으로 포맷팅
     * @param {string} dateStr - YYYYMMDD 형식의 날짜 문자열
     * @returns {string} YYYY.MM.DD 형식의 날짜 문자열
     */
    formatDate: (dateStr) => {
      return `${dateStr.slice(0,4)}.${dateStr.slice(4,6)}.${dateStr.slice(6,8)}`;
    },
  
    /**
     * 시간 문자열을 원하는 형식으로 포맷팅
     * @param {string} timeStr - HHMM 형식의 시간 문자열
     * @returns {string} HH:MM 형식의 시간 문자열
     */
    formatTime: (timeStr) => {
      return `${timeStr.slice(0,2)}:${timeStr.slice(2,4)}`;
    },
  
    /**
     * 숫자에 천단위 콤마 추가
     * @param {number} num - 포맷할 숫자
     * @returns {string} 포맷된 문자열
     */
    formatNumber: (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
  
    /**
     * 요소가 표시될 때까지 대기
     * @param {Page} page - Puppeteer page 객체
     * @param {string} selector - 대기할 요소의 선택자
     * @param {Object} options - 대기 옵션
     */
    waitForDisplay: async (page, selector, options = {}) => {
      const defaultOptions = {
        visible: true,
        timeout: 10000,
        ...options
      };
      await page.waitForSelector(selector, defaultOptions);
    },
  
    /**
     * 에러 핸들러
     * @param {Error} error - 발생한 에러
     * @param {string} context - 에러 발생 컨텍스트
     * @throws {Error} 처리된 에러
     */
    handleError: (error, context) => {
      console.error(`Error in ${context}:`, error);
      if (error.message.includes('timeout')) {
        throw new Error(`Timeout error in ${context}: ${error.message}`);
      }
      throw error;
    },
  
    /**
     * API 요청 래퍼
     * @param {Page} page - Puppeteer page 객체
     * @param {string} url - API 엔드포인트
     * @param {Object} options - fetch 옵션
     * @returns {Promise<Object>} API 응답
     */
    makeRequest: async (page, url, options = {}) => {
      try {
        const response = await page.evaluate(async (url, options) => {
          const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
              ...options.headers,
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error('Response text:', text);
            throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
          }
        }, url, options);
        
        return response;
      } catch (error) {
        console.error('API request details:', { url, options });
        throw new Error(`API request failed: ${error.message}`);
      }
    }
  };
  
  module.exports = utils;