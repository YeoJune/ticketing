const utils = require('./utils');
const ImageToTextConverter = require('../core/ImageToTextConverter');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');

const ticketingFunctions = {
  'yes24 global': async (page, params) => {
    try {
      const { targetDate, targetTime } = utils.normalizeDateTime(params);
      
      // 예매 페이지 접속
      await page.goto(params.url);
      console.log(`Starting ticketing process for ${targetDate} ${targetTime}`);
      const newPage = await utils.handleNewPageCreation(page, '.sinfo a');
      await newPage.setViewport({ width: 0, height: 0 });
      
      // 날짜 및 시간 선택
      await selectDateTime(newPage, targetDate, targetTime);
      
      // 좌석 선택 처리
      const success = await handleSeatSelection(newPage, params);
      if (!success) return false;
      
      // 예매 완료 처리
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
      
      // 예매 페이지 접속
      await page.goto(params.url);
      console.log(`Starting ticketing process for ${targetDate} ${formattedTime}`);
      await page.evaluate(() => {
        jsf_pdi_GoPerfSale();
      });
      const newPage = await utils.handleNewPageCreation(page, 'a.rn-bb03');
      await newPage.setViewport({ width: 0, height: 0 });
      
      // 날짜 및 시간 선택
      await selectDateTimeLocal(newPage, targetDate, formattedTime);
      
      // 좌석 선택 처리
      const success = await handleSeatSelection(newPage, params);
      if (!success) return false;
      
      // 예매 완료 처리
      await completeBookingLocal(newPage);
      
      return true;
    } catch (error) {
      console.error('YES24 Ticketing execution failed:', error);
      throw error;
    }
  }
};

const loginFunctions = {
  'yes24 global': async (page, site, account) => {
    try {
      await page.goto(site.loginUrl);
      await Promise.all([
        page.waitForSelector(site.selectors.id),
        page.waitForSelector(site.selectors.pw),
      ]);
      
      // 로그인 정보 입력 및 제출
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
      
      // 로그인 정보 입력
      await page.evaluate((q1, v1, q2, v2) => {
        document.querySelector(q1).setAttribute('value', v1);
        document.querySelector(q2).setAttribute('value', v2);
      }, site.selectors.id, account.username, site.selectors.pw, account.password);
      
      // 로그인 버튼 클릭 및 완료 대기
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

const cancelTicketingFunctions = {
  'yes24 global': async (page, params) => {
    try {
      const { targetDate, targetTime } = utils.normalizeDateTime(params);
      const startTime = new Date(params.startTime);
      const endTime = params.endTime ? new Date(params.endTime) : null;
      
      // 예매 페이지 접속
      await page.goto(params.url);
      console.log(`Attempting cancel ticketing for ${targetDate} ${targetTime}`);
      const newPage = await utils.handleNewPageCreation(page, '.sinfo a');
      await newPage.setViewport({ width: 0, height: 0 });
      
      // 날짜 및 시간 선택
      await selectDateTime(newPage, targetDate, targetTime);

      while (true) {
        const currentTime = new Date();
        if (endTime && currentTime > endTime) {
          return false;
        }
        
        if (currentTime >= startTime) {
          // 좌석 선택 처리 (연속 재시도)
          const success = await handleSeatSelection(newPage, params, true);
          if (success) {
            // 예매 완료 처리
            await completeBookingGlobal(newPage);
            return true;
          }
        }
        await utils.sleep(1000); // 재시도 전 대기
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
      
      // 예매 페이지 접속
      await page.goto(params.url);
      console.log(`Attempting cancel ticketing for ${targetDate} ${formattedTime}`);
      
      // 예매창 열기
      await page.evaluate(() => {
        jsf_pdi_GoPerfSale();
      });
      const newPage = await utils.handleNewPageCreation(page, 'a.rn-bb03');
      await newPage.setViewport({ width: 0, height: 0 });
      
      // 날짜 및 시간 선택
      await selectDateTimeLocal(newPage, targetDate, formattedTime);

      while (true) {
        const currentTime = new Date();
        if (endTime && currentTime > endTime) {
          return false;
        }
        
        if (currentTime >= startTime) {
          // 좌석 선택 처리 (연속 재시도)
          const success = await handleSeatSelection(newPage, params, true);
          if (success) {
            // 예매 완료 처리
            await completeBookingLocal(newPage);
            return true;
          }
        }
        await utils.sleep(1000); // 재시도 전 대기
      }
    } catch (error) {
      console.error('YES24 Cancel ticketing execution failed:', error);
      throw error;
    }
  }
};

// 보조 함수들
async function selectDateTime(page, targetDate, targetTime) {
  try {
    await page.waitForSelector(`[id="${targetDate}"]`);
    await page.click(`[id="${targetDate}"]`);
    await page.waitForSelector(`[timeinfo="${targetTime}"]`);
    await page.click(`[timeinfo="${targetTime}"]`);
    await page.click('#btnSeatSelect');
  } catch (error) {
    console.error('Date/Time selection failed:', error);
    throw error;
  }
}

async function selectDateTimeLocal(page, targetDate, targetTime) {
  try {
    await page.waitForSelector(`[id="${targetDate}"]`);
    await page.click(`[id="${targetDate}"]`);
    await page.waitForSelector(`[timeinfo="${targetTime}"]`);
    await page.click(`[timeinfo="${targetTime}"]`);
    await page.click('#btnSeatSelect');
  } catch (error) {
    console.error('Local date/time selection failed:', error);
    throw error;
  }
}

async function handleSeatSelection(page, params, refresh = false) {
  try {
    await page.waitForSelector('iframe[name="ifrmSeatFrame"]');
    const frame = await (await page.$('iframe[name="ifrmSeatFrame"]')).contentFrame();
    await frame.waitForSelector('.minimap_m');
    const sortedBlockIndices = await getSortedBlockIndices(frame);
    const success = await attemptSeatSelection(frame, sortedBlockIndices, params);
    if (success) return success;
    if (refresh) {
      frame.evaluate(() => {
        // 기존 요소들 정리
        $("#divSeatArray").empty();
        $("#liLegend").empty(); 
        $("#liSelSeat").empty();
        $("#dMapInfo").empty();
        $(".mapFocus").remove();
        $(".bigmapFocus").remove();
        $(".minimap_m .btn_all").remove();
        
        // 새로운 데이터 로드
        GetImageMap();
      });
    }
  } catch (error) {
    console.error('Seat selection handling failed:', error);
    throw error;
  }
}

async function completeBookingGlobal(page) {
  try {
    // 프로모션 처리
    await page.waitForSelector('#spanPromotionSeat input[value]');
    await page.evaluate(() => {
      fdc_PromotionEnd();
    });
    
    // 배송 정보 처리
    await Promise.all([
      page.waitForSelector('#rdoDeliveryBase[value]'),
      page.waitForSelector('#LUAddr_UserName[value]'),
    ]);
    await page.evaluate(() => {
      fdc_DeliveryEnd();
    });
    
    // 결제 정보 처리
    await Promise.all([
      page.waitForSelector('#rdoPays2'),
      page.waitForSelector('#cbxUserInfoAgree'),
      page.waitForSelector('#cbxCancelFeeAgree'),
    ]);
    
    // CAPTCHA 처리
    await handleCaptcha(page);
    
    // 결제 완료
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

async function completeBookingLocal(page) {
  try {
    // 프로모션 처리
    await page.waitForSelector('#spanPromotionSeat input[value]');
    await page.evaluate(() => {
      fdc_PromotionEnd();
    });
    
    // 배송 정보 처리
    await Promise.all([
      page.waitForSelector('#deliveryPos input[value]'),
      page.waitForSelector('#LUAddr_UserName[value]'),
      page.waitForSelector('#LUAddr_MailH[value]'),
      page.waitForSelector('#LUAddr_MailD[value]'),
    ]);
    
    // 연락처 정보 입력
    await page.evaluate(() => {
      document.querySelector('#ordererMobile1').value = '010';
      document.querySelector('#ordererMobile2').value = '0000';
      document.querySelector('#ordererMobile3').value = '0000';
      fdc_DeliveryEnd();
    });
    
    // 결제 정보 처리
    await Promise.all([
      page.waitForSelector('#rdoPays2'),
      page.waitForSelector('#cbxAllAgree'),
    ]);
    
    // CAPTCHA 처리
    await handleCaptcha(page);
    
    // 결제 완료
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
async function attemptSeatSelection(frame, sortedBlockIndices, params) {
  // alert 무시 설정
  await frame.evaluate(() => {
      window.alert = () => window.alertOccurred = true;
  });

  for (const blockIndex of sortedBlockIndices) {
      if (blockIndex !== -1) {
          await frame.evaluate((blockNumber) => ChangeBlock(blockNumber), blockIndex);
      }

      await frame.waitForSelector('div[name=tk]', { timeout: 1000 });

      const success = await frame.evaluate(async (params) => {
          const seats = document.querySelectorAll(
              `div[name="tk"]${params.grade ? `[grade="${params.grade}석"]` : ''}`
          );

          for (const seat of seats) {
              if (!seat.title || seat.classList.contains('reserved')) continue;

              window.alertOccurred = false;
              
              // 1. 클릭
              $(seat).trigger('click');
              
              // 2. ChoiceEnd
              ChoiceEnd();
              
              // 3. 100ms 대기
              for(let i = 0; i < 5; i++) {
                await new Promise(r => setTimeout(r, 100));
                // 4. alert 체크
                if (!window.alertOccurred) return true;
              }
          }
          return false;
      }, params);

      if (success) return true;
  }
  return false;
}

async function getSortedBlockIndices(frame) {
  try {
    await frame.waitForSelector('.minimap_m .btn_all', {timeout: 200});
  } catch (err) {
  }

  let sortedBlockIndices = [-1];
  if (await frame.$('.minimap_m .btn_all')) {
    await frame.waitForSelector('map[name="map_ticket"] area');
    sortedBlockIndices = await calculateBlockIndices(frame, 'map_ticket');
  } else if (await frame.$('#blockFile')) {
    await frame.waitForSelector('map[name="maphall"] area');
    sortedBlockIndices = await calculateBlockIndices(frame, 'maphall');
  }
  return sortedBlockIndices;
}

async function calculateBlockIndices(frame, mapName) {
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

    if (areaShapes.length === 0) return [];

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

/**
 * Handle CAPTCHA verification process
 * @param {Page} page - Puppeteer page object
 */
async function handleCaptcha(page) {
  if (await page.$('#captchaImg')) {
      const MAX_ATTEMPT = 15;
      let attempt = 0;
      let captchaText = '';
      while (attempt < MAX_ATTEMPT && !/^\d{6}$/.test(captchaText)) {
          if (attempt) {
              await page.evaluate(() => { 
                  initCaptcha();
              });
              await utils.sleep(50);
          }
          
          await utils.waitForImageLoad(page, '#captchaImg');
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
}

module.exports = {
  ticketingFunctions,
  loginFunctions,
  cancelTicketingFunctions
};