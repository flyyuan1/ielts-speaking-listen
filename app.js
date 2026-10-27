const PRIORITY = ['P2-R18', 'P2-N15', 'P2-R16', 'P2-R25', 'P2-N10', 'P2-N03', 'P2-N01'];
const DAY_IDS = {
  '27': ['P1-E01-Q01', 'P1-E01-Q02', 'P1-E01-Q03', 'P1-E01-Q04', 'P1-E01-Q05', 'P1-E03-Q01', 'P1-E03-Q03', 'P1-E03-Q05', 'P1-E02-Q05', 'P1-E02-Q14', 'P2-R18', 'P2-N15', 'P3-R18-Q01', 'P3-R18-Q04', 'P3-N15-Q01', 'P3-N15-Q03'],
  '28': ['P2-R18', 'P2-N15', 'P2-R16', 'P2-R25', 'P2-N10', 'P1-R15-Q03', 'P1-N01-Q01', 'P1-N01-Q03', 'P1-R05-Q01', 'P3-R16-Q01', 'P3-R16-Q02', 'P3-N10-Q01', 'P3-N10-Q02', 'P3-R25-Q04'],
  '29': ['P2-N03', 'P2-N01', 'P2-R18', 'P2-N10', 'P2-N15', 'P2-R16', 'P2-R25', 'P1-E01-Q01', 'P1-E03-Q01', 'P1-E02-Q05', 'P1-R15-Q03', 'P3-N03-Q01', 'P3-N03-Q05', 'P3-N01-Q01', 'P3-N01-Q03'],
  '30': ['P1-E01-Q01', 'P1-E03-Q01', 'P1-E02-Q05', 'P1-R15-Q03', 'P1-N01-Q01', 'P2-R18', 'P2-N15', 'P2-R16', 'P2-R25', 'P2-N01', 'P3-R18-Q01', 'P3-N15-Q01', 'P3-R16-Q01', 'P3-N01-Q01'],
};

const els = {
  list: document.querySelector('#questionList'),
  detail: document.querySelector('#readerContent'),
  search: document.querySelector('#searchInput'),
  count: document.querySelector('#resultCount'),
  loadMore: document.querySelector('#loadMore'),
  toast: document.querySelector('#toast'),
};

const state = {
  items: [], byId: new Map(), filter: 'priority', day: null,
  query: '', visible: 80, selectedId: null, voices: [],
  rate: Number(localStorage.getItem('speaking-rate')) || 0.9,
  voiceName: localStorage.getItem('speaking-voice') || '',
  speechToken: 0, speaking: false, paused: false,
};

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 3000);
}

function setSpeechStatus(text) {
  const status = document.querySelector('#audioStatus');
  if (status) status.textContent = text;
}

function updatePauseButton() {
  const button = document.querySelector('#pauseButton');
  if (!button) return;
  button.textContent = state.paused ? '继续' : '暂停';
  button.disabled = !state.speaking;
}

function stopSpeech() {
  state.speechToken += 1;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  state.speaking = false;
  state.paused = false;
  updatePauseButton();
  setSpeechStatus('已停止播放');
}

function splitSpeech(text) {
  return text.replace(/\s*\n+\s*/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
}

function speak(text, label = '答案') {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    showToast('这个浏览器没有提供语音朗读，请用 Chrome、Edge 或 Safari 打开。');
    return;
  }
  if (!text?.trim()) return;
  stopSpeech();
  const chunks = splitSpeech(text);
  const token = state.speechToken;
  const voice = state.voices.find(v => v.name === state.voiceName);
  state.speaking = true;
  state.paused = false;
  updatePauseButton();
  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = voice?.lang || 'en-GB';
    if (voice) utterance.voice = voice;
    utterance.rate = state.rate;
    utterance.pitch = 1;
    utterance.onstart = () => {
      if (token !== state.speechToken) return;
      setSpeechStatus(`正在朗读${label} · 第 ${index + 1}/${chunks.length} 句`);
    };
    utterance.onend = () => {
      if (token !== state.speechToken || index !== chunks.length - 1) return;
      state.speaking = false;
      state.paused = false;
      updatePauseButton();
      setSpeechStatus('播放结束。现在遮住英文，试着自己说一遍。');
    };
    utterance.onerror = event => {
      if (token !== state.speechToken || event.error === 'canceled' || event.error === 'interrupted') return;
      state.speaking = false;
      updatePauseButton();
      setSpeechStatus('语音未能播放。可以换一个英文声音后重试。');
    };
    window.speechSynthesis.speak(utterance);
  });
}

function refreshVoices() {
  if (!('speechSynthesis' in window)) return;
  state.voices = window.speechSynthesis.getVoices().filter(v => /^en\b|^en[-_]/i.test(v.lang));
  const select = document.querySelector('#voiceSelect');
  if (!select) return;
  select.replaceChildren();
  const fallback = new Option('系统默认英语', '');
  select.add(fallback);
  state.voices.forEach(v => select.add(new Option(`${v.name} (${v.lang})`, v.name)));
  if (!state.voiceName && state.voices.length) {
    state.voiceName = (state.voices.find(v => /^en-GB/i.test(v.lang)) || state.voices[0]).name;
  }
  select.value = state.voices.some(v => v.name === state.voiceName) ? state.voiceName : '';
}

function getCandidates() {
  let candidates;
  if (state.day) {
    candidates = DAY_IDS[state.day].map(id => state.byId.get(id)).filter(Boolean);
  } else if (state.filter === 'priority') {
    candidates = PRIORITY.map(id => state.byId.get(id)).filter(Boolean);
  } else if (state.filter === 'all') {
    candidates = state.items;
  } else {
    candidates = state.items.filter(item => String(item.part) === state.filter);
  }
  if (state.query) {
    const base = state.day ? candidates : ['1','2','3'].includes(state.filter)
      ? candidates : state.items;
    const q = state.query.toLocaleLowerCase();
    candidates = base.filter(item => [item.id, item.topic, item.question, item.questionZh, item.answer]
      .some(value => String(value || '').toLocaleLowerCase().includes(q)));
  }
  return candidates;
}

function renderList() {
  const candidates = getCandidates();
  const visible = candidates.slice(0, state.visible);
  els.count.textContent = `${candidates.length} 题`;
  els.list.replaceChildren();
  if (!candidates.length) {
    els.list.append(el('div', 'empty-list', '没有找到对应题目。可以换个关键词或切到“全部”。'));
  }
  const fragment = document.createDocumentFragment();
  visible.forEach(item => {
    const row = el('div', 'question-row' + (item.id === state.selectedId ? ' selected' : ''));
    const pick = el('button', 'question-pick');
    pick.type = 'button';
    pick.setAttribute('aria-label', `打开 ${item.id} ${item.topic}`);
    const meta = el('span', 'row-meta');
    meta.append(el('span', 'row-id', item.id), el('span', 'row-part', `Part ${item.part}`));
    pick.append(meta, el('span', 'row-title', item.part === 2 ? item.topic : item.question),
      el('span', 'row-subtitle', item.part === 2 ? item.question : item.topic));
    pick.addEventListener('click', () => selectItem(item.id, true));
    const play = el('button', 'row-play', '▶');
    play.type = 'button';
    play.title = '播放英文答案';
    play.setAttribute('aria-label', `播放 ${item.id} 的英文答案`);
    play.addEventListener('click', () => {
      selectItem(item.id, true);
      speak(item.answer);
    });
    row.append(pick, play);
    fragment.append(row);
  });
  els.list.append(fragment);
  els.loadMore.hidden = candidates.length <= state.visible;
}

function renderDetail(item) {
  els.detail.innerHTML = `<div class="reader-top"></div>
    <p class="reader-topic"></p><h2 class="reader-question"></h2><p class="reader-question-zh"></p>
    <div class="cue-card" hidden><strong>题卡提示</strong><ul></ul></div>
    <div class="audio-panel">
      <button id="playAnswer" class="play-main" type="button">▶ 听英文答案</button>
      <button id="playQuestion" class="audio-secondary" type="button">听题目</button>
      <button id="pauseButton" class="audio-secondary" type="button" disabled>暂停</button>
      <button id="stopButton" class="audio-secondary" type="button">停止</button>
      <label class="audio-select">语速 <select id="rateSelect" aria-label="选择朗读语速">
        <option value="0.75">0.75×</option><option value="0.85">0.85×</option><option value="0.9">0.9×</option>
        <option value="1">1.0×</option><option value="1.1">1.1×</option><option value="1.2">1.2×</option>
      </select></label>
      <label class="audio-select">声音 <select id="voiceSelect" aria-label="选择英文朗读声音"></select></label>
      <div id="audioStatus" class="audio-status" role="status">点击播放，跟读时可以调慢语速。</div>
    </div>
    <div class="answer-header"><h3>参考答案</h3><div class="answer-tools"><button id="toggleAnswer" class="text-toggle" type="button">遮住英文</button></div></div>
    <div id="answerBody" class="answer-body"></div><div id="extraContent"></div>`;
  const tags = els.detail.querySelector('.reader-top');
  tags.append(el('span', 'tag', `PART ${item.part}`), el('span', 'tag code', item.id));
  if (item.part === 2 && item.provenanceType) tags.append(el('span', 'tag story', item.provenanceType));
  els.detail.querySelector('.reader-topic').textContent = item.topic;
  els.detail.querySelector('.reader-question').textContent = item.question;
  els.detail.querySelector('.reader-question-zh').textContent = item.questionZh || '';

  if (item.part === 2 && item.cueCard?.length) {
    const card = els.detail.querySelector('.cue-card');
    card.hidden = false;
    const list = card.querySelector('ul');
    item.cueCard.forEach((line, i) => {
      const li = el('li', '', line);
      if (item.cueCardZh?.[i]) li.append(el('div', 'zh-note', item.cueCardZh[i]));
      list.append(li);
    });
  }

  const body = els.detail.querySelector('#answerBody');
  if (item.part === 2) {
    const keywords = el('p', 'keywords');
    keywords.append(el('strong', '', '回忆关键词：'), document.createTextNode(item.keywords.join(' → ')));
    body.append(keywords);
    item.paragraphs.forEach((paragraph, index) => {
      body.append(el('p', 'answer-paragraph', paragraph));
      if (item.cluesZh?.[index]) body.append(el('p', 'zh-note', item.cluesZh[index]));
    });
  } else {
    body.append(el('p', 'short-answer', item.answer));
    if (item.ideaZh) body.append(el('p', 'zh-note', item.ideaZh));
    if (item.vocab) body.append(el('p', 'word-note', `词汇提示：${item.vocab}`));
  }
  const extra = els.detail.querySelector('#extraContent');
  if (item.part === 2 && item.extension) {
    const details = el('details', 'extension');
    details.append(el('summary', '', '可选延伸 · 需要继续说时再用'), el('p', '', item.extension));
    extra.append(details);
  }
  if (item.provenance) {
    const note = el('div', 'provenance');
    note.append(el('strong', '', '素材说明：'), document.createTextNode(item.provenance));
    extra.append(note);
  }

  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  els.detail.querySelectorAll('.audio-panel button').forEach(button => { if (button.id !== 'stopButton') button.disabled = !supported; });
  if (!supported) setSpeechStatus('此浏览器没有提供朗读功能。请换用 Chrome、Edge 或 Safari。');
  els.detail.querySelector('#playAnswer').addEventListener('click', () => speak(item.answer));
  els.detail.querySelector('#playQuestion').addEventListener('click', () => speak(item.question, '题目'));
  els.detail.querySelector('#stopButton').addEventListener('click', stopSpeech);
  els.detail.querySelector('#pauseButton').addEventListener('click', () => {
    if (!state.speaking) return;
    if (state.paused) {
      window.speechSynthesis.resume();
      state.paused = false;
      setSpeechStatus('继续朗读');
    } else {
      window.speechSynthesis.pause();
      state.paused = true;
      setSpeechStatus('已暂停');
    }
    updatePauseButton();
  });
  const rateSelect = els.detail.querySelector('#rateSelect');
  rateSelect.value = String(state.rate);
  rateSelect.addEventListener('change', event => {
    state.rate = Number(event.target.value);
    localStorage.setItem('speaking-rate', String(state.rate));
    showToast('语速已设置，下次播放生效。');
  });
  els.detail.querySelector('#voiceSelect').addEventListener('change', event => {
    state.voiceName = event.target.value;
    localStorage.setItem('speaking-voice', state.voiceName);
    showToast('英文声音已设置，下次播放生效。');
  });
  refreshVoices();
  els.detail.querySelector('#toggleAnswer').addEventListener('click', event => {
    const hidden = body.classList.toggle('hidden-english');
    event.target.textContent = hidden ? '显示英文' : '遮住英文';
  });
}

function selectItem(id, scroll = false) {
  const item = state.byId.get(id);
  if (!item) return;
  stopSpeech();
  state.selectedId = id;
  if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
  renderList();
  renderDetail(item);
  if (scroll && matchMedia('(max-width: 960px)').matches) {
    document.querySelector('.reader').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function setFilter(filter, day = null) {
  stopSpeech();
  state.filter = filter;
  state.day = day;
  state.visible = 80;
  document.querySelectorAll('.filter-tab').forEach(button => {
    const active = !day && button.dataset.filter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.day-button').forEach(button => button.classList.toggle('active', button.dataset.day === day));
  renderList();
  const first = getCandidates()[0];
  if (first) selectItem(first.id);
}

async function init() {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.items = data.items;
    state.byId = new Map(state.items.map(item => [item.id, item]));
    if (data.items.length !== 569 || data.counts.p1 !== 202 || data.counts.p2 !== 56 || data.counts.p3 !== 311) {
      throw new Error('题库条目数量不正确');
    }
    const hashId = decodeURIComponent(location.hash.slice(1));
    if (hashId && state.byId.has(hashId)) {
      state.filter = String(state.byId.get(hashId).part);
      setFilter(state.filter);
      selectItem(hashId);
    } else {
      const today = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' }).format(new Date());
      const match = today.match(/^10\/(27|28|29|30)$/);
      if (match) setFilter('priority', match[1]);
      else setFilter('priority');
    }
    if ('speechSynthesis' in window) {
      refreshVoices();
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
  } catch (error) {
    els.detail.replaceChildren(el('div', 'reader-loading', `题库暂时载入失败：${error.message}。请刷新网页重试。`));
    els.count.textContent = '载入失败';
  }
}

document.querySelectorAll('.filter-tab').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
document.querySelectorAll('.day-button').forEach(button => button.addEventListener('click', () => setFilter('priority', button.dataset.day)));
els.search.addEventListener('input', event => { state.query = event.target.value.trim(); state.visible = 80; renderList(); });
els.loadMore.addEventListener('click', () => { state.visible += 80; renderList(); });
window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (state.byId.has(id) && id !== state.selectedId) selectItem(id);
});
window.addEventListener('beforeunload', stopSpeech);
init();
