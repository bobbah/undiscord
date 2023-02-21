const PREFIX = '[UNDISCORD]';

import { version as VERSION } from '../package.json';

import discordStyles from './ui/discord-styles.css';
import undiscordStyles from './ui/main.css';
import buttonHtml from './ui/undiscord-button.html';
import undiscordTemplate from './ui/undiscord.html';

import Deleter from './deleteMessages';
import Drag from './utils/drag';
import createElm from './utils/createElm';
import insertCss from './utils/insertCss';
import messagePicker from './utils/messagePicker';
import { getToken, getAuthorId, getGuildId, getChannelId } from './utils/getIds';

import { setLogFn } from './utils/log.js';
import { replaceInterpolations } from './utils/helpers';

// -------------------------- User interface ------------------------------- //

// links
const HOME = 'https://github.com/victornpb/undiscord';
const WIKI = 'https://github.com/victornpb/undiscord/wiki';

const deleter = new Deleter();
messagePicker.init();

const ui = {
  undiscordWindow: null,
  undiscordBtn: null,
  logArea: null,
  autoScroll: null,

  // progress handler
  progressMain: null,
  progressIcon: null,
  percent: null,
};
const $ = s => ui.undiscordWindow.querySelector(s);

function initUI() {

  insertCss(discordStyles);
  insertCss(undiscordStyles);

  // create undiscord window
  const undiscordUI = replaceInterpolations(undiscordTemplate, {
    VERSION,
    HOME,
    WIKI,
  });
  ui.undiscordWindow = createElm(undiscordUI);
  document.body.appendChild(ui.undiscordWindow);

  // enable drag and resize on undiscord window
  new Drag(ui.undiscordWindow, $('.header'), { mode: 'move' });
  new Drag(ui.undiscordWindow, $('.footer'), { mode: 'resize' });

  // create undiscord Trash icon
  ui.undiscordBtn = createElm(buttonHtml);
  ui.undiscordBtn.onclick = toggleWindow;
  function mountBtn() {
    const toolbar = document.querySelector('#app-mount [class^=toolbar]');
    if (toolbar) toolbar.appendChild(ui.undiscordBtn);
  }
  mountBtn();
  // watch for changes and re-mount button if necessary
  const discordElm = document.querySelector('#app-mount');
  let observerThrottle = null;
  const observer = new MutationObserver((_mutationsList, _observer) => {
    if (observerThrottle) return;
    observerThrottle = setTimeout(() => {
      observerThrottle = null;
      if (!discordElm.contains(ui.undiscordBtn)) mountBtn(); // re-mount the button to the toolbar
    }, 3000);
  });
  observer.observe(discordElm, { attributes: false, childList: true, subtree: true });

  function toggleWindow() {
    if (ui.undiscordWindow.style.display !== 'none') {
      ui.undiscordWindow.style.display = 'none';
      ui.undiscordBtn.style.color = 'var(--interactive-normal)';
    }
    else {
      ui.undiscordWindow.style.display = '';
      ui.undiscordBtn.style.color = 'var(--interactive-active)';
    }
  }

  // cached elements
  ui.logArea = $('#logArea');
  ui.autoScroll = $('#autoScroll');
  ui.progressMain = $('#progressBar');
  ui.progressIcon = ui.undiscordBtn.querySelector('progress');
  ui.percent = $('#progressPercent');

  // register event listeners
  $('#hide').onclick = toggleWindow;
  $('button#start').onclick = startAction;
  $('button#stop').onclick = stopAction;
  $('button#clear').onclick = () => ui.logArea.innerHTML = '';
  $('button#getAuthor').onclick = () => $('input#authorId').value = getAuthorId();
  $('button#getGuild').onclick = () => {
    const guildId = $('input#guildId').value = getGuildId();
    if (guildId === '@me') $('input#channelId').value = getChannelId();
  };
  $('button#getChannel').onclick = () => {
    $('input#channelId').value = getChannelId();
    $('input#guildId').value = getGuildId();
  };
  $('#redact').onchange = () => {
    const b = ui.undiscordWindow.classList.toggle('redact');
    if (b) alert('This mode will attempt to hide personal information, so you can screen share / take screenshots.\nAlways double check you are not sharing sensitive information!');
  };

  $('#pickMessageAfter').onclick = async () => {
    alert('Select a message on the chat.\nThe message below it will be deleted.');
    toggleWindow();
    const id = await messagePicker.grab('after');
    if (id) $('input#minId').value = id;
    toggleWindow();
  };
  $('#pickMessageBefore').onclick = async () => {
    alert('Select a message on the chat.\nThe message above it will be deleted.');
    toggleWindow();
    const id = await messagePicker.grab('before');
    if (id) $('input#maxId').value = id;
    toggleWindow();
  };

  // const fileSelection = $('input#importJson');
  // fileSelection.onchange = () => {
  //   const files = fileSelection.files;
  //   const channelIdField = $('input#channelId');
  //   if (files.length > 0) {
  //     const file = files[0];
  //     file.text().then(text => {
  //       let json = JSON.parse(text);
  //       let channels = Object.keys(json);
  //       channelIdField.value = channels.join(',');
  //     });
  //   }
  // };

  // redirect console logs to inside the window after setting up the UI
  setLogFn(printLog);

  setupDeleter();
}

function printLog(type = '', args) {
  const style = { '': '', info: 'color:#00b0f4;', verb: 'color:#72767d;', warn: 'color:#faa61a;', error: 'color:#f04747;', success: 'color:#43b581;' }[type];
  ui.logArea.insertAdjacentHTML('beforeend', `<div style="${style}">${Array.from(args).map(o => typeof o === 'object' ? JSON.stringify(o, o instanceof Error && Object.getOwnPropertyNames(o)) : o).join('\t')}</div>`);
  if (ui.autoScroll.checked) ui.logArea.querySelector('div:last-child').scrollIntoView(false);
}

function setupDeleter() {

  deleter.onStart = (state, stats) => {
    console.log(PREFIX, 'onStart', state, stats);
    $('#start').disabled = true;
    $('#stop').disabled = false;

    ui.progressIcon.style.display = 'block';
    ui.progressMain.style.display = 'block';
    ui.percent.style.display = 'block';
  };

  deleter.onProgress = (state, stats) => {
    console.log(PREFIX, 'onProgress', state, stats);
    const value = 0; // TODO:
    let min = 0;
    let max = 100;

    if (value && max && value > max) max = value;
    ui.progressIcon.setAttribute('max', max);
    ui.progressMain.setAttribute('max', max);
    ui.progressIcon.value = value;
    ui.progressMain.value = value;
    ui.progressIcon.style.display = max ? '' : 'none';
    ui.progressMain.style.display = max ? '' : 'none';
    ui.percent.style.display = value && max ? '' : 'none';
    ui.percent.innerHTML = value >= 0 && max ? Math.round(value / max * 100) + '%' : '';
    // indeterminate progress bar
    if (value === -1) {
      ui.progressIcon.removeAttribute('value');
      ui.progressMain.removeAttribute('value');
      ui.percent.innerHTML = '...';
    }
  };

  deleter.onStop = (state, stats) => {
    console.log(PREFIX, 'onStop', state, stats);
    $('#start').disabled = false;
    $('#stop').disabled = true;

    ui.progressIcon.style.display = 'none';
    ui.progressMain.style.display = 'none';
    ui.percent.style.display = 'none';
  };
}

async function startAction() {
  console.log(PREFIX, 'startAction');

  // general
  const authToken = getToken();
  const authorId = $('input#authorId').value.trim();
  const guildId = $('input#guildId').value.trim();
  const channelIds = $('input#channelId').value.trim().split(/\s*,\s*/);
  const includeNsfw = $('input#includeNsfw').checked;
  // filter
  const content = $('input#search').value.trim();
  const hasLink = $('input#hasLink').checked;
  const hasFile = $('input#hasFile').checked;
  const includePinned = $('input#includePinned').checked;
  const pattern = $('input#pattern').value;
  // message interval
  const minId = $('input#minId').value.trim();
  const maxId = $('input#maxId').value.trim();
  // date range
  const minDate = $('input#minDate').value.trim();
  const maxDate = $('input#maxDate').value.trim();
  //advanced
  const searchDelay = parseInt($('input#searchDelay').value.trim());
  const deleteDelay = parseInt($('input#deleteDelay').value.trim());

  // clear logArea
  ui.logArea.innerHTML = '';

  // validate input
  if (!authToken) return printLog('error', ['Could not detect the authorization token!']) || printLog('info', ['Please make sure Undiscord is up to date']);
  else if (!guildId) return printLog('error', ['You must provide a Server ID!']);

  // TODO: multiple channels
  // for (let i = 0; i < channelIds.length; i++) {

  // }

  deleter.options = {
    authToken,
    authorId,
    guildId,
    channelId: channelIds[0],
    minId: minId || minDate,
    maxId: maxId || maxDate,
    content,
    hasLink,
    hasFile,
    includeNsfw,
    includePinned,
    pattern,
    searchDelay,
    deleteDelay,
  };

  deleter.resetState();
  deleter.run();
}

function stopAction() {
  console.log(PREFIX, 'stopAction');
  deleter.stop();
}

initUI();

// ---- END Undiscord ----