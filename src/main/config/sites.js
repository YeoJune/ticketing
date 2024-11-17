// config/sites.js
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sites = {
    'yes24': {
        id: 'yes24',
        name: 'YES24 글로벌',
        loginUrl: 'https://ticket.yes24.com/Pages/English/Member/FnLoginNew.aspx',
        selectors: {
            id: '#txtEmail',
            pw: '#txtPassword',
            login: '#btnLogin'
        }
    }
};

const ticketingFunctions = {
    'yes24': async (page, params) => {
        try {
            // 날짜 형식 정규화 (YYYY-MM-DD)
            let targetDate = params.date;
            if (!targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                targetDate = new Date(params.date).toISOString().split('T')[0];
            }
            
            // 시간 형식 정규화 (HH:mm)
            let targetTime = params.time;
            if (!targetTime.match(/^\d{2}:\d{2}$/)) {
                targetTime = new Date(`2000-01-01T${params.time}`).toTimeString().slice(0, 5);
            }

            console.log(`Starting ticketing process for ${targetDate} ${targetTime}`);
            
            await page.goto(`http://ticket.yes24.com/Pages/English/Sale/FnPerfSaleProcess.aspx?IdPerf=${params.url.match(/IdPerf=(\d+)/)[1]}`);
            
            // 날짜 선택
            page.evaluate(async (date, time) => {
                jgCalSelDate = date;
                const data = await $j.ajax({
                    async: true,
                    type: "POST",
                    url: "/Pages/English/Sale/Ajax/Perf/FnPerfTime.aspx",
                    data: { pDay: $j.trim(date.replace(/-/g, "")), pIdPerf: $j.trim(jgIdPerf), pIdCode: $j.trim(jgIdCode), pIsMania: $j.trim(jgIsMania) },
                    dataType: "html",
                });
                
                const joData = $j("#divTimeTempData").html(data);

                $j("#ulTime").html(joData.find("#ulTimeData").html());
                $j("#ulTime > li").unbind('.step01_time_li').bind('click.step01_time_li', fdc_UlTimeClick);
                $j("#selFlashTime").html(joData.find("#selFlashTimeData").html());
                const matchingLi = $j("#ulTime > li").filter((_, li) => $j(li).attr("timeinfo") === time);

                const selectedValue = matchingLi.length > 0 ? matchingLi.attr("value") : null;
                
                if (selectedValue) {
                    $j("#selFlashTime").val(selectedValue).trigger("change");
                }
            }, targetDate, targetTime);

            await page.waitForSelector('iframe[name="ifrmSeatFrame"]');
            const frame = await (await page.$('iframe[name="ifrmSeatFrame"]')).contentFrame();
            await frame.waitForSelector('div[title]');
            await frame.evaluate(() => {
                // 좌석들의 거리 계산 및 정렬을 위한 배열 생성
                const top = document.querySelector('.bx_top');
                const topRect = top.getBoundingClientRect();
                const topCenterX = topRect.left + (topRect.width / 2);
                const topCenterY = topRect.top + (topRect.height / 2);
                
                // 좌석과 거리 정보를 저장할 배열
                const seatsWithDistances = [];
                
                // 모든 좌석의 거리 계산
                for (const seat of document.querySelectorAll('div[title]')) {
                    const rect = seat.getBoundingClientRect();
                    const seatCenterX = rect.left + (rect.width / 2);
                    const seatCenterY = rect.top + (rect.height / 2);
                    
                    const deltaX = topCenterX - seatCenterX;
                    const deltaY = topCenterY - seatCenterY;
                    const distance = deltaX * deltaX + deltaY * deltaY;
                    
                    seatsWithDistances.push({ seat, distance });
                }
                
                // 거리순으로 정렬
                seatsWithDistances.sort((a, b) => a.distance - b.distance);
                
                // 상위 10% 좌석 수 계산 (최소 1개)
                const topPercentage = 0.1; // 10%
                const topCount = Math.max(1, Math.ceil(seatsWithDistances.length * topPercentage));
                
                // 상위 10% 중에서 랜덤 선택
                const randomIndex = Math.floor(Math.random() * topCount);
                const selectedSeat = seatsWithDistances[randomIndex].seat;
                
                // 선택된 좌석 클릭
                selectedSeat.click();
                ChoiceEnd();
                
                // 디버깅을 위한 정보 반환 (필요시 사용)
                return {
                    totalSeats: seatsWithDistances.length,
                    topSeatsCount: topCount,
                    selectedIndex: randomIndex,
                    selectedDistance: Math.sqrt(seatsWithDistances[randomIndex].distance)
                };
            });
            await page.waitForSelector('#spanPromotionSeat input');
            await page.click('#spanPromotionSeat input');
            await sleep(500);

            // 프로모션 처리
            await page.evaluate(() => {
                fdc_PromotionEnd();
            });
            await page.waitForSelector('#deliveryPos input');
            await page.waitForSelector('.delivery input');
            await sleep(1000);
            await page.click('#deliveryPos input');
            await page.evaluate(() => {
                fdc_DeliveryEnd();
            });
            await page.waitForSelector('#rdoPays2');
            await sleep(500);
            
            await page.evaluate(() => {
                document.querySelector('#rdoPays2')?.click();
                document.querySelector('#cbxUserInfoAgree')?.click();
                document.querySelector('#cbxCancelFeeAgree')?.click();
            });

            await page.evaluate(() => {
                fdc_PrePayCheck();
            });
            
        } catch (error) {
            console.error('Ticketing execution failed:', error);
            throw error;
        }
    }
};
module.exports = {
    sites,
    ticketingFunctions
};