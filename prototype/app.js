/* ================= 本地存储 ================= */
const APP_MODE = /[?&]app=1/.test(location.search) || !!window.__APP_MODE__;
const KEY = 'nightread.v3';
let LS = null;
try { LS = window.localStorage; LS.setItem('__t', '1'); LS.removeItem('__t'); } catch (e) { LS = null; }

const DEFAULT_BG = 8; // 系统自带图集数量

const APP_VER = 23;
const APP_VER_NAME = '0.20';
const DEFAULT_UPDATE_URL = 'https://raw.githubusercontent.com/alisonredust-sys/NightRead/main/version.json';

const DEFAULT_TUNE = {
  tempShort: 1.0, tempLong: 0.85, tempDoujin: 0.9,
  maxShort: 2500, maxLong: 8000, maxDoujin: 4000,
  topP: 1, freqPen: 0, presPen: 0,
  perShort: 10, perLong: 2, ctxChars: 6000, charLimit: 100, limitOut: false,
  enabled: false, limitCtx: false, limitChars: false,
};

let S = {
  theme: 'light',
  bg: { album: 'default', idx: 0, custom: [] },
  author: { id: '', hue: 0, img: '' },
  api: { base: 'https://api.deepseek.com', key: '', model: 'deepseek-flash' },
  tune: Object.assign({}, DEFAULT_TUNE),
  prompts: { short: '', long: '', doujin: '' },
  updateUrl: '',
  series: [],
};

function save() {
  if (!LS) return;
  try { LS.setItem(KEY, JSON.stringify(S)); } catch (e) {}
}
function load() {
  if (!LS) return;
  try {
    const raw = LS.getItem(KEY);
    if (raw) S = Object.assign(S, JSON.parse(raw));
    S.tune = Object.assign({}, DEFAULT_TUNE, S.tune || {});
    S.prompts = Object.assign({ short: '', long: '', doujin: '' }, S.prompts || {});
  } catch (e) {}
}
load();

/* ================= 工具 ================= */
const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const stage = document.getElementById('stage');
const phone = document.getElementById('phone');
const maskEl = document.getElementById('mask');
const sheetEl = document.getElementById('sheet');
const toastEl = document.getElementById('toast');

let toastT;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 1700);
}

/* ================= 状态 ================= */
const nav = { stack: [{ view: 'home', params: {} }], tab: {}, drawer: false, pick: null };

function cur() { return nav.stack[nav.stack.length - 1]; }
function go(view, params = {}) { closeDrawer(); nav.stack.push({ view, params }); render(); }
function back() { if (nav.stack.length > 1) { nav.stack.pop(); render(); } }
function goRoot() { nav.stack = [{ view: 'home', params: {} }]; render(); }
function closeDrawer() { nav.drawer = false; }

function seriesById(id) { return S.series.find((x) => x.id === id); }
function workById(s, id) { return s && s.works.find((w) => w.id === id); }

/* ================= 生成数据 ================= */
const PERSONA_NAMES = ['林间有雾','旧书页','三点水的河','半盏灯','雨停之前','山月不知','冬天不冷','青衫湿','拾荒者','第九夜','竹外桃花','睡不着就数羊'];
const MEME_NAMES = ['我是那块石头','三日后才来','第一章就埋了','只看评论不看书'];
const HUES = [16, 205, 268, 340, 30, 190, 142, 300, 24, 210, 320, 42];

function personasFor(s) {
  if (s.personas) return s.personas;
  const arr = [];
  for (let i = 0; i < 10; i++) arr.push({ n: PERSONA_NAMES[i % PERSONA_NAMES.length], h: HUES[i % HUES.length] });
  s.personas = arr;
  return arr;
}

// 五套人格的模板（短评）
/* ================= 接模型：提示词 ================= */
const BASE_RULE = '你在某短篇小说阅读网站的评论区。\n\n硬性要求：\n1. 落到具体的东西上：一句台词、一个动作、一个物件。引用原文时用引号嵌在句子里，不要单独成行。\n2. 不复述剧情。提到剧情是为了说别的。\n3. 结尾不要总结全文，不要喊口号，不要升华。\n4. 正文一律纯文本：不要 Markdown 符号（如 **、##、-、*、> 这些），不要编号列表，不要星标，不要表格。\n5. 禁用词与句式：仿佛、好像、不禁、一丝、一抹、隐约、缓缓、微微、淡淡、眼中闪过、心中一动、值得注意的是、总而言之、通过……展现了……、我记住了、我认、我懂、一下就、没飘、没崩、行吧、对得上；「这+名词+很/挺+形容词」句式、「这+名词+我+动词」句式、「不是……是……」句式。';

const P_SHORT = '你在某短篇小说阅读网站的评论区。\n\n硬性要求：\n1. 落到具体的东西上：一句台词、一个动作、一个物件。引用原文时用引号嵌在句子里，不要单独成行。\n2. 不复述剧情。提到剧情是为了说别的。\n3. 结尾不要总结全文，不要喊口号，不要升华。\n4. 正文一律纯文本：不要 Markdown 符号（如 **、##、-、*、> 这些），不要编号列表，不要星标，不要表格。\n5. 禁用词与句式：仿佛、好像、不禁、一丝、一抹、隐约、缓缓、微微、淡淡、眼中闪过、心中一动、值得注意的是、总而言之、通过……展现了……、我记住了、我认、我懂、一下就、没飘、没崩、行吧、对得上；「这+名词+很/挺+形容词」句式、「这+名词+我+动词」句式、「不是……是……」句式。\n6. 句子的长度必须符合人类的使用习惯，禁止出现少于十个字成句的情况。\n\n写正好 {n} 条短评。每条第一行是昵称，第二行是正文。\n昵称：8–9 条是正常读者 ID（两到四字，像一个真实网名）；1–2 条是玩本章梗的 ID（拿本章的角色、道具、台词玩梗）；梗 ID 不许连着出现。\n身份随机：每条从下面六类里抽一个，比例完全不固定——允许某一类出现三四条，也允许某一类一条都不出现：角色厨（直接对角色说话，情绪外放）、CP 党（把两个人的互动读成关系）、考据党（盯设定、时间线、伏笔）、普通读者（说自己的阅读体验）、唱反调的（指出具体哪里松、哪里淡）、催更的（求外传、求续集）。\n严谨：生成的与原文相关的内容必须严格参照原文细节，不得出现错误或混淆。\n称呼：对角色用「你」，对作者用「求你」；不要用「本文」「该书」「作者通过」。\n允许括号补刀：（破音）（认真）（不是）（褒义）。\n去同质化：{n} 条的开头不许雷同——不要都用原文引用开场，不要都用情绪词开场；长度要有明显差异，从简单的一两句感想和上百字的分析或发癫文学都要有；允许有人答非所问、跑题。\n只输出 JSON：{"comments":[{"nick":"读者ID","text":"评论"}]}';

const P_LONG = '你在某短篇小说阅读网站的评论区。\n\n硬性要求：\n1. 落到具体的东西上：一句台词、一个动作、一个物件。引用原文时用引号嵌在句子里，不要单独成行。\n2. 不复述剧情。提到剧情是为了说别的。\n3. 结尾不要总结全文，不要喊口号，不要升华。\n4. 正文一律纯文本：不要 Markdown 符号（如 **、##、-、*、> 这些），不要编号列表，不要星标，不要表格。\n5. 禁用词与句式：仿佛、好像、不禁、一丝、一抹、隐约、缓缓、微微、淡淡、眼中闪过、心中一动、值得注意的是、总而言之、通过……展现了……、我记住了、我认、我懂、一下就、没飘、没崩、行吧、对得上；「这+名词+很/挺+形容词」句式、「这+名词+我+动词」句式、「不是……是……」句式。\n\n写 {n} 篇长评，赏析体。\n开头一句总判断，接一句「以下将从六个角度……」。\n六节固定：故事情节、人物形象、行文节奏、语言风格、描写细节、主题主旨。\n每节标题单独成段，格式「一、故事情节：于无声处听惊雷」——序号 + 四字主题 + 一句判断。\n每节：先给论点，再给一个术语（如「切片式叙事：」），引原文作证（嵌在句子里），最后一句评价。\n全篇不用「你」「我」这些人称代词；少用「作者」做主语，改用「文本」「叙述」「这一节」「结尾」。\n语气克制：几乎不用感叹号。body 用两个换行分段。\n只输出 JSON：{"items":[{"nick":"读者ID","title":"标题","score":4,"body":"正文"}]}';

const P_DOUJIN = '你在某短篇小说阅读网站的评论区。\n\n硬性要求：\n1. 落到具体的东西上：一句台词、一个动作、一个物件。引用原文时用引号嵌在句子里，不要单独成行。\n2. 不复述剧情。提到剧情是为了说别的。\n3. 结尾不要总结全文，不要喊口号，不要升华。\n4. 正文一律纯文本：不要 Markdown 符号（如 **、##、-、*、> 这些），不要编号列表，不要星标，不要表格。\n5. 禁用词与句式：仿佛、好像、不禁、一丝、一抹、隐约、缓缓、微微、淡淡、眼中闪过、心中一动、值得注意的是、总而言之、通过……展现了……、我记住了、我认、我懂、一下就、没飘、没崩、行吧、对得上；「这+名词+很/挺+形容词」句式、「这+名词+我+动词」句式、「不是……是……」句式。\n6.严谨：生成的与原文相关的内容必须严格参照原文细节，不得出现错误或混淆。\n\n写 1 篇同人。\n全文是一个基于正文和设定集中基础世界观和人物设定的、与原文情节等不同的故事。不要写评论、不要写赏析。\n情节、动作、人物行为等全都要符合基本逻辑和人物相关的设定。\n不设字数上限，写到该停的地方停。\n用「……」起句表示迟疑、被打断、没说完。\n心理活动一律写成动作。\n每个角色保留自己的口癖和句子长度。\n保持中文语法规则，角色说的话用双引号括住。\n场景里要有具体的生活物件。\n只输出 JSON：{"items":[{"nick":"读者ID","title":"标题","body":"正文","tags":["标签"]}]}';

function buildSystem(kind, styleIdx, n) {
  const custom = (S.prompts && S.prompts[kind] ? String(S.prompts[kind]) : '').trim();
  if (custom) return custom.replace(/\{n\}/g, n);
  const t = kind === 'short' ? P_SHORT : (kind === 'long' ? P_LONG : P_DOUJIN);
  return t.replace(/\{n\}/g, n);
}

function TUNE() {
  return S.tune || DEFAULT_TUNE;
}

const THREE = String.fromCharCode(34, 34, 34);

function buildUser(kind, src, angle) {
  const t = TUNE();
  let text = String(src || '');
  if (t.limitCtx) text = text.slice(0, t.ctxChars || 6000);
  const n = kind === 'short' ? 10 : (kind === 'long' ? 2 : 1);
  let u = '';
  if (angle) {
    u += kind === 'short'
      ? '生成一批' + n + '条关于' + angle + '的短评。\n\n'
      : '生成' + n + '篇关于' + angle + '的' + (kind === 'long' ? '长评' : '同人') + '。\n\n';
  }
  u += '正文：\n' + THREE + '\n' + text + '\n' + THREE + '\n';
  return u;
}

function buildPayload(kind, src, angle, styleIdx, n) {
  const t = TUNE();
  return {
    model: S.api.model || 'deepseek-flash',
    temperature: (t.enabled ? (kind === 'short' ? t.tempShort : (kind === 'long' ? t.tempLong : t.tempDoujin))
      : (kind === 'short' ? 1.0 : (kind === 'long' ? 0.85 : 0.9))),
    max_tokens: (t.enabled && t.limitOut)
      ? (kind === 'short' ? t.maxShort : (kind === 'long' ? t.maxLong : t.maxDoujin))
      : 393216,
    top_p: t.enabled ? t.topP : 1,
    messages: [
      { role: 'system', content: buildSystem(kind, styleIdx, n) },
      { role: 'user', content: buildUser(kind, src, angle) },
    ],
  };
}

/* ---------- 网络 ---------- */
function apiPost(path, payload, cb) {
  const base = (S.api.base || '').replace(/\/+$/, '');
  const key = S.api.key;
  if (!base || !key) { cb(-2, ''); return; }
  const url = base + path;
  const body = JSON.stringify(payload);
  if (window.Android && window.Android.httpPost) {
    const id = 'p' + Date.now() + Math.floor(Math.random() * 1000);
    window.__httpCb = window.__httpCb || {};
    window.__httpCb[id] = cb;
    try { window.Android.httpPost(url, key, body, id); } catch (e) { cb(-1, ''); }
  } else if (window.fetch) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: body,
    }).then(function (r) { return r.text().then(function (t) { cb(r.status, t); }); })
      .catch(function () { cb(-1, ''); });
  } else {
    cb(-1, '');
  }
}

/* ---------- 解析 ---------- */
function apiErrMsg(body) {
  try {
    const j = JSON.parse(body);
    const m = (j.error && (j.error.message || j.error.type)) || j.message || j.msg;
    return m ? String(m).slice(0, 120) : '';
  } catch (e) {
    return String(body || '').replace(/\s+/g, ' ').slice(0, 120);
  }
}

function extractJson(body) {
  let j;
  try {
    j = JSON.parse(body);
  } catch (e) {
    return { err: '接口没返回 JSON：' + String(body || '').replace(/\s+/g, ' ').slice(0, 160) };
  }
  if (j.error) {
    const m = (j.error && (j.error.message || j.error.type)) || '接口返回错误';
    return { err: String(m).slice(0, 160) };
  }
  const ch = j.choices && j.choices[0];
  if (!ch) {
    return { err: '接口结构不对（没有 choices）：' + String(body || '').replace(/\s+/g, ' ').slice(0, 160) };
  }
  const msg = ch.message || {};
  let c = msg.content;
  if (Array.isArray(c)) {
    c = c.map(function (x) { return (x && (x.text || x.content)) || ''; }).join('');
  }
  if (c == null || String(c).trim() === '') {
    return {
      err: '模型返回为空（finish_reason: ' + (ch.finish_reason || '未知') +
        (msg.reasoning_content ? '，只有思考内容' : '') + '）',
      code: ch.finish_reason === 'length' ? 'length' : '',
    };
  }
  c = String(c).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = c.indexOf('{');
  const b = c.lastIndexOf('}');
  if (a < 0 || b < 0) {
    return { err: '模型没按 JSON 回：' + c.replace(/\s+/g, ' ').slice(0, 160), code: 'json' };
  }
  try {
    return { data: JSON.parse(c.slice(a, b + 1)) };
  } catch (e) {
    const cut = ch.finish_reason === 'length';
    return {
      err: (cut ? '输出被截断（finish_reason: length）' : 'JSON 解析失败') + '：' + c.slice(0, 120),
      code: cut ? 'length' : 'json',
    };
  }
}

function parseReply(kind, body, s) {
  const r = extractJson(body);
  if (r.err) return { err: r.err };
  const d = r.data || {};
  const ps = personasFor(s);
  const out = [];
  if (kind === 'short') {
    (d.comments || []).forEach(function (it, i) {
      let t = String(it.text || '').trim();
      if (!t) return;
      const cap = TUNE().limitChars ? (TUNE().charLimit || 100) : 0;
      if (cap && t.length > cap) t = t.slice(0, cap - 1) + '。';

      const base = ps[i % ps.length];
      out.push({
        id: uid(),
        p: { n: (it.nick || base.n), h: base.h, t: base.t },
        text: t,
        likes: rnd(0, 40),
        replies: 0,
        time: rnd(1, 72) + ' 小时前',
      });
    });
  } else if (kind === 'long') {
    (d.items || []).forEach(function (it, i) {
      if (!it.title || !it.body) return;
      out.push({
        id: uid(),
        persona: { n: it.nick || '旧书页', t: '写了十年书评', h: HUES[i % HUES.length] },
        title: String(it.title).trim(),
        score: '★★★★☆',
        body: String(it.body).split(/\n{2,}/).filter(Boolean),
      });
    });
  } else {
    (d.items || []).forEach(function (it) {
      if (!it.body) return;
      out.push({
        id: uid(),
        title: it.title || '无题',
        tags: (it.tags || []).slice(0, 3),
        likes: rnd(8, 40),
        body: String(it.body).split(/\n{2,}/).filter(Boolean),
      });
    });
  }
  return { items: out };
}


/* ================= 生成流程 ================= */
function genOf(s, key) {
  if (!s.gen) s.gen = {};
  if (!s.gen[key]) s.gen[key] = { streams: {} };
  return s.gen[key];
}
function streamOf(s, key, angle) {
  const g = genOf(s, key);
  const a = angle || '';
  if (!g.streams[a]) g.streams[a] = { batches: [], page: 0, loading: false };
  const st = g.streams[a];
  st.batches = (st.batches || []).filter(function (b) { return b && b.length; });
  if (st.page > st.batches.length - 1) st.page = Math.max(0, st.batches.length - 1);
  return st;
}

function currentSeries() {
  const c = cur();
  return seriesById(c.params.sid) || S.series[0];
}

function sourceTextFor(key, sid) {
  const s = seriesById(sid);
  if (!s) return '';

  // 同人：整个系列的全部正文 + 全部设定集
  if (key === 'doujin') {
    const parts = [];
    const body = (s.works || []).map(function (w) {
      return '《' + (w.title || '正文') + '》\n' + (w.text || '');
    }).join('\n\n');
    if (body) parts.push('【正文】\n' + body);
    if (s.codex && s.codex.length) {
      parts.push('【设定集】\n' + s.codex.map(function (c) {
        return (c.title || '') + '：' + (c.body || '');
      }).join('\n\n'));
    }
    return parts.join('\n\n');
  }

  // 系列评论：所有正文
  if (key.startsWith('s')) return s.works.map((w) => w.text).join('\n');

  // 单章评论：只发这一章
  const c = cur();
  const w = workById(s, c.params.wid) || s.works[0];
  return w ? w.text : '';
}

function generate(sid, key, kind, isRetry) {
  const s = seriesById(sid);
  if (!s) return;
  const c = cur();
  const angle = c.params.angle || '';
  const st = streamOf(s, key, angle);
  if (st.loading) return;
  st.err = '';
  st.errMsg = '';
  if (!S.api.key) { st.err = 'nokey'; render(); return; }
  st.loading = true;
  st.t0 = Date.now();
  render();
  if (!s.gen) s.gen = {};
  const styleIdx = s.gen._style || 0;
  s.gen._style = (styleIdx + 1) % 5;
  const tt = TUNE();
  const n = kind === 'short' ? 10 : (kind === 'long' ? 2 : 1);
  const payload = buildPayload(kind, sourceTextFor(key, sid), angle, styleIdx, n);
  apiPost('/chat/completions', payload, function (code, body) {
    st.loading = false;
    if (code === -2) { st.err = 'nokey'; render(); return; }
    if (code === -2 || code === -1) {
      // 切后台常常把连接掐断，先静默重试一次
      if (!isRetry) {
        st.loading = false;
        render();
        setTimeout(function () { generate(sid, key, kind, true); }, 1200);
        return;
      }
      st.loading = false;
      st.err = (code === -2 ? 'timeout' : 'net');
      render();
      return;
    }
    if (code !== 200) {
      st.err = (code === 401 ? 'auth' : (code === 402 ? 'nobalance' : 'HTTP ' + code));
      st.errMsg = apiErrMsg(body);
      render(); return;
    }
    const r = parseReply(kind, body, s);
    if (r.err) { st.err = r.err; st.errCode = r.code || ''; render(); return; }
    if (!r.items || !r.items.length) { st.err = 'empty'; render(); return; }
    st.batches.push(r.items);
    st.page = st.batches.length - 1;
    save(); render();
  });
}

/* ================= 背景 ================= */
function albumList() {
  if (S.bg.album === 'custom') return S.bg.custom.length ? S.bg.custom : [];
  return Array.from({ length: DEFAULT_BG }, (_, i) => 'd:' + i);
}
function bgLayer(veil) {
  const list = albumList();
  if (!list.length) return `<div class="bg bg-1"><div class="veil ${veil}"></div></div>`;
  const item = list[S.bg.idx % list.length];
  if (item.startsWith('d:')) return `<div class="bg bg-${parseInt(item.slice(2), 10) + 1} ${veil === 'paper' ? 'soft' : ''}"><div class="veil ${veil}"></div><div class="grain"></div></div>`;
  return `<div class="bg soft" style="background-image:url('${item}');background-size:cover;background-position:center"><div class="veil ${veil}"></div></div>`;
}
function rotateBg() {
  const list = albumList();
  if (list.length < 2) return;
  S.bg.idx = (S.bg.idx + 1 + rnd(0, list.length - 2)) % list.length;
  save();
}

/* ================= 组件 ================= */
function hdr(title, opt = {}) {
  const backBtn = opt.back === false ? '' : '<button class="back" data-act="back"><span class="arw">‹</span>返回</button>';
  const act = opt.act ? `<button class="act" data-act="${opt.actAct || ''}">${opt.act}</button>` : '';
  return `<div class="hdr">${backBtn}<div class="title">${esc(title)}</div>${act}</div>`;
}
function emptyBox(title, sub, btn, act) {
  return `<div class="empty2"><div class="e1">◇</div><div class="e2">${title}</div><div class="e3">${sub}</div>${btn ? `<button class="btn-ghost" data-act="${act}">${btn}</button>` : ''}</div>`;
}
function avatarOf(name, hue) {
  const ch = (name || '读')[0];
  return `<div class="avatar" style="background:hsl(${hue} 42% 44%)">${esc(ch)}</div>`;
}
function pager(page, total, key) {
  return `<div class="pager">
    <button data-act="prev" ${page <= 0 ? 'disabled' : ''}>‹ 上一页</button>
    <button class="pg" data-act="pagesel" data-key="${key || ''}">第 ${page + 1}${total ? ' / ' + total : ''} 页</button>
    <button data-act="next">下一页 ›</button>
  </div>`;
}

/* ================= 视图 ================= */
function vHome() {
  const has = S.series.length > 0;
  return `<div class="screen home">
    ${bgLayer('deep')}
    <button class="menu-btn" data-act="drawer">☰</button>
    <div class="home-brand">
      <div class="hb-1">${esc(S.author.id || '长夜')}</div>
      <div class="hb-2">${has ? S.series.length + ' 个系列' : '从一个系列开始'}</div>
    </div>
    <div class="home-hint">点左上角，或向右滑动</div>
    ${drawerHtml()}
  </div>`;
}

function drawerHtml() {
  const rows = S.series.map((s) => `
    <div class="dr-item" data-act="openser" data-sid="${s.id}" data-longpress="series">
      <div class="dr-title">${esc(s.title)}</div>
      <div class="dr-meta">${s.works.length} 篇 · ${s.codex.length} 则设定</div>
    </div>`).join('');
  return `<div class="drawer-mask ${nav.drawer ? 'on' : ''}" data-act="closedrawer"></div>
  <div class="drawer ${nav.drawer ? 'on' : ''}" id="drawer">
    <div class="dr-head">
      <button class="dr-close" data-act="closedrawer">‹</button>
      <span class="dr-t">书架</span>
      <div class="dr-acts">
        <button class="dr-add" data-act="newseries" aria-label="新建">＋</button>
      </div>
    </div>
    <div class="dr-list">
      ${S.series.length ? rows : '<div class="dr-empty">还没有系列<br>点右上角 ＋ 新建</div>'}
    </div>
    <div class="dr-foot">
      <div class="dr-item foot" data-act="go" data-view="settings">
        <div class="dr-title">⚙　设置</div>
      </div>
    </div>
  </div>`;
}

function vSeries() {
  const s = seriesById(cur().params.sid);
  if (!s) { nav.stack.pop(); return vHome(); }
  const entries = [
    { ico: 'book', t: '正文', d: s.works.length ? s.works.length + ' 篇' : '还没有作品', v: 'works' },
    { ico: 'codex', t: '设定集', d: s.codex.length ? s.codex.length + ' 则手记' : '还没有设定', v: 'codex' },
    { ico: 'pen', t: '系列评论', d: genCount(s, 'series_short') + ' 页短评 · ' + genCount(s, 'series_long') + ' 页长评', v: 'sreview' },
    { ico: 'spark', t: '同人', d: genCount(s, 'doujin') + ' 篇', v: 'doujin' },
  ];
  return `<div class="screen">
    ${hdr(s.title, { act: '⋯', actAct: 'seriesmenu' })}
    <div class="scroll">
      <div class="series-hero">
        <div class="book">
          <div class="book-cover" data-act="setcover">${s.cover ? `<img src="${s.cover}" alt="">` : `<span>${esc(s.title.slice(0, 2))}</span>`}</div>
          <div class="book-meta">
            <div class="book-title">${esc(s.title)}</div>
            <div class="book-desc">${esc(s.intro || '还没有简介')}</div>
            <div class="book-stats"><span><b>${s.works.length}</b> 篇</span><span><b>${s.codex.length}</b> 则设定</span></div>
          </div>
        </div>
        <div class="entries">
          ${entries.map((e) => `<div class="entry" data-act="go" data-view="${e.v}">
            <div class="ico">${ICO[e.ico]}</div>
            <div class="txt"><div class="t">${e.t}</div><div class="d">${e.d}</div></div>
            <div class="arrow">›</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function genCount(s, key) {
  const g = s.gen && s.gen[key];
  if (!g) return 0;
  return Object.values(g.streams).reduce((n, st) => n + st.batches.length, 0);
}

function fab(label, act) {
  return '<button class="fab" data-act="' + act + '">' + label + '</button>';
}

function pickHeader(title, kind, count) {
  return '<div class="hdr">' +
    '<button class="back" data-act="pickcancel"><span class="arw">‹</span>取消</button>' +
    '<div class="title">已选 ' + count + ' 项</div>' +
    '<button class="act primary" data-act="pickdel" data-kind="' + kind + '"' + (count ? '' : ' disabled') + '>删除</button>' +
    '</div>';
}

function vWorks() {
  const s = seriesById(cur().params.sid);
  const pick = nav.pick && nav.pick.view === 'works' ? nav.pick : null;
  const on = pick ? pick.ids : {};
  const rows = s.works.map((w) => {
    const sel = !!on[w.id];
    if (pick) {
      return '<div class="entry pickable' + (sel ? ' sel' : '') + '" style="margin:0 18px 10px" data-act="pickrow" data-id="' + w.id + '">' +
        '<div class="pcheck' + (sel ? ' on' : '') + '">' + (sel ? '✓' : '') + '</div>' +
        '<div class="txt"><div class="t">' + esc(w.title) + '</div><div class="d">' + esc(w.cat || '正文') + ' · ' + (w.text || '').length + ' 字</div></div>' +
        '</div>';
    }
    return '<div class="entry" style="margin:0 18px 10px" data-act="openwork" data-wid="' + w.id + '" data-longpress="work">' +
      '<div class="ico" style="background:var(--surface-2);color:var(--ink-2)">' + esc(w.cat ? w.cat[0] : '文') + '</div>' +
      '<div class="txt"><div class="t">' + esc(w.title) + '</div><div class="d">' + esc(w.cat || '正文') + ' · ' + (w.text || '').length + ' 字</div></div>' +
      '<div class="arrow">›</div>' +
      '</div>';
  }).join('');
  const head = pick
    ? pickHeader('正文', 'works', Object.keys(pick.ids).length)
    : hdr('正文', { act: '删除', actAct: 'pickstart', actKind: 'works' });
  const add = pick ? '' : fab('＋ 导入', 'newwork');
  return `<div class="screen">
    ${head}
    <div class="scroll" style="padding-top:6px">
      ${s.works.length ? rows : emptyBox('还没有正文', '导入一篇 txt，或直接粘贴', '导入作品', 'newwork')}
    </div>
    ${add}
  </div>`;
}

function vWork() {
  const s = seriesById(cur().params.sid);
  const w = workById(s, cur().params.wid);
  if (!w) { nav.stack.pop(); return vSeries(); }
  const tab = nav.tab.work || 'text';
  let body = '';
  if (tab === 'text') {
    const ps = (w.text || '').split(/\n+/).filter(Boolean);
    body = `<div class="reader"><h3>${esc(w.title)}</h3><div class="lead">${esc(w.cat || '正文')}</div>${ps.map((p) => `<p>${esc(p)}</p>`).join('') || '<p class="dim">（空白）</p>'}</div>`;
  } else if (tab === 'short') {
    body = commentBlock(s, 'work:' + w.id + ':short', 'short');
  } else {
    body = longBlock(s, 'work:' + w.id + ':long');
  }
  const key = 'work:' + w.id + ':' + (tab === 'long' ? 'long' : 'short');
  return `<div class="screen">
    ${hdr(w.title, { act: '编辑', actAct: 'editwork' })}
    <div class="seg">
      <button class="${tab === 'text' ? 'on' : ''}" data-act="tab" data-t="text">正文</button>
      <button class="${tab === 'short' ? 'on' : ''}" data-act="tab" data-t="short">短评</button>
      <button class="${tab === 'long' ? 'on' : ''}" data-act="tab" data-t="long">长评</button>
    </div>
    <div class="scroll">${body}</div>
    ${tab !== 'text' ? pager(...pagerState(s, key)) : ''}
  </div>`;
}

function clampStream(st) {
  if (!st || !st.batches) return st;
  if (st.page > st.batches.length - 1) st.page = st.batches.length - 1;
  if (st.page < 0) st.page = 0;
  return st;
}

function pagerState(s, key) {
  const st = clampStream(streamOf(s, key, cur().params.angle || ''));
  return [st.page, st.batches.length];
}

function curGenKey() {
  const c = cur();
  if (c.view === 'doujin') return 'doujin';
  if (c.view === 'sreview') return (nav.tab.sreview || 'short') === 'short' ? 'series_short' : 'series_long';
  if (c.view === 'work') {
    const t = nav.tab.work || 'text';
    return 'work:' + c.params.wid + ':' + (t === 'long' ? 'long' : 'short');
  }
  return '';
}

function histList() {
  const key = curGenKey();
  const s = seriesById(cur().params.sid);
  if (!s || !s.gen || !s.gen[key]) return [];
  const g = s.gen[key];
  return Object.keys(g.streams || {})
    .filter(function (a) { return a && a.trim(); })
    .map(function (a) { return { angle: a, pages: g.streams[a].batches.length }; })
    .filter(function (h) { return h.pages > 0; });
}

function histRows(angle) {
  const list = histList();
  if (!list.length) return '';
  return list.map(function (h) {
    const on = h.angle === angle;
    return '<div class="hist-row' + (on ? ' on' : '') + '" data-q="' + esc(h.angle) + '">' +
      '<button class="h-main" data-act="search" data-w="' + esc(h.angle) + '">' +
      '<span class="h-q">' + esc(h.angle) + '</span>' +
      '<span class="h-n">' + h.pages + ' 页</span></button>' +
      '<button class="h-del" data-act="delhist" data-w="' + esc(h.angle) + '">×</button></div>';
  }).join('');
}

function applySearch(v) {
  let q = v;
  if (q == null) {
    const el = document.getElementById('q');
    q = el ? el.value : '';
  }
  q = String(q || '').trim();
  const c = cur();
  c.params.angle = q;
  render();
}

function searchBar(angle, presets, showChips) {
  return `<div class="searchwrap">
    <div class="searchbar">
      <span class="mag">⌕</span>
      <input id="q" placeholder="输入关键词，回车生成" value="${esc(angle || '')}" autocomplete="off">
      ${angle ? '<button class="clear" data-act="clearq">×</button>' : ''}
      <button class="qgo" data-act="search">搜索</button>
    </div>
    <div class="hist" id="hist">${histRows(angle)}</div>
  </div>
  ${showChips && !angle ? `<div class="chips">${presets.map((w) => `<button class="chip" data-act="search" data-w="${w}">${w}</button>`).join('')}</div>` : ''}`;
}

function commentBlock(s, key, kind) {
  const angle = cur().params.angle || '';
  const st = streamOf(s, key, angle);
  if (st.err) return `<div class="pad">${searchBar(angle, PRESETS.short, true)}</div>` + genError(st, key);
  if (!st.batches.length) {
    if (st.suppress) {
      return `<div class="pad">${searchBar(angle, PRESETS.short, true)}</div>
        <div class="empty2"><div class="e1">·</div><div class="e2">这一页已删除</div>
        <div class="e3">要新的就再生成一批</div>
        <button class="btn-ghost" data-act="gennow" data-key="${key}">生成一批</button></div>`;
    }
    if (!st.loading) { setTimeout(() => generate(s.id, key, kind), 30); }
    return `<div class="pad">${searchBar(angle, PRESETS.short, true)}</div>` + skeleton(5);
  }
  if (st.loading) return `<div class="pad">${searchBar(angle, PRESETS.short, true)}</div>` + skeleton(5);
  const batch = st.batches[st.page] || [];
  if (!batch.length) return `<div class="pad">${searchBar(angle, PRESETS.short, true)}</div>` + emptyBox('还没有评论', '点生成，或换个角度', '', '');
  return `<div class="pad">${searchBar(angle, PRESETS.short, true)}</div>
    <div>${batch.map((c) => `<div class="cmt" data-longpress="cmt" data-cid="${c.id}" data-key="${key}">
      ${avatarOf(c.p.n, c.p.h)}
      <div class="cmt-main">
        <div class="cmt-top"><span class="cmt-name">${esc(c.p.n)}</span><span class="cmt-time">${c.time}</span></div>
        <div class="cmt-body">${esc(c.text)}</div>
        <div class="cmt-meta"><span>♡ ${c.likes}</span></div>
      </div></div>`).join('')}</div>`;
}

function longBlock(s, key) {
  const angle = cur().params.angle || '';
  const st = streamOf(s, key, angle);
  if (st.err) return `<div class="pad">${searchBar(angle, PRESETS.long, true)}</div>` + genError(st, key);
  if (!st.batches.length) {
    if (!st.loading) { setTimeout(() => generate(s.id, key, 'long'), 30); }
    return `<div class="pad">${searchBar(angle, PRESETS.long, true)}</div>` + skeleton(2);
  }
  if (st.loading) return `<div class="pad">${searchBar(angle, PRESETS.long, true)}</div>` + skeleton(2);
  const batch = st.batches[st.page] || [];
  return `<div class="pad">${searchBar(angle, PRESETS.long, true)}</div>
    <div style="padding-top:12px">${batch.map((it) => `<div class="longcard" data-longpress="cv" data-cid="${it.id}" data-key="${key}">
      <div class="head">${avatarOf(it.persona.n, it.persona.h)}
        <div class="who"><div class="n">${esc(it.persona.n)}</div><div class="r">${esc(it.persona.t)}</div></div>
        <div class="stars">${it.score}</div>
      </div>
      <h4>${esc(it.title)}</h4>
      <div class="body">${it.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    </div>`).join('')}</div>`;
}

function genError(st, key) {
  const map = { nokey: '未连接模型', net: '网络中断', timeout: '生成超时', interrupted: '上次生成被中断', auth: 'Key 无效', nobalance: '余额不足', parse: '模型返回看不懂', empty: '没生成出内容' };
  const msg = (map[st.err] || st.err) + (st.errMsg ? '：' + st.errMsg : '');
  const isKey = st.err === 'nokey';
  const wasCut = st.errCode === 'length';
  const hint = wasCut
    ? '输出被 max_tokens 截断了。可以提高上限再试，或在设置里调大。'
    : (isKey
      ? '去设置里填 API Key 和模型'
      : (st.err === 'net' || st.err === 'timeout' || st.err === 'interrupted'
        ? '生成时切到后台容易断。点重试继续，或把 App 留在前台。'
        : '评论由模型生成，需要先在设置里填好 API Key 和模型'));
  const btnMain = isKey
    ? '<button class="btn-ghost" data-act="go" data-view="real">去设置</button>'
    : (wasCut
      ? '<button class="btn-ghost" data-act="bumptokens" data-key="' + key + '">提高上限并重试</button>'
      : '<button class="btn-ghost" data-act="retrygen" data-key="' + key + '">重试</button>');
  const btnTune = wasCut ? '<button class="btn-ghost" data-act="go" data-view="tune">生成参数</button>' : '';
  return '<div class="empty2"><div class="e1">!</div><div class="e2">' + msg + '</div>' +
    '<div class="e3">' + hint + '</div>' +
    '<div class="err-btns">' + btnMain + btnTune + '</div></div>';
}

function skeleton(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += '<div class="skel"><div class="a"></div><div class="l"><div class="bar"></div><div class="bar"></div><div class="bar"></div></div></div>';
  return out;
}

function vCodex() {
  const s = seriesById(cur().params.sid);
  const pick = nav.pick && nav.pick.view === 'codex' ? nav.pick : null;
  const on = pick ? pick.ids : {};
  const items = s.codex.map((f, i) => {
    const sel = !!on[f.id];
    if (pick) {
      return '<div class="card pickable' + (sel ? ' sel' : '') + '" style="margin:0 18px 10px;padding:15px 16px 14px" data-act="pickrow" data-id="' + f.id + '">' +
        '<div class="pcheck' + (sel ? ' on' : '') + '">' + (sel ? '✓' : '') + '</div>' +
        '<div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;gap:9px;margin-bottom:7px">' +
        '<span class="idx">' + String(i + 1).padStart(2, '0') + '</span><span class="ct">' + esc(f.title) + '</span></div>' +
        '<div class="cb">' + esc(f.body) + '</div></div></div>';
    }
    return '<div class="card" style="margin:0 18px 10px;padding:15px 16px 14px" data-act="editcodex" data-cid="' + f.id + '" data-longpress="codex">' +
      '<div style="display:flex;align-items:baseline;gap:9px;margin-bottom:7px">' +
      '<span class="idx">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="ct">' + esc(f.title) + '</span></div>' +
      '<div class="cb">' + esc(f.body) + '</div>' +
      '</div>';
  }).join('');
  const head = pick
    ? pickHeader('设定集', 'codex', Object.keys(pick.ids).length)
    : hdr('设定集', { act: '删除', actAct: 'pickstart', actKind: 'codex' });
  return `<div class="screen">
    ${bgLayer('paper')}
    <div style="position:relative;z-index:2;display:flex;flex-direction:column;flex:1;min-height:0">
      ${head}
      <div class="scroll" style="padding-top:4px">
        <div class="pad dim small">${pick ? '勾选要删除的设定。' : '点一条可以改，长按可以删。'}</div>
        ${s.codex.length ? items : emptyBox('还没有设定', '写一则，AI 会照着它来演', '写第一则', 'newcodex')}
      </div>
      ${pick ? '' : fab('＋ 新建', 'newcodex')}
    </div>
  </div>`;
}

function vSReview() {
  const s = seriesById(cur().params.sid);
  const tab = nav.tab.sreview || 'short';
  const key = tab === 'short' ? 'series_short' : 'series_long';
  const body = tab === 'short' ? commentBlock(s, key, 'short') : longBlock(s, key);
  return `<div class="screen">
    ${hdr('系列评论')}
    <div class="seg">
      <button class="${tab === 'short' ? 'on' : ''}" data-act="tab2" data-t="short">短评</button>
      <button class="${tab === 'long' ? 'on' : ''}" data-act="tab2" data-t="long">长评</button>
    </div>
    <div class="scroll">${body}</div>
    ${pager(pagerState(s, key)[0], pagerState(s, key)[1], key)}
  </div>`;
}

function vDoujin() {
  const s = seriesById(cur().params.sid);
  const key = 'doujin';
  const st = streamOf(s, key, cur().params.angle || '');
  if (!st.batches.length) {
    if (st.err) return `<div class="screen">${hdr('同人')}<div class="scroll">${genError(st, key)}</div>${pager(0, 0, key)}</div>`;
    if (st.suppress) {
      return `<div class="screen">${hdr('同人')}<div class="scroll">` +
        `<div class="pad">${searchBar(cur().params.angle || '', PRESETS.doujin, false)}</div>` +
        `<div class="empty2"><div class="e1">·</div><div class="e2">这一篇已删除</div>` +
        `<div class="e3">要新的就再生成一篇</div>` +
        `<button class="btn-ghost" data-act="gennow" data-key="${key}">生成一篇</button></div></div>` +
        `${pager(0, 0, key)}</div>`;
    }
    if (!st.loading) setTimeout(() => generate(s.id, key, 'doujin'), 30);
    return `<div class="screen">${hdr('同人')}<div class="scroll">${skeleton(1)}</div>${pager(0, 0, key)}</div>`;
  }
  const d = (st.batches[st.page] || [])[0];
  return `<div class="screen">
    ${hdr('同人')}
    <div class="scroll">
      <div class="pad">${searchBar(cur().params.angle || '', PRESETS.doujin, false)}</div>
      ${d ? `<div class="dj" data-longpress="dj" data-cid="${d.id}" data-key="doujin">
        <h3>${esc(d.title)}</h3>
        <div class="byline"><span>匿名读者</span><span>·</span><span>${d.likes} 人喜欢</span></div>
        <div class="tags">${d.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="text">${d.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      </div>` : emptyBox('还没有同人', '', '', '')}
    </div>
    ${pager(pagerState(s, key)[0], pagerState(s, key)[1], key)}
  </div>`;
}

function vSettings() {
  const a = S.author;
  return `<div class="screen">
    ${bgLayer('paper')}
    <div style="position:relative;z-index:2;display:flex;flex-direction:column;flex:1;min-height:0">
      ${hdr('设置')}
      <div class="scroll" style="padding-top:6px">
        <div class="grp">
          <div class="row" data-act="editauthor">
            ${a.img ? `<div class="avatar-lg" style="background:hsl(${a.hue} 40% 42%)"><img src="${a.img}" alt=""></div>` : `<div class="avatar-lg" style="background:hsl(${a.hue} 40% 42%)">${esc((a.id || '作')[0])}</div>`}
            <div class="l"><div style="font-weight:650">${esc(a.id || '未设置作者')}</div><div class="dim small">作者 ID · 点头修改</div></div>
            <span class="chev">›</span>
          </div>
        </div>

        <div class="sect-title">外观</div>
        <div class="grp">
          <div class="row" data-act="theme">
            <span class="l">主题</span><span class="r">${themeLabel()}</span><span class="chev">›</span>
          </div>
          <div class="row" data-act="go" data-view="bgmgr">
            <span class="l">背景</span><span class="r">${S.bg.album === 'default' ? '默认图集' : '自定义'} · ${albumList().length} 张</span><span class="chev">›</span>
          </div>
        </div>

        <div class="grp" style="margin-top:18px">
          <div class="row" data-act="go" data-view="real">
            <span class="l">世界的真实</span><span class="r">接口 · 生成参数 · 提示词</span><span class="chev">›</span>
          </div>
        </div>

        <div class="sect-title">关于</div>
        <div class="grp">
          <div class="row" style="cursor:default"><span class="l">版本</span><span class="r">v${APP_VER_NAME}（${APP_VER}）</span></div>
          <div class="field"><label>更新地址（version.json）</label><input id="upd-url" class="upd-in" value="${esc(S.updateUrl || DEFAULT_UPDATE_URL)}" placeholder="https://raw.githubusercontent.com/…/version.json"></div>
        </div>
        <div class="api-actions">
          <button class="btn-line" data-act="checkupdate">检查更新</button>
        </div>

        <div class="sect-title">数据</div>
        <div class="grp">
          <div class="row" data-act="resetall"><span class="l" style="color:#c0392b">清空全部数据</span></div>
        </div>
        <div class="ver">长夜 v${APP_VER_NAME}</div>
      </div>
    </div>
  </div>`;
}

function vBgMgr() {
  const custom = S.bg.custom;
  const defs = Array.from({ length: DEFAULT_BG }, (_, i) => i);
  const thumb = (i) => `<div class="bg-thumb ${S.bg.album === 'default' && S.bg.idx % DEFAULT_BG === i ? 'on' : ''}" data-act="setdefault" data-i="${i}">
      <div class="mini bg-${i + 1}"></div><span class="chk">✓</span></div>`;
  const cthumb = (src, i) => `<div class="bg-thumb ${S.bg.album === 'custom' && S.bg.idx % Math.max(1, custom.length) === i ? 'on' : ''}" data-act="setcustom" data-i="${i}">
      <div class="mini" style="background:url('${src}') center/cover"></div><span class="del" data-act="delcustom" data-i="${i}">×</span></div>`;
  return `<div class="screen">
    ${hdr('背景')}
    <div class="scroll" style="padding-top:8px">
      <div class="album-seg">
        <button class="${S.bg.album === 'default' ? 'on' : ''}" data-act="album" data-a="default">默认</button>
        <button class="${S.bg.album === 'custom' ? 'on' : ''}" data-act="album" data-a="custom">自定义</button>
      </div>
      ${S.bg.album === 'default'
        ? `<div class="pad dim small">系统自带，不可删除。</div><div class="bg-grid">${defs.map(thumb).join('')}</div>`
        : `<div class="pad dim small">你自己的图。长按删除。</div>
           <div class="bg-grid">${custom.map(cthumb).join('')}
             <div class="bg-thumb add" data-act="addcustom"><div class="plus">＋</div></div>
           </div>`}
    </div>
  </div>`;
}

function tuneRow(label, k, min, max, step, unit, hint) {
  const v = TUNE()[k];
  return '<div class="tune-row">' +
    '<div class="tune-lab"><div class="t1">' + label + '</div>' +
    (hint ? '<div class="t2">' + hint + '</div>' : '') + '</div>' +
    '<div class="tune-ctl">' +
    '<input class="tune-in" type="number" data-k="' + k + '" data-min="' + min + '" data-max="' + max + '" step="' + step + '" value="' + v + '">' +
    (unit ? '<span class="tune-unit">' + unit + '</span>' : '') +
    '</div></div>';
}

function swRow(title, sub, on, act) {
  return '<div class="tune-row"><div class="tune-lab"><div class="t1">' + title + '</div>' +
    '<div class="t2">' + sub + '</div></div>' +
    '<div class="switch ' + (on ? 'on' : '') + '" data-act="' + act + '"></div></div>';
}

function tuneBody() {
  const t = TUNE();
  return '<div class="pad dim small" style="line-height:1.8;padding:4px 16px 8px">关闭时用内置值，输出长度不受限制。</div>' +
    '<div class="grp">' + swRow('启用自定义生成参数', t.enabled ? '正在使用下面的值' : '当前使用内置值', t.enabled, 'toggletune') + '</div>' +

    '<div class="sect-title">温度</div>' +
    '<div class="grp">' + tuneRow('短评', 'tempShort', 0, 2, 0.05, '', '内置 1.0') +
    tuneRow('长评', 'tempLong', 0, 2, 0.05, '', '内置 0.85') +
    tuneRow('同人', 'tempDoujin', 0, 2, 0.05, '', '内置 0.9') + '</div>' +

    '<div class="sect-title">最大输出</div>' +
    '<div class="grp">' + swRow('限制输出长度', t.limitOut ? '按下面的值发送' : '不限制，按官方上限 393216 发送', t.limitOut, 'togglelimit') +
    tuneRow('短评', 'maxShort', 256, 393216, 128, 'tokens', '') +
    tuneRow('长评', 'maxLong', 512, 393216, 256, 'tokens', '') +
    tuneRow('同人', 'maxDoujin', 512, 393216, 256, 'tokens', '') + '</div>' +

    '<div class="sect-title">采样</div>' +
    '<div class="grp">' + tuneRow('top_p', 'topP', 0.1, 1, 0.05, '', '非思考模式下不生效') + '</div>' +

    '<div class="sect-title">输入</div>' +
    '<div class="grp">' + swRow('限制正文发送长度', t.limitCtx ? '只发前 ' + t.ctxChars + ' 字' : '全文发送', t.limitCtx, 'togglectx') +
    tuneRow('正文发送上限', 'ctxChars', 500, 30000, 500, '字', '') + '</div>' +

    '<div class="sect-title">单条长度</div>' +
    '<div class="grp">' + swRow('限制单条短评字数', t.limitChars ? '超过 ' + t.charLimit + ' 字截断' : '不限，写多长都保留', t.limitChars, 'togglechars') +
    tuneRow('单条短评上限', 'charLimit', 40, 400, 5, '字', '') + '</div>' +

    '<div style="height:20px"></div>';
}

function promptBody() {
  const rows = [
    ['short', '短评', 'JSON：{"comments":[{"nick":"…","text":"…"}]}'],
    ['long', '长评', 'JSON：{"items":[{"nick":"…","title":"…","score":4,"body":"…"}]}'],
    ['doujin', '同人', 'JSON：{"items":[{"nick":"…","title":"…","body":"…","tags":["…"]}]}'],
  ];
  return '<div class="pad dim small" style="line-height:1.8;padding:4px 16px 12px">' +
    '用 {n} 表示本批条数（短评 10、长评 2、同人 1）。留空则用内置提示词。</div>' +
    rows.map(function (r) {
      const cur = (S.prompts[r[0]] || '').trim();
      const val = cur || buildSystem(r[0], 0, '{n}');
      return '<div class="prompt-block">' +
        '<div class="pb-head"><span>' + r[1] + '</span>' +
        '<span class="pb-state">' + (cur ? '已自定义' : '内置') + '</span>' +
        '<button class="pb-reset" data-act="promreset" data-k="' + r[0] + '">恢复内置</button></div>' +
        '<textarea class="p-ta" data-k="' + r[0] + '">' + esc(val) + '</textarea>' +
        '<div class="pb-tip">' + r[2] + '</div></div>';
    }).join('') + '<div style="height:20px"></div>';
}

function vTune() {
  return '<div class="screen">' + hdr('生成参数') + '<div class="scroll">' + tuneBody() + '</div></div>';
}

function vReal() {
  const tab = nav.tab.real || 'api';
  const tabs = [['api', '接口'], ['tune', '参数'], ['prompt', '提示词']];
  return '<div class="screen">' +
    hdr('世界的真实') +
    '<div class="seg-tabs">' + tabs.map(function (t) {
      return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="realtab" data-t="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="scroll" style="padding-top:6px">' +
    (tab === 'api' ? realApi() : tab === 'tune' ? tuneBody() : promptBody()) +
    '</div></div>';
}

function realApi() {
  const st = S.api.status || { state: 'idle', msg: '' };
  const label = st.state === 'ok' ? '已连接' : st.state === 'fail' ? '连接失败' : st.state === 'loading' ? '连接中…' : '未连接';
  const bal = st.balance;
  return '<div class="grp">' +
    '<div class="field"><label>BASE URL</label><input id="f-base" value="' + esc(S.api.base) + '"></div>' +
    '<div class="field"><label>API KEY</label><input id="f-key" type="password" value="' + esc(S.api.key) + '" placeholder="sk-..."><div class="hint">只存在本机，不上传</div></div>' +
    '<div class="field"><label>模型</label><input id="f-model" value="' + esc(S.api.model) + '">' +
    '<div class="model-chips">' +
    '<button class="mchip" data-act="pickmodel" data-m="deepseek-flash">deepseek-flash</button>' +
    '<button class="mchip" data-act="pickmodel" data-m="deepseek-v4-pro">deepseek-v4-pro</button>' +
    '</div></div>' +
    '</div>' +
    '<div class="api-row"><span class="dot ' + st.state + '"></span><span class="api-txt">' + esc(label) + (st.msg ? ' · ' + esc(st.msg) : '') + '</span><span class="api-at">' + esc(st.at || '') + '</span></div>' +
    '<div class="api-actions">' +
    '<button class="btn-line" data-act="testapi">测试连接</button>' +
    '<button class="btn-line" data-act="refreshbal">刷新余额</button>' +
    '<button class="btn-line primary" data-act="saveapi2">保存</button>' +
    '</div>' +
    '<div class="balance"><div class="lab">可用余额</div>' +
    '<div class="amt">' + (bal ? '¥ ' + esc(String(bal.total)) : '—') + '</div>' +
    '<div class="sub">' + (bal ? esc('赠金 ¥' + (bal.granted || '0') + ' · 充值 ¥' + (bal.topped || '0')) : (S.api.key ? '点「刷新余额」查询' : '未连接')) + '</div>' +
    '<div class="fresh">' + (bal && bal.at ? '更新于 ' + esc(bal.at) : '') + '</div></div>' +
    '<div class="pad dim small" style="line-height:1.9">余额来自模型商接口，今日消耗由本机记账，两者口径不同。</div>';
}

function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function normModel(v) {
  const raw = String(v || '').trim();
  const low = raw.toLowerCase().replace(/\s+/g, '');
  const known = ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'];
  if (known.indexOf(low) > -1) return low;
  return raw;
}

function apiGetUrl(url, cb) {
  if (window.Android && window.Android.httpGet) {
    const id = 'g' + Date.now() + Math.floor(Math.random() * 1000);
    window.__httpCb = window.__httpCb || {};
    window.__httpCb[id] = cb;
    try { window.Android.httpGet(url, '', id); } catch (e) { cb(-1, ''); }
  } else if (window.fetch) {
    fetch(url).then(function (r) { return r.text().then(function (t) { cb(r.status, t); }); })
      .catch(function () { cb(-1, ''); });
  } else {
    cb(-1, '');
  }
}

function checkUpdate() {
  const el = document.getElementById('upd-url');
  const url = ((el && el.value) || S.updateUrl || DEFAULT_UPDATE_URL).trim();
  if (!url || url.indexOf('USER/REPO') > -1) { toast('先填更新地址'); return; }
  if (!S.updateUrl) S.updateUrl = url;
  S.updateUrl = url; save();
  toast('检查中…');
  apiGetUrl(url, function (code, body) {
    if (code !== 200) { openSheet('<div class="sh-title">检查失败</div><div class="srow" style="cursor:default">HTTP ' + code + '</div>'); return; }
    let j = null;
    try { j = JSON.parse(body); } catch (e) { }
    if (!j || !j.versionCode) {
      openSheet('<div class="sh-title">地址不是 version.json</div><div class="srow" style="cursor:default">' + esc(String(body).slice(0, 80)) + '</div>');
      return;
    }
    if (j.versionCode <= APP_VER) {
      openSheet('<div class="sh-title">已是最新</div><div class="srow" style="cursor:default">当前 v' + APP_VER_NAME + '（' + APP_VER + '），线上 ' + esc(j.versionName || '') + '（' + j.versionCode + '）</div>');
      return;
    }
    openSheet('<div class="sh-title">有新版本 v' + esc(j.versionName || '') + '</div>' +
      '<div class="srow" style="cursor:default;line-height:1.7">' + esc(j.notes || '') + '</div>' +
      '<div class="srow" data-act="openurl" data-url="' + esc(j.apk || j.page || '') + '">去下载</div>');
  });
}

function clearGenErrors() {
  S.series.forEach(function (s) {
    if (!s.gen) return;
    Object.keys(s.gen).forEach(function (k) {
      if (k === '_style') return;
      const g = s.gen[k];
      if (!g || !g.streams) return;
      Object.values(g.streams).forEach(function (st) { st.err = ''; st.errMsg = ''; });
    });
  });
}

function readApiForm() {
  const b = document.getElementById('f-base');
  const k = document.getElementById('f-key');
  const m = document.getElementById('f-model');
  if (b) S.api.base = b.value.trim();
  if (k) S.api.key = k.value.trim();
  if (m) S.api.model = normModel(m.value);
  save();
}

function apiStatus(state, msg, balance) {
  S.api.status = {
    state: state,
    msg: msg || '',
    balance: balance || (S.api.status ? S.api.status.balance : null) || null,
    at: nowHM()
  };
  save(); render();
}

function apiGet(path, cb) {
  const base = (S.api.base || '').replace(/\/+$/, '');
  const key = S.api.key;
  if (!base || !key) { cb(-2, ''); return; }
  const url = base + path;
  if (window.Android && window.Android.httpGet) {
    const id = 'r' + Date.now() + Math.floor(Math.random() * 1000);
    window.__httpCb = window.__httpCb || {};
    window.__httpCb[id] = cb;
    try { window.Android.httpGet(url, key, id); } catch (e) { cb(-1, ''); }
  } else if (window.fetch) {
    fetch(url, { headers: { Authorization: 'Bearer ' + key } })
      .then((r) => r.text().then((t) => cb(r.status, t)))
      .catch(() => cb(-1, ''));
  } else {
    cb(-1, '');
  }
}

window.__http = function (id, code, b64) {
  let text = '';
  try { text = decodeURIComponent(escape(atob(b64))); } catch (e) { text = ''; }
  const f = window.__httpCb && window.__httpCb[id];
  if (f) { delete window.__httpCb[id]; f(code, text); }
};

function parseBalance(body) {
  try {
    const j = JSON.parse(body);
    if (j.error) return { err: j.error.message || '接口返回错误' };
    const infos = j.balance_infos || [];
    const cny = infos.filter(function (x) { return x.currency === 'CNY'; })[0] || infos[0];
    if (!cny) return { err: '返回里没有余额字段' };
    return { total: cny.total_balance, granted: cny.granted_balance, topped: cny.topped_up_balance };
  } catch (e) {
    return { err: '返回不是合法 JSON' };
  }
}

function testApi() {
  readApiForm();
  if (!S.api.key) { toast('先填 API Key'); return; }
  apiStatus('loading', '');
  apiGet('/user/balance', function (code, body) {
    if (code === 200) {
      const b = parseBalance(body);
      if (b.err) { apiStatus('fail', b.err); return; }
      apiStatus('ok', 'Key 有效', { total: b.total, granted: b.granted, topped: b.topped, at: nowHM() });
    } else if (code === 401) {
      apiStatus('fail', 'Key 无效（401）');
    } else if (code === 402) {
      apiStatus('fail', '余额不足（402）');
    } else if (code === -1) {
      apiStatus('fail', '网络不通');
    } else if (code === -2) {
      apiStatus('fail', '地址或 Key 为空');
    } else {
      apiStatus('fail', 'HTTP ' + code);
    }
  });
}

function refreshBalance() {
  readApiForm();
  if (!S.api.key) { toast('先填 API Key'); return; }
  apiStatus('loading', '');
  apiGet('/user/balance', function (code, body) {
    if (code === 200) {
      const b = parseBalance(body);
      if (b.err) { apiStatus('fail', b.err); return; }
      apiStatus('ok', '已刷新', { total: b.total, granted: b.granted, topped: b.topped, at: nowHM() });
    } else {
      apiStatus('fail', code === -1 ? '网络不通' : 'HTTP ' + code);
    }
  });
}


function vHomeUnused() { return ''; }

const ICO = {
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v13H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11"/></svg>',
  codex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.5 8.5 4.2L12 12 3.5 7.7z"/><path d="m3.5 12.2 8.5 4.2 8.5-4.2"/><path d="m3.5 16.4 8.5 4.2 8.5-4.2"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 19.5 5 16l10.6-10.6a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19z"/><path d="m14.8 6.4 3 3"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.8c0 4.4 2.4 6.8 6.8 6.8-4.4 0-6.8 2.4-6.8 6.8 0-4.4-2.4-6.8-6.8-6.8 4.4 0 6.8-2.4 6.8-6.8Z"/></svg>',
};

const PRESETS = {
  short: ['角色形象', '外貌', '剧情节奏', '描写手法', '角色关系', '读者情感'],
  long: ['主题立意', '叙事结构', '人物弧光', '语言风格', '伏笔与回收'],
  doujin: [],
};

/* ================= 渲染 ================= */
const VIEWS = {
  home: vHome, series: vSeries, works: vWorks, work: vWork, codex: vCodex,
  sreview: vSReview, doujin: vDoujin, settings: vSettings, bgmgr: vBgMgr, real: vReal, editor: vEditor, tune: vTune,
};

function resolvedTheme() {
  if (S.theme === 'auto') {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  return S.theme === 'dark' ? 'dark' : 'light';
}

function themeLabel() {
  return S.theme === 'auto' ? '跟随系统' : (S.theme === 'dark' ? '深色' : '浅色');
}

function render() {
  const c = cur();
  const fn = VIEWS[c.view] || vHome;
  phone.dataset.theme = resolvedTheme();
  phone.classList.toggle('onbg', c.view === 'home' && !nav.drawer);
  if (window.Android && Android.setLightStatusBar) Android.setLightStatusBar(resolvedTheme() === 'light' && (c.view !== 'home' || nav.drawer));
  const html = fn();
  stage.innerHTML = html;
}

/* ================= 弹层 ================= */
function openSheet(html) {
  sheetEl.innerHTML = '<div class="handle"></div>' + html;
  sheetEl.classList.add('on');
  maskEl.classList.add('on');
}
function closeSheet() {
  sheetEl.classList.remove('on');
  maskEl.classList.remove('on');
}

const EDITORS = {
  series: { title: '新建系列', fields: [
    { k: 'title', label: '书名', ph: '例如：长夜将尽' },
    { k: 'intro', label: '简介（可空）', type: 'ta' }] },
  work: { title: '导入正文', fields: [
    { k: 'title', label: '标题', ph: '第一章' },
    { k: 'cat', label: '分类', ph: '正传 / 外传 / 番外' },
    { k: 'text', label: '正文', type: 'ta', ph: '粘贴文本…' }] },
  codex: { title: '写一则设定', fields: [
    { k: 'title', label: '标题', ph: '守夜人的边界' },
    { k: 'body', label: '内容', type: 'ta' }] },
  author: { title: '作者', fields: [
    { k: 'id', label: '作者 ID', ph: '你的名字' }] },
  rename: { title: '改书名', fields: [
    { k: 'title', label: '书名' }] },
};

function openEditor(mode, extra) {
  nav.stack.push({ view: 'editor', params: Object.assign({ mode: mode }, extra || {}) });
  render();
}

function vEditor() {
  const c = cur();
  const cfg = EDITORS[c.params.mode] || EDITORS.series;
  const vals = c.params.values || {};
  const title = c.params.wid ? '编辑正文' : (c.params.cid ? '编辑设定' : cfg.title);
  const extraAvatar = c.params.mode === 'author'
    ? '<div class="ed-f"><label>头像</label>' +
      '<div class="av-row">' + avatarHTML(64, S.author.hue, S.author.id, S.author.img) +
      '<button class="btn-ghost" data-act="pickavatar">从相册选择</button></div></div>'
    : '';
  const body = cfg.fields.map((f) => {
    const v = esc(vals[f.k] || '');
    if (f.type === 'ta') {
      return '<div class="ed-f"><label>' + esc(f.label) + '</label><textarea id="ed-' + f.k + '" placeholder="' + esc(f.ph || '') + '">' + v + '</textarea></div>';
    }
    return '<div class="ed-f"><label>' + esc(f.label) + '</label><input id="ed-' + f.k + '" value="' + v + '" placeholder="' + esc(f.ph || '') + '"></div>';
  }).join('');
  return '<div class="screen">' +
    '<div class="hdr"><button class="back" data-act="back"><span class="arw">‹</span>取消</button>' +
    '<div class="title">' + esc(title) + '</div>' +
    '<button class="act primary" data-act="edsave">保存</button></div>' +
    '<div class="scroll ed-scroll">' + extraAvatar + body + '<div class="ed-gap"></div></div></div>';
}

function editorSave() {
  const c = cur();
  const mode = c.params.mode;
  const cfg = EDITORS[mode] || EDITORS.series;
  const v = {};
  cfg.fields.forEach((f) => {
    const el = document.getElementById('ed-' + f.k);
    v[f.k] = el ? el.value : '';
  });
  if (mode === 'series') {
    if (!v.title.trim()) { toast('书名不能为空'); return; }
    const s = { id: uid(), title: v.title.trim(), intro: (v.intro || '').trim(), works: [], codex: [], gen: {}, personas: null };
    S.series.unshift(s); save();
    nav.stack.pop();
    nav.stack.push({ view: 'series', params: { sid: s.id } });
    render(); return;
  }
  if (mode === 'work') {
    if (!v.title.trim() || !v.text.trim()) { toast('标题和正文都要填'); return; }
    const s = seriesById(c.params.sid);
    if (c.params.wid) {
      const w = workById(s, c.params.wid);
      if (w) { w.title = v.title.trim(); w.cat = (v.cat || '').trim() || '正文'; w.text = v.text.trim(); }
    } else {
      s.works.push({ id: uid(), title: v.title.trim(), cat: (v.cat || '').trim() || '正文', text: v.text.trim() });
    }
    save(); nav.stack.pop(); render(); return;
  }
  if (mode === 'codex') {
    if (!v.title.trim() || !v.body.trim()) { toast('标题和内容都要填'); return; }
    const s = seriesById(c.params.sid);
    if (c.params.cid) {
      const f = s.codex.filter(function (x) { return x.id === c.params.cid; })[0];
      if (f) { f.title = v.title.trim(); f.body = v.body; }
    } else {
      s.codex.push({ id: uid(), title: v.title.trim(), body: v.body });
    }
    save(); nav.stack.pop(); render(); return;
  }
  if (mode === 'author') {
    S.author.id = v.id.trim();
    S.author.hue = HUES[Math.floor(Math.random() * HUES.length)];
    save(); nav.stack.pop(); render(); return;
  }
  if (mode === 'rename') {
    if (!v.title.trim()) { toast('书名不能为空'); return; }
    const s = seriesById(c.params.sid);
    s.title = v.title.trim();
    save(); nav.stack.pop(); render(); return;
  }
}


/* ================= 动作 ================= */
function openSeries(id) {
  nav.drawer = false;
  nav.stack.push({ view: 'series', params: { sid: id } });
  render();
}
function newSeries() { openEditor('series'); }

function newWork() { openEditor('work', { sid: cur().params.sid }); }

function newCodex() { openEditor('codex', { sid: cur().params.sid }); }


function delSeries(id) {
  const s = seriesById(id);
  openSheet(`<div class="sh-title">删除《${esc(s.title)}》？</div>
    <div class="sh-note">正文、设定集、评论、同人都会一起删除，不可恢复。</div>
    <button class="send danger" data-act="docdelseries" data-sid="${id}">删除</button>`);
}
function delWork(sid, wid) {
  openSheet(`<div class="sh-title">删除这篇正文？</div><div class="sh-note">它的评论会一起删除。</div>
    <button class="send danger" data-act="docdelwork" data-sid="${sid}" data-wid="${wid}">删除</button>`);
}
function delCodex(sid, cid) {
  openSheet(`<div class="sh-title">删除这则设定？</div>
    <button class="send danger" data-act="docdelcodex" data-sid="${sid}" data-cid="${cid}">删除</button>`);
}

/* ================= 事件 ================= */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const c = cur();

  if (act === 'closesheet') { closeSheet(); return; }
  if (act === 'edsave') { editorSave(); return; }
  if (act === 'submitform') { submitForm(); return; }
  if (act === 'delcomment') { delComment(el); return; }
  if (act === 'delpage') { delPage(el.dataset.key); return; }
  if (act === 'gennow') { const ss2 = seriesById(cur().params.sid); const st2 = streamOf(ss2, el.dataset.key, cur().params.angle || ''); st2.suppress = false; generate(ss2.id, el.dataset.key, kindOf(el.dataset.key)); return; }
  if (act === 'deldoujin') { delDoujin(el); return; }
  if (act === 'renameseries2') { renameSeries(el.dataset.sid); return; }
  if (act === 'setdefault') { S.bg.idx = +el.dataset.i; S.bg.album = 'default'; save(); render(); return; }
  if (act === 'setcustom') { S.bg.idx = +el.dataset.i; save(); render(); return; }

  if (act === 'drawer') { nav.drawer = !nav.drawer; render(); return; }
  if (act === 'closedrawer') { nav.drawer = false; render(); return; }
  if (act === 'openser') { openSeries(el.dataset.sid); return; }
  if (act === 'newseries') { newSeries(); return; }
  if (act === 'back') { back(); return; }
  if (act === 'go') { go(el.dataset.view, { sid: c.params.sid }); return; }

  if (act === 'openwork') { nav.tab.work = cur().view === 'work' ? nav.tab.work : 'text'; go('work', { sid: c.params.sid, wid: el.dataset.wid }); return; }
  if (act === 'tab') { nav.tab.work = el.dataset.t; render(); return; }
  if (act === 'tab2') { nav.tab.sreview = el.dataset.t; render(); return; }

  if (act === 'newwork') { newWork(); return; }
  if (act === 'newcodex') { newCodex(); return; }

  if (act === 'chip') { applySearch(el.dataset.w); return; }
  if (act === 'search') { applySearch(el.dataset.w); return; }
  if (act === 'delhist') {
    const q = el.dataset.w;
    const key = curGenKey();
    const ss = seriesById(cur().params.sid);
    const pages = (ss && ss.gen && ss.gen[key] && ss.gen[key].streams[q]) ? ss.gen[key].streams[q].batches.length : 0;
    openSheet('<div class="sh-title">删除搜索记录</div>' +
      '<div class="srow" style="cursor:default;line-height:1.7">「' + esc(q) + '」及它的 ' + pages + ' 页生成内容会一起删除，无法恢复。</div>' +
      '<div class="srow danger" data-act="doDelHist" data-w="' + esc(q) + '" data-key="' + key + '">确认删除</div>');
    return;
  }
  if (act === 'doDelHist') {
    const q = el.dataset.w;
    const key = el.dataset.key;
    const ss = seriesById(cur().params.sid);
    if (ss && ss.gen && ss.gen[key] && ss.gen[key].streams) {
      delete ss.gen[key].streams[q];
    }
    if (cur().params.angle === q) cur().params.angle = '';
    save(); closeSheet(); render(); toast('已删除');
    return;
  }
  if (act === 'pagesel') {
    const key = el.dataset.key || curGenKey();
    const ss = seriesById(cur().params.sid);
    const st = streamOf(ss, key, cur().params.angle || '');
    if (!st.batches.length) { toast('还没有生成内容'); return; }
    const rows = st.batches.map(function (b, i) {
      return '<div class="srow' + (i === st.page ? ' on' : '') + '" data-act="gotopage" data-p="' + i + '">第 ' + (i + 1) + ' 页 · ' + b.length + ' 条</div>';
    }).join('');
    openSheet('<div class="sh-title">跳到第几页（共 ' + st.batches.length + ' 页）</div>' + rows);
    return;
  }
  if (act === 'gotopage') {
    const key = curGenKey();
    const ss = seriesById(cur().params.sid);
    const st = streamOf(ss, key, cur().params.angle || '');
    st.page = Math.max(0, Math.min(parseInt(el.dataset.p, 10) || 0, st.batches.length - 1));
    closeSheet(); render(); return;
  }
  if (act === 'clearq') { const cc = cur(); cc.params.angle = ''; render(); return; }
  if (act === 'prev' || act === 'next') {
    const s = seriesById(c.params.sid);
    const key = keyOf(c);
    const st = streamOf(s, key, c.params.angle || '');
    if (act === 'prev') { if (st.page > 0) { st.page--; render(); } }
    else {
      if (st.page < st.batches.length - 1) { st.page++; render(); }
      else { generate(s.id, key, kindOf(key)); }
    }
    return;
  }
  if (act === 'cmtmenu' || act === 'cvmenu' || act === 'djmenu') { openItemMenu(act, el); return; }
  if (act === 'codexmenu') {
    openSheet(`<div class="sh-title">这则设定</div>
      <div class="srow" data-act="docdelcodex" data-sid="${c.params.sid}" data-cid="${el.dataset.cid}">删除</div>`);
    return;
  }

  if (act === 'checkupdate') { checkUpdate(); return; }
  if (act === 'openurl') { const u = el.dataset.url; if (u && window.Android && window.Android.openUrl) Android.openUrl(u); else if (u) window.open(u); return; }
  if (act === 'pickstart') {
    const kind = (el && el.dataset && el.dataset.kind) || (c.view === 'codex' ? 'codex' : 'works');
    nav.pick = { view: kind, ids: {} }; render(); return;
  }
  if (act === 'pickcancel') { nav.pick = null; render(); return; }
  if (act === 'pickrow') {
    const pp = nav.pick; if (!pp) return;
    const id = el.dataset.id;
    if (pp.ids[id]) delete pp.ids[id]; else pp.ids[id] = 1;
    render(); return;
  }
  if (act === 'pickdel') {
    const pp = nav.pick; if (!pp) return;
    const ids = Object.keys(pp.ids);
    if (!ids.length) { toast('先勾选要删的'); return; }
    const ss = seriesById(c.params.sid);
    if (pp.view === 'works') {
      ss.works = ss.works.filter(function (w) { return !pp.ids[w.id]; });
      ids.forEach(function (id) { delete ss.gen['work:' + id + ':short']; delete ss.gen['work:' + id + ':long']; });
    } else {
      ss.codex = ss.codex.filter(function (f) { return !pp.ids[f.id]; });
    }
    nav.pick = null; save(); render(); toast('已删除 ' + ids.length + ' 项'); return;
  }
  if (act === 'editwork') {
    const ss = seriesById(c.params.sid);
    const w = workById(ss, cur().params.wid);
    if (w) openEditor('work', { sid: ss.id, wid: w.id, values: { title: w.title, cat: w.cat, text: w.text } });
    return;
  }
  if (act === 'editcodex') {
    const ss = seriesById(c.params.sid);
    const f = ss.codex.filter(function (x) { return x.id === el.dataset.cid; })[0];
    if (f) openEditor('codex', { sid: ss.id, cid: f.id, values: { title: f.title, body: f.body } });
    return;
  }
  if (act === 'seriesmenu') {
    openSheet(`<div class="sh-title">《${esc(seriesById(c.params.sid).title)}》</div>
      <div class="srow" data-act="setcover">更换封面</div>
      <div class="srow" data-act="renameseries">重命名</div>
      <div class="srow danger" data-act="delseries" data-sid="${c.params.sid}">删除整个系列</div>`);
    return;
  }
  if (act === 'renameseries') { renameSeries(c.params.sid); return; }
  if (act === 'delseries') { closeSheet(); delSeries(el.dataset.sid); return; }

  if (act === 'editauthor') { openEditor('author', { values: { id: S.author.id } }); return; }
  if (act === 'theme') {
    S.theme = S.theme === 'light' ? 'dark' : (S.theme === 'dark' ? 'auto' : 'light');
    save(); render(); toast(themeLabel()); return;
  }

  if (act === 'album') { S.bg.album = el.dataset.a; S.bg.idx = 0; save(); render(); return; }
  if (act === 'addcustom') { pickImage(); return; }
  if (act === 'delcustom') { S.bg.custom.splice(+el.dataset.i, 1); S.bg.idx = 0; save(); render(); return; }

  if (act === 'saveapi' || act === 'saveapi2') { readApiForm(); clearGenErrors(); toast('已保存'); return; }
  if (act === 'bumptokens') {
    const kk = el.dataset.key;
    const kind = kk === 'doujin' ? 'doujin' : (kk.indexOf('long') > -1 ? 'long' : 'short');
    const fld = kind === 'long' ? 'maxLong' : (kind === 'doujin' ? 'maxDoujin' : 'maxShort');
    S.tune[fld] = Math.min(393216, Math.round((S.tune[fld] || 2000) * 1.5));
    save();
    const ss = seriesById(cur().params.sid);
    if (ss) generate(ss.id, kk, kindOf(kk));
    toast('上限提到 ' + S.tune[fld] + ' tokens，重试中');
    return;
  }
  if (act === 'togglelimit') { S.tune.limitOut = !S.tune.limitOut; save(); render(); return; }
  if (act === 'toggletune') { S.tune.enabled = !S.tune.enabled; save(); render(); return; }
  if (act === 'togglectx') { S.tune.limitCtx = !S.tune.limitCtx; save(); render(); return; }
  if (act === 'togglechars') { S.tune.limitChars = !S.tune.limitChars; save(); render(); return; }
  if (act === 'realtab') { nav.tab.real = el.dataset.t; render(); return; }
  if (act === 'promreset') { S.prompts[el.dataset.k] = ''; save(); render(); return; }
  if (act === 'pickavatar') { pickAvatar(function (d) { S.author.img = d; save(); render(); }); return; }
  if (act === 'setcover') { pickCover(function (d) { const ss = seriesById(cur().params.sid); if (ss) { ss.cover = d; save(); } closeSheet(); render(); }); return; }
  if (act === 'tunereset') { S.tune = Object.assign({}, DEFAULT_TUNE); save(); render(); toast('已恢复默认'); return; }
  if (act === 'retrygen') { const ss = seriesById(cur().params.sid); if (ss) generate(ss.id, el.dataset.key, kindOf(el.dataset.key)); return; }
  if (act === 'pickmodel') { const f = document.getElementById('f-model'); if (f) f.value = el.dataset.m; S.api.model = el.dataset.m; clearGenErrors(); save(); return; }
  if (act === 'testapi') { testApi(); return; }
  if (act === 'refreshbal') { refreshBalance(); return; }
  if (act === 'resetall') {
    openSheet(`<div class="sh-title">清空全部数据？</div><div class="sh-note">系列、正文、设定、评论都会消失。</div>
      <button class="send danger" data-act="docreset">确认清空</button>`);
    return;
  }
  if (act === 'docreset') { S.series = []; S.author = { id: '', hue: 0 }; save(); closeSheet(); goRoot(); return; }

  if (act === 'docdelseries') {
    S.series = S.series.filter((x) => x.id !== el.dataset.sid);
    save(); closeSheet(); goRoot(); return;
  }
  if (act === 'docdelwork') {
    const s = seriesById(el.dataset.sid);
    s.works = s.works.filter((w) => w.id !== el.dataset.wid);
    Object.keys(s.gen || {}).forEach((k) => { if (k.indexOf('work:' + el.dataset.wid) === 0) delete s.gen[k]; });
    save(); closeSheet(); render(); return;
  }
  if (act === 'docdelcodex') {
    const s = seriesById(el.dataset.sid);
    s.codex = s.codex.filter((x) => x.id !== el.dataset.cid);
    save(); closeSheet(); render(); return;
  }
});

function keyOf(c) {
  if (c.view === 'work') return 'work:' + c.params.wid + ':' + (nav.tab.work === 'long' ? 'long' : 'short');
  if (c.view === 'sreview') return (nav.tab.sreview === 'long') ? 'series_long' : 'series_short';
  if (c.view === 'doujin') return 'doujin';
  return '';
}
function kindOf(key) {
  if (key === 'doujin') return 'doujin';
  if (key.indexOf('long') > -1) return 'long';
  return 'short';
}

function openItemMenu(kind, el) {
  const c = cur();
  if (kind === 'cmtmenu') {
    const key = el.dataset.key;
    openSheet(`<div class="sh-title">这条短评</div>
      <div class="srow" data-act="delcomment" data-key="${key}" data-cid="${el.dataset.cid}">删除</div>`);
  } else if (kind === 'cvmenu') {
    const key = el.dataset.key;
    openSheet(`<div class="sh-title">这篇长评</div>
      <div class="srow" data-act="delcomment" data-key="${key}" data-cid="${el.dataset.cid}">删除</div>`);
  } else {
    openSheet(`<div class="sh-title">这篇同人</div>
      <div class="srow" data-act="deldoujin" data-cid="${el.dataset.cid}">删除</div>`);
  }
}

function submitForm() {
  const fields = [...sheetEl.querySelectorAll('.sh-field')];
  const v = {};
  fields.forEach((f) => { const inp = f.querySelector('input,textarea'); if (inp) v[inp.id.slice(2)] = inp.value; });
  if (sheetEl._submit && sheetEl._submit(v) === false) return;
}

function delPage(key) {
  const s = seriesById(cur().params.sid);
  if (!s) return;
  const st = streamOf(s, key, cur().params.angle || '');
  if (!st.batches.length) return;
  st.batches.splice(st.page, 1);
  clampStream(st);
  if (!st.batches.length) st.suppress = true;
  save(); closeSheet(); render();
}

function delComment(el) {
  const s = seriesById(cur().params.sid);
  if (!s || !s.gen) return;
  const g = s.gen[el.dataset.key];
  if (!g) return;
  Object.values(g.streams).forEach((st) => {
    st.batches.forEach((b) => {
      const i = b.findIndex((x) => x.id === el.dataset.cid);
      if (i > -1) b.splice(i, 1);
    });
    st.batches = st.batches.filter(function (b) { return b.length > 0; });
    if (!st.batches.length) st.suppress = true;
    clampStream(st);
  });
  save(); closeSheet(); render();
}

function delDoujin(el) {
  const s = seriesById(cur().params.sid);
  if (!s || !s.gen || !s.gen.doujin) return;
  Object.values(s.gen.doujin.streams).forEach((st) => {
    st.batches.forEach((b) => {
      const i = b.findIndex((x) => x.id === el.dataset.cid);
      if (i > -1) b.splice(i, 1);
    });
    st.batches = st.batches.filter(function (b) { return b.length > 0; });
    if (!st.batches.length) st.suppress = true;
    clampStream(st);
  });
  save(); closeSheet(); render();
}

function renameSeries(sid) {
  const s = seriesById(sid);
  closeSheet();
  openEditor('rename', { sid: sid, values: { title: s.title } });
}


document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'q') {
    const c = cur();
    c.params.angle = e.target.value.trim() || '';
    render();
  }
});

/* 图片选择 */
function pickAvatar(cb) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const d = 360;
        const cv = document.createElement('canvas');
        cv.width = d; cv.height = d;
        const ctx = cv.getContext('2d');
        const sc = Math.max(d / img.width, d / img.height);
        ctx.drawImage(img, (d - img.width * sc) / 2, (d - img.height * sc) / 2, img.width * sc, img.height * sc);
        cb(cv.toDataURL('image/jpeg', .85));
      };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  };
  inp.click();
}

function avatarHTML(size, hue, id, img) {
  const style = 'width:' + size + 'px;height:' + size + 'px;background:hsl(' + hue + ' 40% 42%)';
  if (img) return '<div class="avatar-lg" style="' + style + '"><img src="' + img + '" alt=""></div>';
  return '<div class="avatar-lg" style="' + style + '">' + esc((id || '作')[0]) + '</div>';
}

function pickCover(cb) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        const w = 360, h = 540;
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        const sc = Math.max(w / img.width, h / img.height);
        ctx.drawImage(img, (w - img.width * sc) / 2, (h - img.height * sc) / 2, img.width * sc, img.height * sc);
        cb(cv.toDataURL('image/jpeg', .85));
      };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  };
  inp.click();
}

function pickImage() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        const w = 540, h = 960;
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        const scale = Math.max(w / img.width, h / img.height);
        ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);
        S.bg.custom.push(cv.toDataURL('image/jpeg', .82));
        S.bg.album = 'custom'; S.bg.idx = S.bg.custom.length - 1;
        save(); render();
      };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  };
  inp.click();
}

/* 滑动 / 长按 */
let px = 0, py = 0, moved = false, pressTimer = null, pressEl = null;

stage.addEventListener('pointerdown', (e) => {
  px = e.clientX; py = e.clientY; moved = false;
  const el = e.target.closest('[data-longpress]');
  if (!el) { pressEl = null; return; }
  pressEl = el;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => { moved = true; longPress(el); }, 520);
});
stage.addEventListener('pointermove', (e) => {
  if (!pressEl) return;
  if (Math.abs(e.clientX - px) > 8 || Math.abs(e.clientY - py) > 8) { clearTimeout(pressTimer); pressEl = null; }
});
stage.addEventListener('pointerup', (e) => { clearTimeout(pressTimer); });

function longPress(el) {
  const kind = el.dataset.longpress;
  if (kind === 'series') {
    const s = seriesById(el.dataset.sid);
    openSheet(`<div class="sh-title">《${esc(s.title)}》</div>
      <div class="srow" data-act="renameseries2" data-sid="${s.id}">重命名</div>
      <div class="srow danger" data-act="delseries" data-sid="${s.id}">删除</div>`);
  }
  if (kind === 'work') {
    const c = cur();
    openSheet(`<div class="sh-title">这篇正文</div>
      <div class="srow danger" data-act="docdelwork" data-sid="${c.params.sid}" data-wid="${el.dataset.wid}">删除</div>`);
  }
  if (kind === 'codex') {
    const c = cur();
    openSheet(`<div class="sh-title">这则设定</div>
      <div class="srow danger" data-act="docdelcodex" data-sid="${c.params.sid}" data-cid="${el.dataset.cid}">删除</div>`);
  }
  if (kind === 'cmt') {
    const ss = seriesById(cur().params.sid);
    const stt = streamOf(ss, el.dataset.key, cur().params.angle || '');
    const cnt = (stt.batches[stt.page] || []).length;
    openSheet(`<div class="sh-title">这一页</div>
      <div class="srow danger" data-act="delcomment" data-key="${el.dataset.key}" data-cid="${el.dataset.cid}">删除这一条</div>
      <div class="srow danger" data-act="delpage" data-key="${el.dataset.key}">删除整页（${cnt} 条）</div>`);
  }
  if (kind === 'cv') {
    openSheet(`<div class="sh-title">这篇长评</div>
      <div class="srow danger" data-act="delcomment" data-key="${el.dataset.key}" data-cid="${el.dataset.cid}">删除这一篇</div>`);
  }
  if (kind === 'dj') {
    openSheet(`<div class="sh-title">这篇同人</div>
      <div class="srow danger" data-act="deldoujin" data-cid="${el.dataset.cid}">删除</div>`);
  }
}

/* 主页右滑打开抽屉 */
stage.addEventListener('touchstart', (e) => {
  const c = cur();
  if (c.view !== 'home') return;
  px = e.touches[0].clientX;
}, { passive: true });
stage.addEventListener('touchend', (e) => {
  const c = cur();
  if (c.view !== 'home') return;
  const dx = e.changedTouches[0].clientX - px;
  if (!nav.drawer && dx > 60) { nav.drawer = true; render(); }
  else if (nav.drawer && dx < -40) { nav.drawer = false; render(); }
}, { passive: true });

/* ================= 启动 ================= */
window.__resume = function () {
  try {
    S.series.forEach(function (s2) {
      if (!s2.gen) return;
      Object.keys(s2.gen).forEach(function (k) {
        if (k === '_style') return;
        const g = s2.gen[k];
        if (!g || !g.streams) return;
        Object.keys(g.streams).forEach(function (a) {
          const st = g.streams[a];
          if (st.loading && st.t0 && Date.now() - st.t0 > 330000) {
            st.loading = false;
            st.err = 'timeout';
          }
        });
      });
    });
    save();
    render();
  } catch (e) {}
};

window.__setInset = function (t, b) {
  const r = document.documentElement;
  const d = window.devicePixelRatio || 1;
  r.style.setProperty('--inset-top', Math.round((t || 0) / d) + 'px');
  r.style.setProperty('--inset-bottom', Math.round((b || 0) / d) + 'px');
};
window.__andBack = function () {
  if (nav.drawer) { nav.drawer = false; render(); return true; }
  if (nav.stack.length > 1) { back(); return true; }
  return false;
};

window.__dbg = { S: null, render, generate, nav, save, go, back, openSeries, newSeries, newWork, newCodex };
window.__dbg.S = S;

(function init() {
  if (APP_MODE) {
    document.body.classList.add('app');
    if (!LS || !LS.getItem(KEY)) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) S.theme = 'dark';
    }
  }
  S.series.forEach(function (s2) {
    if (!s2.gen) return;
    Object.keys(s2.gen).forEach(function (k) {
      if (k === '_style') return;
      const g = s2.gen[k];
      if (!g || !g.streams) return;
      Object.keys(g.streams).forEach(function (a) {
        const st = g.streams[a];
        if (st && st.loading) { st.loading = false; st.err = 'interrupted'; }
      });
    });
  });

  if (S.bg.album === 'default') S.bg.idx = rnd(0, DEFAULT_BG - 1);
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { if (S.theme === 'auto') render(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  } catch (e) {}
  render();
  setInterval(() => {
    const d = new Date();
    const el = document.getElementById('clock');
    if (el) el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }, 1000);
})();

/* 键盘弹起时，把正在编辑的字段滚到可视区中间 */
document.addEventListener('focusin', function (e) {
  const t = e.target;
  if (!t || !t.matches || !t.matches('.ed-f input, .ed-f textarea')) return;
  setTimeout(function () {
    try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { t.scrollIntoView(); }
  }, 320);
});

/* 提示词：输入即保存 */
document.addEventListener('keydown', function (e) {
  const el = e.target;
  if (!el || el.id !== 'q') return;
  if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
});

document.addEventListener('input', function (e) {
  if (e.target && e.target.id === 'q') {
    const q = e.target.value.trim().toLowerCase();
    const box = document.getElementById('hist');
    if (box) {
      Array.prototype.forEach.call(box.querySelectorAll('.hist-row'), function (row) {
        const k = (row.dataset.q || '').toLowerCase();
        row.style.display = (!q || k.indexOf(q) > -1) ? '' : 'none';
      });
    }
    return;
  }
  const u = e.target;
  if (u && u.classList && u.classList.contains('upd-in')) { S.updateUrl = u.value.trim(); save(); return; }
  const el = e.target;
  if (!el || !el.classList || !el.classList.contains('p-ta')) return;
  const k = el.dataset.k;
  const v = el.value;
  S.prompts[k] = v === buildSystem(k, 0, '{n}') ? '' : v;
  save();
});

/* 生成参数：输入即保存 */
document.addEventListener('input', function (e) {
  const el = e.target;
  if (!el || !el.classList || !el.classList.contains('tune-in')) return;
  const k = el.dataset.k;
  let v = parseFloat(el.value);
  if (isNaN(v)) return;
  const min = parseFloat(el.dataset.min);
  const max = parseFloat(el.dataset.max);
  v = Math.max(min, Math.min(max, v));
  S.tune[k] = v;
  save();
});
