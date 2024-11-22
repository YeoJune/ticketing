// sites/index.js
const yes24 = require('./yes24');
const melon = require('./melon');

const sites = {
  'yes24': {
    id: 'yes24',
    name: 'YES24',
    loginUrl: 'https://www.yes24.com/Templates/FTLogin.aspx',
    selectors: {
      id: '#SMemberID',
      pw: '#SMemberPassword',
      login: '#btnLogin'
    }
  },
  'yes24 global': {
    id: 'yes24 global',
    name: 'YES24 global',
    loginUrl: 'https://ticket.yes24.com/Pages/English/Member/FnLoginNew.aspx',
    selectors: {
      id: '#txtEmail',
      pw: '#txtPassword',
      login: '#btnLogin'
    }
  },
  /*
  'melon': {
    id: 'melon',
    name: '멜론',
    loginUrl: 'https://gmember.melon.com/login/login_form.htm?langCd=EN&redirectUrl=https://tkglobal.melon.com/main/index.htm?langCd=EN',
    selectors: {
      id: '#id',
      pw: '#pwd',
      login: '#btnLogin'
    }
  },
  'melon global': {
    id: 'melon global',
    name: '멜론 global',
    loginUrl: 'https://gmember.melon.com/login/login_form.htm',
    selectors: {
      id: '#email',
      pw: '#pwd',
      login: '#formSubmit'
    }
  }*/
};

module.exports = {
  sites,
  ticketingFunctions: {
    ...yes24.ticketingFunctions,
    ...melon.ticketingFunctions
  },
  loginFunctions: {
    ...yes24.loginFunctions,
    ...melon.loginFunctions
  },
  cancelTicketingFunctions: {
    ...yes24.cancelTicketingFunctions,
    ...melon.cancelTicketingFunctions
  }
};
