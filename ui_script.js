// 메인 롤링 스크립트
function functionMainRolling(containerID, slideID, autoPlay , timeSpeed){
	// 롤링할 객체를 변수에 담아둔다.
	var el = $('#'+containerID).find('#'+slideID);
	var lastChild;
	var speed = 3000;
	var timer = 0;
	var timeSpeed = timeSpeed;
	el.data('prev', $('#'+containerID).find('.prev'));	//이전버튼을 data()메서드를 사용하여 저장한다.
	el.data('next', $('#'+containerID).find('.next'));	//다음버튼을 data()메서드를 사용하여 저장한다.
	el.data('play', $('#'+containerID).find('.play'));	//이전버튼을 data()메서드를 사용하여 저장한다.
	el.data('stop', $('#'+containerID).find('.stop'));	//다음버튼을 data()메서드를 사용하여 저장한다.
	el.data('size', el.children().width());		//롤링객체의 자식요소의 넓이를 저장한다.
	el.data('len', el.children().length);				//롤링객체의 전체요소 개수
	el.data('animating',false);

	el.css('width',el.data('size')*el.data('len'));		//롤링객체의 전체넓이 지정한다.

	if (autoPlay == true){
		el.data('play').hide();
		el.data('stop').show();
	}else{
		el.data('play').show();
		el.data('stop').hide();
	}
	//el에 첨부된 prev 데이타를 클릭이벤트에 바인드한다.
	el.data('prev').bind({
		click:function(e){
			e.preventDefault();
			movePrevSlide();
		}
	});

	//el에 첨부된 next 데이타를 클릭이벤트에 바인드한다.
	el.data('next').bind({
		click:function(e){
			e.preventDefault();
			moveNextSlide();
		}
	});
	el.data('play').bind({
		click:function(){
			$(this).hide();
			el.data('stop').show();
			timer = setInterval(moveNextSlide, timeSpeed);
			el.bind({
				'mouseenter': function(){
					clearInterval(timer);
				},
				'mouseleave': function(){
					timer = setInterval(moveNextSlide, timeSpeed);
				}
			});
		}
	});
	el.data('stop').bind({
		click:function(){
			$(this).hide();
			el.data('play').show();
			clearInterval(timer);
			el.bind({
				'mouseenter': function(){
					clearInterval(timer);
				},
				'mouseleave': function(){
					clearInterval(timer);
				}
			});
		}
	});

	if(autoPlay == true){
		timer = setInterval(moveNextSlide, timeSpeed);
		el.bind({
			'mouseenter': function(){
				clearInterval(timer);
			},
			'mouseleave': function(){
				timer = setInterval(moveNextSlide, timeSpeed);
			}
		});
	}else{
		clearInterval(timer);
	}
	function liSelecter(num){
		el.children().removeClass('on');
		el.children().eq(num+2).addClass('on');
		el.children().eq(num+3).addClass('on');
		el.children().eq(num+4).addClass('on');
	}
	var target = el.children().children();
	$(target).hover(function(){
		var checkOn = $(this).parent().hasClass('on');
		if (checkOn == true){
			$(this).addClass('hover');
		}
	},function(){
		var checkOn = $(this).parent().hasClass('on');
		if (checkOn == true){
			$(this).removeClass('hover');
		}
	});
	$(target).focus(function(){
		var checkOn = $(this).parent().hasClass('on');
		if (checkOn == true){
			$(this).addClass('hover');
		}
	});
	$(target).blur(function(){
		var checkOn = $(this).parent().hasClass('on');
		if (checkOn == true){
			$(this).removeClass('hover');
		}
	});
	function movePrevSlide(){
		if(!el.data('animating')){
			//롤링객체의 끝에서 요소를 선택하여 복사한후 변수에 저장한다.
			var lastItem = el.children().eq(-2).nextAll().clone(true);
			lastItem.prependTo(el);		//복사된 요소를 롤링객체의 앞에 붙여놓는다.
			el.children().eq(-2).nextAll().remove();	//선택된 요소는 끝에서 제거한다
			el.css('left','-'+(el.data('size')*5+'px'));	//롤링객체의 left위치값을 재설정한다.
		
			el.data('animating',true);	//애니메이션 중복을 막기 위해 첨부된 animating 데이타를 true로 설정한다.

			el.animate({'left': '-'+(el.data('size')*4)+'px'},'normal',function(){		//롤링객체를 left:0만큼 애니메이션 시킨다.
				el.data('animating',false);
				liSelecter(1);
			});
		}
		return false;
	}

	function moveNextSlide(){
		if(!el.data('animating')){
			el.data('animating',true);

			el.animate({'left':'-'+(el.data('size')*5)+'px'},'normal',function(){	//롤링객체를 애니메이션 시킨다.
				//롤링객체의 앞에서 요소를 선택하여 복사한후 변수에 저장한다.
				var firstChild = el.children().filter(':lt('+1+')').clone(true);
				firstChild.appendTo(el);	//복사된 요소를 롤링객체의 끝에 붙여놓는다.
				el.children().filter(':lt('+1+')').remove();	//선택된 요소를 앞에서 제거한다
				el.css('left','-'+(el.data('size')*4+'px'));	////롤링객체의 left위치값을 재설정한다.

				el.data('animating',false);
				liSelecter(1);
			});
		}
		return false;
	}
	var lastItem = el.children().eq(-4).nextAll().clone(true);
	lastItem.prependTo(el);		//복사된 요소를 롤링객체의 앞에 붙여놓는다.
	el.children().eq(-4).nextAll().remove();	//선택된 요소는 끝에서 제거한다
	el.css('left','-'+(el.data('size')*4+'px'));
	liSelecter(1);
}

function tabSet(param,btn){
	$(btn).click(function(){
		var i = $(btn).index(this);
		$(param).children().removeClass('on');
		$(param).children().eq(i).addClass('on');
	});
	$(btn).focus(function(){
		var i = $(btn).index(this);
		$(param).children().removeClass('on');
		$(param).children().eq(i).addClass('on');
	});
}
function pagingRolling(param,pagingAllNum,pagingViewNum,nextBtn,prevBtn){
	var paramLength = $(param).children().length;
	var targetShow = $(param).children('.on').index();
	$(pagingAllNum).html(paramLength);
	if (targetShow == -1) {
		$(param).children(":eq(0)").addClass('on');
		$(pagingViewNum).html('1');
	} else {
		$(pagingViewNum).html(targetShow + 1);
	}
	$(nextBtn).click(function(){
		var targetShow = $(param).children('.on').index() + 1;
		$(param).children().removeClass('on')
		if (targetShow >= paramLength){
			$(param).children(":first-child").addClass('on');
			$(pagingViewNum).html("1");
		}else{
			$(param).children(":eq("+targetShow+")").addClass('on');
			$(pagingViewNum).html(targetShow+1);
		}
	});
	$(prevBtn).click(function(){
		var targetShow = $(param).children('.on').index();
		$(param).children().removeClass('on')
		if (targetShow <= 0){
			$(param).children(":last-child").addClass('on');
			$(pagingViewNum).html(paramLength);
		}else{
			targetShow = targetShow -1;
			$(param).children(":eq("+targetShow+")").addClass('on');
			targetShow = targetShow +1;
			$(pagingViewNum).html(targetShow);
		}
	});
}
function onoffBthSet (param,target) {
	$(target).hover(function(){
		$(param).removeClass('on');
		$(this).parent().addClass('on');
	});
	$(target).focus(function(){
		$(param).removeClass('on');
		$(this).parent().addClass('on');
	});
}
$(function(){
	var showIndex = 0;
	var cmnItem = $('#gnb .cmn_banner .item');
	//var showIndex = Math.floor(Math.random() * $(cmnItem).length);
	var cmnBtn = $('#gnb .cmn_banner .gnb_banner_btn a');
	var cmnBtnPrev = $('#gnb .cmn_banner .gnb_banner_btn .prev');
	var cmnBtnNext = $('#gnb .cmn_banner .gnb_banner_btn .next');
	$(cmnItem).hide();
	$(cmnItem).eq(showIndex).show();
	$(cmnBtn).hover(function(){
		$(this).addClass('hover')
		$(cmnBtn).mousedown(function(){$(this).addClass('active')});
		$(cmnBtn).mouseup(function(){$(this).removeClass('active')});
	},function(){
		$(this).removeClass('hover').removeClass('active');
	});
	$(cmnBtnPrev).click(function(){
		var cmnBanLength = $(cmnItem).length - 1;
		if (showIndex == 0){
			$(cmnItem).hide();
			$(cmnItem).eq(cmnBanLength).show();
			showIndex = cmnBanLength;
		}else{
			$(cmnItem).hide();
			$(cmnItem).eq(showIndex-1).show();
			showIndex = showIndex - 1;
		}
		return false;
	})
	$(cmnBtnNext).click(function(){
		var cmnBanLength = $(cmnItem).length - 1;
		if (showIndex == cmnBanLength){
			$(cmnItem).hide();
			$(cmnItem).eq(0).show();
			showIndex = 0;
		}else{
			$(cmnItem).hide();
			$(cmnItem).eq(showIndex+1).show();
			showIndex = showIndex + 1;
		}
		return false;
	})
});
// 스크롤에 의한 탑 버튼 노출
$(function(){
	window.onscroll = doThisBtnTopWrap;
	function doThisBtnTopWrap(){
		var scrollTop = $(window).scrollTop();
		var btnTopWrap = $('.btn_top_wrap');
		if(scrollTop > 1800) {
			$(btnTopWrap).show();
		}else{
			$(btnTopWrap).hide();
		}
	}
});
$(function(){
	sotingTab('.wrap_soting_n2');
	sotingTab('.wrap_soting_n3');
	sotingTab('.wrap_soting_n4');
	sotingTab('.wrap_soting_n5');
	sotingTab('.wrap_soting_n2_bs');
	onoffFun('.box_date li','.box_date li a','on');
});
function sotingTab (param){
	var target = $(param).children();
	$(target).click(function(){
		var thisIndex = $(target).index(this) + 1;
		$(target).removeClass('on');
		$(this).addClass('on');
		$(target).each(function(i){
			i = i + 1;
			$(param).removeClass('nth'+i+'_on');
		});
		$(param).addClass('nth'+thisIndex+'_on');
	});
}
function onoffFun(param,target,className){
//	$(target).click(function(){
//		var thisIndex = $(this).parent().index();
//		$(param).removeClass(className);
//		$(param).eq(thisIndex).addClass(className);
//	});

//2016.02.02 click -> hover로 액션 변경
	$(target).hover(function(){ 
		var thisIndex = $(this).parent().index();
		$(param).removeClass(className);
		$(param).eq(thisIndex).addClass(className);
	});
}
// 체크와 레디오 인풋 노출
/*
$(function(){
	designCheckFun('.input_d_check');
	function designCheckFun(target){
		$(target).click(function(){
			var labelID = $(this).attr('for');
			var inputChecked = $('#'+labelID).is(':checked');
			if (inputChecked == false){
				$(this).addClass('checked')
			}else{
				$(this).removeClass('checked')
			}
		});
	}
	designRadioFun('.input_d_radio');
	function designRadioFun(target){
		$(target).click(function(){
			var labelID = $(this).attr('for');
			var inputChecked = $('#'+labelID).is(':checked');
			var radioName = $('#'+labelID).attr('name');
			$('input[name='+radioName+']').attr('checked', false).next().removeClass('checked');
			if (inputChecked == false){
				$(this).addClass('checked')
			}else{
				$(this).removeClass('checked')
			}
		});
	}
})
*/

function gnbOn (num,sbNum){
	$("#gnb_menu .list_gnb .nth"+num).addClass("on");
	if (sbNum != undefined){
		$("#gnb_menu .list_gnb .nth"+num+" .lay_menu ul li:nth-child("+sbNum+")").addClass("sub_on");
	}
}
/*
var gnb = {
	init : function(pageCode){ // pageCode => 1 : home, 2 : 테마/지역 , 3 : 위시콘서트 , 4 : 랭킹, 5 : 티켓오픈소식, 6 :이벤트 , 7 :forU , 8 : 마이티켓 
		var target = $("#gnb_menu");
		this.anchor = target.find(".list_gnb").children("li");
		this.submenu = this.anchor.find(".lay_menu");
		this.pageCode  = pageCode || null;
		this.addEvent(target);
		this.setting(this.pageCode);
		
	},
	setting : function(num){
		return  (num != null) ? this.activeMenu(num) : null ;
	},
	onMenu : function(e){
		var idx = e.index();
		this.anchor.eq(idx).addClass("on").siblings("li").removeClass("on")
	},
	offMenu : function(){
		this.anchor.removeClass("on");
	},
	activeMenu : function(num){
		return (num != null)? this.anchor.eq(num-1).addClass("on")  : false;
	},
	addEvent : function(target){
	   var self = this;
	   this.anchor.on("mouseenter focus", function(){
			self.onMenu($(this));
	   })
	   target.on("mouseleave blur", function(){
			self.offMenu();
			self.activeMenu(self.pageCode);
	   })
	}
}*/

var srchLayer = {
	init: function(){
		var target = $(".srch_set");
		this.input = target.find("input:text");
		this.preview = target.find(".srch_result_preview");
		this.status = true,
		this.addEvent();
	},

	addEvent : function(){
		var self = this;
		this.input.on("click", function(){
			if(self.status){
				self.open();
				self.status = false;
			}else{
				self.close();
				self.status = true
			}887
		});
		this.input.on("blur", function(){
			self.close();
			self.status = true
		})
	},

	open : function(){
		this.preview.show();
		
	},

	close : function(){
		this.preview.hide();
	}
}


$(document).ready(function(){

// 페이지 URL 체크하여 gnb 및 sub menu 활용
	var CurrentFolderURL = document.URL.substring(document.URL.indexOf('/')).split('/');
	var CurrentFolderIndex = CurrentFolderURL.length - 2;
	var CurrentFileIndex = CurrentFolderURL.length - 1;
	var CurrentFileFullName = CurrentFolderURL[CurrentFileIndex];
	if (CurrentFolderURL[CurrentFolderIndex] == "web"){
//		console.log("인덱스 페이지 입니다.");
	}else if(CurrentFolderURL[CurrentFolderIndex] == "myticket"){
		gnbOn(9); //gnb 관련 로직 나중에 삭제되어야함 2015-12-29 
		if (CurrentFileFullName == "test.html"){
			gnbOn(9,1);
		}
	}else{
//		console.log(CurrentFolderURL[CurrentFileIndex]);
	}
	
	/* form focus : 2015-12-23 */ //2016-01-15 동적바인딩으로 수정
	$(document).on("focus",".wrap_form_input > .inputType", function(){
		if($(this).val()==""){
			$(this).siblings(".place_holder").css("display","none");
		}else{
			//$(this).val("");	// 폼에 포커스가 왔을때, 입력된 내용 지우기 기능
		}
	})
	$(document).on("blur",".wrap_form_input > .inputType", function(){
		if($(this).val()==""){
			$(this).parent().find(".place_holder").css("display","block");
		}
	});
	$(document).on("click",".wrap_form_input > .place_holder", function(e){
			e.preventDefault();
			$(this).css("display","none");
			$(this).parent().find(".inputType").focus();
	})
	

	
	/* point star : 2015-12-23 */
	var btnStar = $(".wrap_point .btn_star");
	var stars = $(".wrap_point .btn_star");
	
	srchLayer.init(); //검색레이어
});

/* 2015-12-22 guide.html 에서 가져옴 */
//evtBigBanFun('.wrap_big_banner','.wrap_big_banner .list_big_banner li','.wrap_big_banner .list_big_tit li',true,5000);
//param = 쌓고있는 랩퍼
//imgParam = 롤링되는 컨텐츠
//btnParam = 버튼 컨텐츠
//autoPlay = 자동롤링일시 true 아닐시 fasle
//timeSpeed = 롤링되는 타임값
//기본 랜덤노출 되어있음
function evtBigBanFun(param,imgParam,btnParam,autoPlay,timeSpeed){
	var imgLength = $(imgParam).length;
	var imgLengthIf = imgLength - 1 ;
	var randomIndex = Math.floor(Math.random() * imgLength);
	var showIndexChk = randomIndex;
	if(autoPlay == true){
		timer = setInterval(nextSlider, timeSpeed);
	}
	function nextSlider(){
		if (showIndexChk < imgLengthIf){
			showIndexChk = showIndexChk + 1;
			$(imgParam).hide();
			$(imgParam).eq(showIndexChk).show();
			$(btnParam).removeClass('on');
			$(btnParam).eq(showIndexChk).addClass('on');
		}else{
			showIndexChk = 0;
			$(imgParam).hide();
			$(imgParam).eq(showIndexChk).show();
			$(btnParam).removeClass('on');
			$(btnParam).eq(showIndexChk).addClass('on');
		}
	}
	$(param).addClass('banner_numbering_m'+imgLength);
	$(imgParam).hide();
	$(imgParam).eq(randomIndex).show();
	$(btnParam).eq(randomIndex).addClass('on');
	$(imgParam).each(function(i){i = i + 1;$(this).addClass('nth'+i)});
	$(btnParam).each(function(i){i = i + 1;$(this).addClass('nth'+i)});
	$(btnParam).click(function(){
		var thisIndex = $(this).index();
		showIndexChk = thisIndex;
		$(imgParam).hide();
		$(imgParam).eq(thisIndex).show();
		$(btnParam).removeClass('on');
		$(this).addClass('on');
		return false;
	});
}


/* tooltip : 2015-12-09 추가 */
function toolTip(obj) {
	var tip = document.getElementById(obj);
	tip.style.display = "block";
	$(this).bind("mouseleave",function(e){
		e.preventDefault();
		tip.style.display = "none";
	});
}

/* openLayerPop : 2015-12-16 추가 */
var prevId = "";
var openLayerPop = function (id,_this,moveLeft, moveTop){
	var target;
	var ex_obj;
	var targetX;
	var targetY;
	
	ex_obj = document.getElementById(id);
	if(_this.getBoundingClientRect){	// IE, FF3
		target = _this.getBoundingClientRect();
		targetX = Math.round(target.left+ (document.documentElement.scrollLeft || document.body.scrollLeft)) + _this.offsetWidth/2;
	    targetY = Math.round(target.top + (document.documentElement.scrollTop || document.body.scrollTop)) + _this.offsetHeight;
	}else if(document.getBoxObjectFor){	// gecko 엔진 기반 FF3 제외
		var boxObjectFor = document.getBoxObjectFor(obj);
		targetX = Math.round(boxObjectFor.x+ (document.documentElement.scrollLeft || document.body.scrollLeft)) + _this.offsetWidth/2;
	    targetY = Math.round(boxObjectFor.y + (document.documentElement.scrollTop || document.body.scrollTop)) + _this.offsetHeight;
	}else{
		var tx = _this.offsetLeft;
		var ty = _this.offsetTop;
		
		var ua = navigator.userAgent.toLowerCase();
		if(ua.indexOf("opera") != 1 || (ua.indexOf("safari") != -1 && getStyle(_this,"position") == "absolute" )){
			ty -= document.body.offsetTop;
		}
		targetX = Math.round(tx + (document.documentElement.scrollLeft || document.body.scrollLeft)) + _this.offsetWidth/2;
	    targetY = Math.round(ty + (document.documentElement.scrollTop || document.body.scrollTop)) + _this.offsetHeight;
	}
	
	if(moveLeft){
		targetX = targetX + moveLeft;
	}
	if(moveTop){
	    targetY = targetY + moveTop;
	}
	
	
    if(prevId != id && prevId != ""){
    	var prev_obj = document.getElementById(prevId);
    	prev_obj.style.display = "none";
    }
    
    ex_obj.style.left = targetX - 40 +"px";
    ex_obj.style.top = targetY + 3 +"px";
    
    if(ex_obj.style.display=="none" || ex_obj.style.display==""){
    	ex_obj.style.display = "block";
    }else{
    	ex_obj.style.display = "none";
    }
    
    prevId = id;
};

/* closeLayerPop : 2015-12-16 추가 */
var closeLayerPop = function (id){
    var ex_obj = document.getElementById(id);
    ex_obj.style.display = "none";
};

/* radioTab: 2015-12-16 추가 */
var radioTab = function(id,obj){
	/* 라디오 버튼의 "name"과 보여질 영역의 class="sorting_con class_name"에서 "class_name"이 같아야 한다 */
	var tagName = obj.getAttribute("name");
	var ex_obj = $("#"+id);
	$(".sorting_con."+tagName).css("display","none");
	ex_obj.css("display","block");	
};

/* fnSlider : by Hyuk 2015-12-23 */
(function($){
	$.fn.fnSlider = function(opts){
		
		return this.each(function(){
			
			var options = $.extend({}, $.fn.fnSlider.defaults, opts || {});
			// 전역 변수 설정 영역 - start
			var nowPage;							// 현재페이지 번호
			var totalPage;							// 전체페이지 번호
			var emptyBoxNum;						// 마지막 페이지 빈칸 개수
			var timer;									// 타이머
			var cnt;									// 카운터 임시 변수
			var slideToNum;							// 비순차적 이동 슬라이드 번호(cnt와 nowPage의 차이 절대값)
			
			var el = $(this);							// 플러그인 지정할 id객체
			var el_ul = $(this).find(".list_slider");	// 슬라이드 ul
			var sw = el_ul.find("li");					// 슬라이드 li
			var len = sw.length;					// 전체 슬라이드 개수 (1부터)
			var widOut;
			var wid;
			var startIndex = 0;
			if(len<=1){
				widOut = sw.eq(0).outerWidth();	// padding,margin 포함 one slide 넓이
				wid = sw.eq(0).width();			// padding,margin 등 스타일 제외 one slide 넓이
			}else{
				widOut = sw.eq(1).outerWidth(true);	// padding,margin 포함 one slide 넓이
				wid = sw.eq(1).width();			// padding,margin 등 스타일 제외 one slide 넓이
			}
			var wrap = el.parent();					// 플러그인 적용 범위 부모객체
			var viewport = wrap.innerWidth();	// wrap의 padding 포함 넓이
			// 전역 변수 설정 영역 - end
			
			// 초기화 fn
			var init = function(){
				if(options.slideNum != 1){
					emptyBoxNum = options.slideNum - (len%options.slideNum);
					if (isInteger(el_ul.find("li").length /options.slideNum)){
						
						
					} else {
						el_ul.children().eq(-1).css("margin-right",widOut*emptyBoxNum+"px");
					}
					
					
					
					totalPage = Math.ceil(len/options.slideNum);
					wid = wid*options.slideNum;
					widOut = widOut*options.slideNum;
				}else{
					emptyBoxNum = 0;
					totalPage = len;
				}
				cnt = 1;
				nowPage = 1;
				if(options.activeIndex != ""){
					startIndex = options.activeIndex;
					cnt = Math.floor((startIndex-1)/options.slideNum) + 1;
					nowPage = Math.floor((startIndex-1)/options.slideNum) + 1;	
					var moveCnt = nowPage - 1;
					for (var i=0; i<moveCnt; i++){
						move_no("next");
					}
					if (startIndex == 1){
						$(sw).eq(0).addClass('on');
					} else {
						$(sw).eq(startIndex - 1).addClass('on');
					}
				};
				
				el_ul.css({
					"width" : widOut*len - (widOut-wid)+"px",
					"height" : "auto"
				});
				el_ul.parent().css({
				});
				
				// autoPlay 이벤트
				if(options.autoPlay==true && totalPage != 1){
					timerRun();
				}
				pagingTxt(cnt);
				bindEvent();
			};
			
			var isInteger =  function (num) {
				return (num.toString().search(/^-?[0-9]+$/) == 0 )
			}
			
			// copyPrev fn
			var copySlide = function(type){
				var piece;
				switch(type){
					case "prev":
						piece = el_ul.children().eq(-1).clone();
						piece.prependTo(el_ul);
						el_ul.children().eq(-1).remove();
					break;
					case "next":
						piece = el_ul.children().eq(0).clone();
						piece.appendTo(el_ul);
						el_ul.children().eq(0).remove();
					break;
				}
			}
			
			// no 애니메이션 fn
			var move_no = function(direct){
				var piece;
				var repeatNum;
				
				if(slideToNum>1){
					repeatNum = slideToNum;
				}else{
					repeatNum = options.slideNum;
				}
				
				timerStop();
				
				switch(direct){
					case "prev":
						if(nowPage==totalPage){
							for(var k=1; k<=repeatNum - emptyBoxNum; k++){
								copySlide(direct);
							}
						}else{
							for(var i=1; i<=repeatNum; i++){
								copySlide(direct);
							}
						}
						if(options.autoPlay==true){
							timerRun();
						}
						slideToNum = null;
					break;
					case "next":
						if(nowPage==1){
							for(var k=1; k<=repeatNum - emptyBoxNum; k++){
								copySlide(direct);
							}
						}else{
							for(var i=1; i<=repeatNum; i++){
								copySlide(direct);
							}
						}
						if(options.autoPlay==true){
							timerRun();
						}
						slideToNum = null;
					break;
				}
				pagingTxt(nowPage);
			};
			
			// 슬라이드 애니메이션 fn
			var move_s = function(direct){
				var piece;
				var repeatNum;
				
				if(slideToNum>1){
					repeatNum = slideToNum;
				}else{
					repeatNum = options.slideNum;
				}
				
				timerStop();
				
				switch(direct){
					case "prev":
						if (isInteger(el_ul.find("li").length /options.slideNum)){
								
							for(var i=1; i<=repeatNum; i++){
									copySlide(direct);
							}
						} else {
							if(nowPage==totalPage){
								for(var k=1; k<=repeatNum - emptyBoxNum; k++){
									copySlide(direct);
								}
							}else{
								for(var i=1; i<=repeatNum; i++){
									copySlide(direct);
								}
							}
						}
						el_ul.css("left",-widOut+"px");
						el_ul.animate({
							"left":0
						},options.speed,function(){
							$(this).dequeue();
							if(options.autoPlay==true){
								timerRun();
							}
							slideToNum = null;
						});
					break;
					case "next":
						el_ul.animate({
							"left":-widOut+"px"
						},options.speed,function(){
							$(this).dequeue();
							
							if (isInteger(el_ul.find("li").length /options.slideNum)){
								
								for(var i=1; i<=repeatNum; i++){
										copySlide(direct);
								}
							} else {
								if(nowPage==1){
									for(var k=1; k<=repeatNum - emptyBoxNum; k++){
										copySlide(direct);
									}
								}else{
									for(var i=1; i<=repeatNum; i++){
										copySlide(direct);
									}
								}
							}
							
							
							el_ul.css("left","0");
							if(options.autoPlay==true){
								timerRun();
							}
							slideToNum = null;
						})
					break;
				}
				pagingTxt(nowPage);
			};
			
			// 페이드 애니메이션 fn (미작업)
			var move_f = function(direct){
				var piece;
				var repeatNum;
				
				if(slideToNum>1){
					repeatNum = slideToNum;
				}else{
					repeatNum = options.slideNum;
				}
				
				timerStop();
				
				switch(direct){
					case "prev":
						if(nowPage==totalPage){
							for(var k=1; k<=repeatNum - emptyBoxNum; k++){
								copySlide(direct);
							}
						}else{
							for(var i=1; i<=repeatNum; i++){
								copySlide(direct);
							}
						}
						el_ul.css("left",-widOut+"px");
						el_ul.animate({
							"left":0
						},options.speed,function(){
							$(this).dequeue();
							if(options.autoPlay==true){
								timerRun();
							}
							slideToNum = null;
						})
					break;
					case "next":
						el_ul.animate({
							"left":-widOut+"px"
						},options.speed,function(){
							$(this).dequeue();
							
							if(nowPage==1){
								for(var k=1; k<=repeatNum - emptyBoxNum; k++){
									copySlide(direct);
								}
							}else{
								for(var i=1; i<=repeatNum; i++){
									copySlide(direct);
								}
							}
							el_ul.css("left","0");
							if(options.autoPlay==true){
								timerRun();
							}
							slideToNum = null;
						})
					break;
				}
				pagingTxt(nowPage);
			};
			
			// autoPlay 함수
			var timerRun = function(){
					timer = setInterval(function(){
						cnt++;
						if(cnt>totalPage) cnt=1;
						nowPage =cnt;
						
						idcFn();
						switch(options.effect){
							case "slide": move_s("next"); break;
							case "fade": move_f("next"); break;
							case "noEffect": move_no("next"); break;
						}
						
					},options.autoPlaySpeed);
			};
			var timerStop = function(){
				if(options.autoPlay==true){
					clearInterval(timer);
				};
			};
			
			// paging fn
			var pagingTxt = function(num){
				if(options.paging != ""){
					var nowTxt = options.paging.find(".now");
					var totalTxt = options.paging.find(".total");
					nowTxt.html(num);
					totalTxt.html(totalPage);
				}
			};
			
			// indicator fn
			var idcFn = function(){
				if(options.indicator != ""){
					options.indicator.find("ul li").removeClass("on");
					options.indicator.find("ul li").eq(cnt-1).addClass("on");
				}
			}
			
			/* bindEvent : 이벤트 적용 */
			var bindEvent = function (){
				// prev 이벤트
				if(options.prev != "" && totalPage != 1){
					options.prev.bind({
						"click" : function(e){
							e.preventDefault();
							if(el_ul.is(":animated")) return;
							
							cnt--;
							if(cnt<1) cnt=totalPage;
							nowPage =cnt;
							switch(options.effect){
								case "slide": move_s("prev"); break;
								case "fade": move_f("prev"); break;
								case "noEffect": move_no("prev"); break;
							}
						}
					})
				};
				
				// next 이벤트
				if(options.next != "" && totalPage != 1){
					options.next.bind({
						"click" : function(e){
							e.preventDefault();
							if(el_ul.is(":animated")) return;
							
							cnt++;
							if(cnt>totalPage) cnt=1;
							nowPage =cnt;
							switch(options.effect){
								case "slide": move_s("next"); break;
								case "fade": move_f("next"); break;
								case "noEffect": move_no("next"); break;
							}
						}
					})
				};
				
				// indicator 이벤트
				if(options.indicator != ""){
					var idc_ul = options.indicator.find("ul");
					var idc_li = idc_ul.find("li");
					var idc_a = idc_li.find("a");
					var idc_len = idc_li.length;
					var idc_idx;
					
					if(totalPage != 1){
						idc_a.bind({
							"click": function(e){
								e.preventDefault();
								cnt = idc_li.index($(this).parent())+1;
								
								if(el_ul.is(":animated") || nowPage == cnt) return;
								
								idcFn();
								var direction;
								direction = (cnt>nowPage) ? "next" : "prev";
								slideToNum = Math.abs(cnt-nowPage);
								nowPage = cnt;
								
								switch(options.effect){
									case "slide": move_s(direction); break;
									case "fade": move_f(direction); break;
									case "noEffect": move_no(direction); break;
								}
							}
						});
					};
				};
					
				// player controler 이벤트
				if(options.controlPlayer != ""){
					var btns = options.controlPlayer.find("a");
					var btnPlay = options.controlPlayer.find(".play");
					var btnStop = options.controlPlayer.find(".stop");
					
					if(options.autoPlay==true){
						btnPlay.hide();
					}else{
						btnStop.hide();
					}
					
					btnPlay.bind({
						"click":function(e){
							e.preventDefault();
							btnPlay.hide();
							btnStop.show();
							timerRun();
							options.autoPlay = true;
						}
					});
					btnStop.bind({
						"click":function(e){
							e.preventDefault();
							btnPlay.show();
							btnStop.hide();
							timerStop();
							options.autoPlay = false;
						}
					});
				};
			};
			/* bindEvent : 이벤트 적용 - end */;
			
			init();
			
		});
		
	};
	
	$.fn.fnSlider.defaults = {	// defaults options 설정
		next : "",					// selector : from slide ID
		prev : "",					// selector : from slide ID
		indicator : "",				// selector : from slide ID (ex) $("#slide01").next(".indicator");
		paging : "",				// selector : from slide ID
		slideNum : 1,				// 1,2,3,4....
		autoPlay : false,			// true / false
		autoPlaySpeed: 4000,	// 밀리세컨
		controlPlayer: "",			// selector : from slide ID
		speed : 400,				// 밀리세컨
		effect : "slide",			// noEffect, slide, fade
		activeIndex: ""
	};
})(jQuery);

// IE8을 위해...
if(typeof String.prototype.trim !== 'function') {
    String.prototype.trim = function() {
    	try{
    		return this.replace(/^\s+|\s+$/g, '');
    	}
    	catch(e) {
    		return this;
    	}
    }
}

if ( !Array.prototype.hasOwnProperty('indexOf') ) {
	Array.prototype.indexOf = function(obj, start) {
		for ( i = ( start || 0 ), j = this.length; i < j; i++ ) {
			if ( this[i] === obj ) {
				return i;
			}
		}
		return -1;
	};
}

//radio, checkbox 디자인
var checkboxHeight = "25";
var radioHeight = "25";
var selectWidth = "190";

document.write('<style type="text/css">input.styled { display: none; } select.styled { position: relative; width: ' + selectWidth + 'px; opacity: 0; filter: alpha(opacity=0); z-index: 5; } .disabled { opacity: 0.5; filter: alpha(opacity=50); }</style>');

var Custom = {
	init: function() {
		var inputs = document.getElementsByTagName("input"), span = Array(), textnode, option, active;
		for(a = 0; a < inputs.length; a++) {
			if((inputs[a].type == "checkbox" || inputs[a].type == "radio") && inputs[a].className == "styled") {
				//console.log('nodename='+inputs[a].parentNode.firstElementChild.nodeName);
				if(inputs[a].parentNode.firstElementChild.nodeName != "SPAN") {
					span[a] = document.createElement("span");
					span[a].className = inputs[a].type;
	
					if(inputs[a].checked == true) {
						if(inputs[a].type == "checkbox") {
							position = "0 -" + (checkboxHeight*2) + "px";
							span[a].style.backgroundPosition = position;
						} else {
							position = "0 -" + (radioHeight*2) + "px";
							span[a].style.backgroundPosition = position;
						}
					}
					inputs[a].parentNode.insertBefore(span[a], inputs[a]);
					inputs[a].onchange = Custom.clear;
					if(!inputs[a].getAttribute("disabled")) {
						span[a].onmousedown = Custom.pushed;
						span[a].onmouseup = Custom.check;
					} else {
						span[a].className = span[a].className += " disabled";
					}
				}
			}
		}
		inputs = document.getElementsByTagName("select");
		for(a = 0; a < inputs.length; a++) {
			if(inputs[a].className == "styled") {
				option = inputs[a].getElementsByTagName("option");
				active = option[0].childNodes[0].nodeValue;
				textnode = document.createTextNode(active);
				for(b = 0; b < option.length; b++) {
					if(option[b].selected == true) {
						textnode = document.createTextNode(option[b].childNodes[0].nodeValue);
					}
				}
				span[a] = document.createElement("span");
				span[a].className = "select";
				span[a].id = "select" + inputs[a].name;
				span[a].appendChild(textnode);
				inputs[a].parentNode.insertBefore(span[a], inputs[a]);
				if(!inputs[a].getAttribute("disabled")) {
					inputs[a].onchange = Custom.choose;
				} else {
					inputs[a].previousSibling.className = inputs[a].previousSibling.className += " disabled";
				}
			}
		}
		document.onmouseup = Custom.clear;
	},
	pushed: function() {
		element = this.nextSibling;
		if(element.checked == true && element.type == "checkbox") {
			this.style.backgroundPosition = "0 -" + checkboxHeight*3 + "px";
		} else if(element.checked == true && element.type == "radio") {
			this.style.backgroundPosition = "0 -" + radioHeight*3 + "px";
		} else if(element.checked != true && element.type == "checkbox") {
			this.style.backgroundPosition = "0 -" + checkboxHeight + "px";
		} else {
			this.style.backgroundPosition = "0 -" + radioHeight + "px";
		}
	},
	check: function() {
		element = this.nextSibling;
		if(element.checked == true && element.type == "checkbox") {
			this.style.backgroundPosition = "0 0";
			element.checked = false;
		} else {
			if(element.type == "checkbox") {
				this.style.backgroundPosition = "0 -" + checkboxHeight*2 + "px";
			} else {
				this.style.backgroundPosition = "0 -" + radioHeight*2 + "px";
				group = this.nextSibling.name;
				inputs = document.getElementsByTagName("input");
				for(a = 0; a < inputs.length; a++) {
					if(inputs[a].name == group && inputs[a] != this.nextSibling) {
						inputs[a].previousSibling.style.backgroundPosition = "0 0";
					}
				}
			}
			element.checked = true;
		}
	},
	clear: function() {
		inputs = document.getElementsByTagName("input");
		for(var b = 0; b < inputs.length; b++) {
			if(inputs[b].type == "checkbox" && inputs[b].checked == true && inputs[b].className == "styled") {
				inputs[b].previousSibling.style.backgroundPosition = "0 -" + checkboxHeight*2 + "px";
			} else if(inputs[b].type == "checkbox" && inputs[b].className == "styled") {
				inputs[b].previousSibling.style.backgroundPosition = "0 0";
			} else if(inputs[b].type == "radio" && inputs[b].checked == true && inputs[b].className == "styled") {
				inputs[b].previousSibling.style.backgroundPosition = "0 -" + radioHeight*2 + "px";
			} else if(inputs[b].type == "radio" && inputs[b].className == "styled") {
				inputs[b].previousSibling.style.backgroundPosition = "0 0";
			}
		}
	},
	choose: function() {
		option = this.getElementsByTagName("option");
		for(d = 0; d < option.length; d++) {
			if(option[d].selected == true) {
				document.getElementById("select" + this.name).childNodes[0].nodeValue = option[d].childNodes[0].nodeValue;
			}
		}
	}
}

window.onload = Custom.init;

// ## 20181207 Ultra ##  (new add) S
var unsettledDayStr = '공연일 추후 공지';
/**
 * 요일 계산
 * @param dt
 * @returns {string}
 */
function getYmdArrDate(dateStr, seperator) {
    try {
        if(seperator == '') {
            var rtnArr = new Array();
            rtnArr[0] = dateStr.substr(0,4);
            rtnArr[1] = dateStr.substr(4,2);
            rtnArr[2] = dateStr.substr(6,2);
            return rtnArr;
        }
        else {
            return dateStr.split(seperator);
        }
    }
    catch(e) {
        //alert('udfMainFrm.js : '+e);
    }
}
function getWeekDayData(datestr, seperator, option) {
    try {
        var date_arr = getYmdArrDate(datestr, seperator);
        var obj_date = new Date(date_arr[0],date_arr[1]-1,date_arr[2]);
        if(option == '0') {
            return obj_date.getDay();
        }
        else if(option == '1') {
            var week_str = new Array("일","월","화","수","목","금","토");
            return week_str[obj_date.getDay()];
        }
    }
    catch(e) {
        //alert('udfMainFrm.js : '+e);
    }
}
/**
 * 추후 공지 여부 체크(년도: 8888 / 시간: 2323) 후 case1~3 리턴 (년도: 8888 / 시간: 2323 가 아닐 경우는 기존 값 리턴)
 * 		case 1. 일자 미정일 경우 -> "공연일 추후 공지 (금) 20:00"
 * 		case 2. 시간 미정일 경우 -> "2018.12.07 (금)"
 * 		case 3. 모두 미정일 경우 -> "공연일 추후 공지 (금)"
 * @param dayStr
 * @param timeStr
 * @param replaceStr
 * @returns {{dayYn: string, timeYn: string, displayStr: string}}
 */
function checkDateUnsettled(dayStr, timeStr, replaceStr){
    var weekDayStr 		= getWeekDayData(dayStr, '', '1');
    var dayDisplayStr 	= dayStr.substr(0,4) + '.' + dayStr.substr(4,2) + '.' + dayStr.substr(6,2);
    var timeDisplayStr 	= timeStr.substr(0,2) + ":" + timeStr.substr(2,2);
    var checkFlag		= false;

    if (dayStr.substring(0,4) == '8888'){
        checkFlag = true;
        dayDisplayStr = unsettledDayStr;
    }
    dayDisplayStr +=  ' (' + weekDayStr + ') ';

    if (timeStr.substring(0,4) == '2323') {
        checkFlag = true;
        timeDisplayStr = '';
    }
    return (checkFlag)?(dayDisplayStr + timeDisplayStr):replaceStr;
}
/**
 * 추후 공지 여부 체크(년도: 8888 / 시간: 2323) 후 Y,N 리턴
 * @param dayStr
 */
function checkDateUnsettledYn(dayStr){
    return (dayStr.substring(0,4) == '8888')?true:false;
}

/**
 * 년도:8888 일 경우  취소 수수료 데이터 셋팅
 * @param cancelFeeObj
 */
function setCancelFeeObj(cancelFeeObj){
    var feeData = "";
	    feeData += '<tr/><td>예매 후 7일 이내</td><td>없음</td></tr>';
	    feeData += '<tr/><td>예매 후 8일 ~ 관람일 10일 이내</td><td>장당 4,000원(티켓금액의 10%한도)</td></tr>';
	    feeData += '<tr/><td>관람일 9일 전 ~ 7일 전</td><td>티켓금액의 10%</td></tr>';
	    feeData += '<tr/><td>관람일 6일 전 ~ 3일 전</td><td>티켓금액의 20%</td></tr>';
	    feeData += '<tr/><td>관람일 2일 전 ~ 1일 전</td><td>티켓금액의 30%</td></tr>';
    $(cancelFeeObj).html(feeData);
}

/**
 * 취소기한 체크(년도: 8888)
 * 		case 1. 년도 8888 경우 -> "공연일  {N}일전 {HH}시까지"
 * @param prodDt
 * @param closingDt
 * @param cancelCloseDtStr
 * @returns {displayStr: string}
 */
function checkClosinglDateUnsettled(prodDt,closingDt,cancelCloseDtStr){
	var result = cancelCloseDtStr + " 까지";
	if (prodDt.substring(0,4) == '8888'){
		//공연일시
		var startDate = new Date(parseInt(prodDt.substring(0,4), 10),
	             parseInt(prodDt.substring(4,6), 10)-1,
	             parseInt(prodDt.substring(6,8), 10),
	             parseInt(prodDt.substring(8,10), 10),
	             parseInt(prodDt.substring(10,12), 10),
	             parseInt(prodDt.substring(12,14), 10)
	            );
	   //취소마감일시
	   var endDate   = new Date(parseInt(closingDt.substring(0,4), 10),
	             parseInt(closingDt.substring(4,6), 10)-1,
	             parseInt(closingDt.substring(6,8), 10),
	             parseInt(closingDt.substring(8,10), 10),
	             parseInt(closingDt.substring(10,12), 10),
	             parseInt(closingDt.substring(12,14), 10)
	            );

	   // 두 일자(startTime, endTime) 사이의 차이를 구한다.
	   var dateGap = startDate.getTime() - endDate.getTime();
//	   var timeGap = new Date(0, 0, 0, 0, 0, 0, startDate - endDate); 
	   
	   // 두 일자(startTime, endTime) 사이의 간격을 "일-시간-분"으로 표시한다.
	   var diffDay  = Math.floor(dateGap / (1000 * 60 * 60 * 24)); // 일수       
//	   var diffHour = timeGap.getHours();       // 시간 
//	   var diffMin  = timeGap.getMinutes();      // 분
//	   var diffSec  = timeGap.getSeconds();      // 초
	   
	   // 리턴 값
	   //console.log(diffDay + "일 " + diffHour + "시간 " + diffMin + "분 "  + diffSec + "초 ");
	   result = ("공연일 "+ diffDay + "일전 " + closingDt.substring(8,10) + "시 까지");
	}
	return result;
}
// ## 20181207 Ultra ##  (new add) E
