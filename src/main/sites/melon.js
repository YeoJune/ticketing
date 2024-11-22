const utils = require('./utils');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');

const ticketingFunctions = {
  'melon global': async (page, params) => {
    try {
      const { targetDate, targetTime } = utils.normalizeDateTime(params);

      // 1. 예매 페이지 접속
      await page.goto(params.url);
      console.log(`Starting ticketing process for ${targetDate} ${targetTime}`);

      // 2. 날짜/시간 선택 - data-perfday와 time 속성 사용 
      await selectDateTime(page, targetDate, targetTime);
      
      // 3. 예매하기 버튼 클릭하여 팝업 생성
      await page.waitForSelector('.reservationBtn');
      const newPage = await utils.handleNewPageCreation(page, '.reservationBtn');
      await newPage.setViewport({ width: 0, height: 0 });
      
      await newPage.waitForSelector('#oneStopFrame');
      const frame = await (await newPage.$('#oneStopFrame')).contentFrame();

      // 4. 캡챠 처리
      //await handleCaptcha(newPage);
      
      // 5. 캡챠 처리 완료 대기 
      await waitForCaptchaComplete(frame);

      // 6. 좌석 선택 처리
      const success = await handleZoneAndSeatSelection(frame, params);
      if (!success) return false;

      return true;

    } catch (error) {
      console.error('Melon Global ticketing failed:', error); 
      throw error;
    }
  }
};

// 날짜/시간 선택
async function selectDateTime(page, targetDate, targetTime) {
  await utils.sleep(1000);
  console.log('a');
  // 날짜 선택
  await page.waitForSelector(`li[data-perfday="${targetDate.replace(/-/g, '')}"]`);
  await page.click(`li[data-perfday="${targetDate.replace(/-/g, '')}"]`);
  console.log('b', targetTime);
  // 시간 선택 
  await page.waitForSelector('.item_time button');
  await page.evaluate((time) => {
    const timeButtons = Array.from(document.querySelectorAll('.item_time button')); 
    const targetButton = timeButtons.find(btn => btn.textContent.includes(time));
    if (targetButton) targetButton.click();
  }, targetTime);
  console.log('c');

}

// 캡챠 처리
async function handleCaptcha(page) {
  if (await page.$('#captchaImg')) {
    const MAX_ATTEMPT = 15;
    let attempt = 0;
    let captchaText = '';
    
    while (attempt < MAX_ATTEMPT && !/^\d{6}$/.test(captchaText)) {
      if (attempt) {
        await page.evaluate(() => {
          document.querySelector('#btnReload').click();
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

    await page.type('#label-for-captcha', captchaText);
    await page.click('#btnComplete');
  }
}

// 캡챠 완료 대기
async function waitForCaptchaComplete(page) {
  await page.waitForFunction(
    () => {
      let r = document.querySelector('#certification').style.display;
      console.log(r);
      return r  == 'none';
    },
    { timeout: 10000 }
  );
}

// Zone과 좌석 선택 처리
async function handleZoneAndSeatSelection(page, params) {
  try {
    // Zone 정보 계산 및 정렬
    const zoneElements = await page.$$('[id^="iez_canvas_zone"] rect'); 
    const sortedZones = await getSortedZonesByDistance(page, zoneElements);

    // Zone 선택
    let seatSelected = false;
    for (const zone of sortedZones) {
      await page.evaluate(el => el.click(), zone);
      await utils.sleep(300);

      // 선택된 Zone의 좌석 정보 가져오기
      const seats = await page.$$('div[name=tk]');
      const sortedSeats = await getSortedSeatsByDistance(page, seats);

      // 좌석 선택 시도
      for (const seat of sortedSeats) {
        try {
          await page.evaluate(el => el.click(), seat);
          
          // 좌석 선택 성공 확인
          const success = await page.evaluate(() => {
            const seatInfo = document.querySelector('#partSeatSelected li');
            return seatInfo !== null;
          });

          if (success) {
            seatSelected = true;
            // 좌석 선택 완료 버튼 클릭
            await page.click('#nextTicketSelection');
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (seatSelected) break;
    }

    return seatSelected;

  } catch (error) {
    console.error('Seat selection handling failed:', error);
    return false;
  }
}

// Zone 거리순 정렬
async function getSortedZonesByDistance(page, zones) {
  const zonePositions = await page.evaluate(zones => {
    const stage = { x: 1475, y: 0 }; // 무대 중앙 위치
    
    return zones.map(zone => {
      const rect = zone.getBoundingClientRect();
      const centerX = rect.x + rect.width/2;
      const centerY = rect.y;
      
      return {
        element: zone,
        distance: Math.sqrt(
          Math.pow(centerX - stage.x, 2) + 
          Math.pow(centerY - stage.y, 2)
        )
      };
    });
  }, zones);

  return zonePositions
    .sort((a, b) => a.distance - b.distance)
    .map(pos => pos.element);
}

// 좌석 거리순 정렬  
async function getSortedSeatsByDistance(page, seats) {
  const seatPositions = await page.evaluate(seats => {
    const centerX = window.innerWidth / 2;
    const minY = 0;

    return seats.map(seat => {
      const rect = seat.getBoundingClientRect();
      return {
        element: seat,
        distance: Math.sqrt(
          Math.pow(rect.x + rect.width/2 - centerX, 2) + 
          Math.pow(rect.y - minY, 2)
        )
      };
    });
  }, seats);

  return seatPositions
    .sort((a, b) => a.distance - b.distance)
    .map(pos => pos.element);
}

const loginFunctions = {
  'melon global': async (page, site, account) => {
    try {
      await page.goto(site.loginUrl);
      await Promise.all([
        page.waitForSelector(site.selectors.id),
        page.waitForSelector(site.selectors.pw)
      ]);

      await page.type(site.selectors.id, account.username);
      await page.type(site.selectors.pw, account.password);
      await page.click(site.selectors.login);

    } catch (error) {
      console.error('Melon Global login failed:', error);
      throw error;
    }
  }
};

const cancelTicketingFunctions = {
  'melon global': async (page, params) => {
    // 취소 예매 구현은 추후 진행
    try {
      throw new Error('Cancel ticketing not implemented');
    } catch (error) {
      console.error('Melon Global cancel ticketing failed:', error);
      throw error;
    }
  }
};

module.exports = {
  ticketingFunctions,
  loginFunctions, 
  cancelTicketingFunctions
};