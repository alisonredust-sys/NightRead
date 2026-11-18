#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""提示词试验台：本地页面 + 转发，避开浏览器 CORS。
用法：双击 run-prompt-lab.bat，或 python prompt_lab.py
"""
import json
import os
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import prompts as P

PORT = 8777

PAGE = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>提示词试验台</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#111;color:#ddd;font:13px/1.7 -apple-system,"Microsoft YaHei",sans-serif}
  header{padding:14px 18px;border-bottom:1px solid #26262b;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
  h1{font:600 15px/1.4 system-ui;margin:0;color:#f0ece2}
  .hint{color:#777;font-size:12px}
  main{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px 18px 40px}
  @media(max-width:900px){main{grid-template-columns:1fr}}
  .col{display:flex;flex-direction:column;gap:10px;min-width:0}
  label{display:block;font-size:11px;color:#8a8a92;margin:0 0 4px;letter-spacing:.5px}
  input,select,textarea{width:100%;background:#191a1e;color:#e6e2d8;border:1px solid #2c2d33;border-radius:8px;padding:9px 10px;font:13px/1.6 ui-monospace,Menlo,monospace;outline:none}
  input:focus,textarea:focus,select:focus{border-color:#b3573f}
  textarea{resize:vertical}
  #sys{height:300px}#usr{height:170px}#out{height:420px}
  .row{display:flex;gap:8px}
  .row>*{flex:1}
  button{background:#b3573f;border:0;color:#fff;border-radius:8px;padding:10px 16px;font:600 13px inherit;cursor:pointer}
  button.ghost{background:#22232a;color:#cfcbc2;border:1px solid #33343c}
  button:active{transform:scale(.99)}
  button:disabled{opacity:.5;cursor:default}
  .seg{display:none}
  .seg button{flex:1;background:#22232a;color:#bbb;border:1px solid #33343c;font-weight:500}
  .seg button.on{background:#2f3a52;border-color:#4a5a7a;color:#dfe8ff}
  .status{font:12px/1.6 ui-monospace,Menlo,monospace;color:#9aa0a6;min-height:34px;white-space:pre-wrap}
  .ok{color:#5fbf7a}.bad{color:#ff6b6b}
  .tabs{display:flex;gap:6px}
  .tabs button{flex:0 0 auto;background:#1c1d22;color:#bbb;border:1px solid #2c2d33;font-weight:500;padding:6px 10px}
  .tabs button.on{background:#2f3a52;border-color:#4a5a7a;color:#dfe8ff}
  .note{color:#777;font-size:11.5px;line-height:1.7}
.badge{font:12px ui-monospace,Menlo,monospace;padding:3px 9px;border-radius:10px;border:1px solid #33343c;color:#999}
.badge.on{color:#5fbf7a;border-color:#2f5a3d}
.badge.off{color:#ff6b6b;border-color:#5a2f2f}
</style>
<script>
window.onerror = function (m, src, line) {
  var el = document.getElementById('status');
  if (el) { el.className = 'status bad'; el.textContent = '页面脚本出错：' + m + '（第 ' + line + ' 行）'; }
};
</script>
</head>
<body>
<header>
  <h1>提示词试验台</h1>
  <span class="hint">键只存在本机浏览器和本地转发脚本里，不会发到别处。</span><span id="conn" class="badge">未检测</span><button id="pingbtn" class="ghost" style="flex:0 0 auto;padding:6px 12px">测试连接</button>
</header>
<main>
  <div class="col">
    <div class="row">
      <div><label>BASE URL</label><input id="base" value="https://api.deepseek.com"></div>
      <div><label>模型</label><input id="model" value="deepseek-flash"></div>
    </div>
    <div><label>API KEY</label><input id="key" type="password" placeholder="sk-..."></div>
    <div class="row">
      <div><label>温度</label><input id="temp" value="1.0"></div>
      <div><label>max_tokens</label><input id="mt" value="2500"></div>
      <div><label>体裁</label>
        <select id="kind">
          <option value="short">短评</option>
          <option value="long">长评</option>
          <option value="doujin">同人</option>
        </select>
      </div>
    </div>
    <div>
      <label>系统提示词（可直接改）</label>
      <div class="seg">
        <button data-p="0" class="on">追问</button><button data-p="1">挑剔</button>
        <button data-p="2">考据</button><button data-p="3">强调</button><button data-p="4">物件</button>
      </div>
      <textarea id="sys"></textarea>
    </div>
    <div>
      <label>用户消息（正文）</label>
      <textarea id="usr"></textarea>
    </div>
    <div class="row">
      <button id="send">发送</button>
      <button id="reset" class="ghost">重置提示词</button>
    </div>
  </div>

  <div class="col">
    <div class="status" id="status">还没发送。</div>
    <div class="tabs" id="tabs">
      <button data-t="pretty" class="on">解析后的 JSON</button>
      <button data-t="content">模型原文</button>
      <button data-t="raw">完整响应</button>
    </div>
    <textarea id="out" readonly></textarea>
    <div class="note" id="note"></div>
  </div>
</main>
<script>
const SAMPLE = `雪是后半夜开始下的。
林昭醒来的时候，窗纸已经被映得发白。他没有立刻起身，先听了听外面的动静。风停了，雪落得很轻。
他披衣下床，摸到桌角那盏灯，指尖在灯沿上停了一下，没有点。这盏灯已经三年没有点过了。
城南的当铺寅时开门。苏晚坐在柜台后面拨算盘，见他进来，头也没抬，只说了一句：这么早。
林昭说：借个火。
苏晚这才抬眼看他，看了两息，把火折子推过去，又推回来，说：你手是抖的。
林昭低头看了看自己的手，确实在抖。他把手收进袖子里，说：冷。`;

let TASKS = {};
const PROMPTS = location.protocol === 'file:' ? 'http://127.0.0.1:8777/prompts' : '/prompts';

async function loadPrompts() {
  try {
    const r = await fetch(PROMPTS, { cache: 'no-store' });
    TASKS = await r.json();
  } catch (e) {
    TASKS = {};
  }
  fill();
}

const $ = id => document.getElementById(id);
const HOST = 'http://127.0.0.1:8777';
const API = location.protocol === 'file:' ? HOST + '/api' : '/api';
const HEALTH = location.protocol === 'file:' ? HOST + '/health' : '/health';
let persona = 0, kind = 'short';
let last = null;

async function ping() {
  const el = $('conn');
  const btn = $('pingbtn');
  el.textContent = '检测中…';
  el.className = 'badge';
  if (btn) btn.disabled = true;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(HEALTH, { cache: 'no-store', signal: ctl.signal });
    const j = await r.json();
    el.textContent = '本地服务已连接';
    el.className = 'badge on';
  } catch (e) {
    el.textContent = '连不上，先运行 start-prompt-lab.bat';
    el.className = 'badge off';
  } finally {
    clearTimeout(timer);
    if (btn) btn.disabled = false;
  }
}

function buildSys() { return TASKS[kind] || ''; }
function fill() { $('sys').value = buildSys(); }
function fillUser() { $('usr').value = '正文：\n"""\n' + SAMPLE + '\n"""\n'; }

try {
  fillUser();
} catch (e) {
  $('status').className = 'status bad';
  $('status').textContent = '样例填充失败：' + e.message;
}
try { loadPrompts(); } catch (e) { }
try { $('pingbtn').onclick = ping; } catch (e) { }
$('key').value = localStorage.getItem('ds_key') || '';
$('base').value = localStorage.getItem('ds_base') || 'https://api.deepseek.com';
$('model').value = localStorage.getItem('ds_model') || 'deepseek-flash';

document.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.seg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); persona = +b.dataset.p; fill();
});
$('kind').onchange = () => { kind = $('kind').value; fill(); };
$('reset').onclick = fill;
$('pingbtn').onclick = ping;

$('tabs').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); show(b.dataset.t);
};

function show(which) {
  if (!last) return;
  if (which === 'raw') $('out').value = JSON.stringify(last.raw, null, 2);
  else if (which === 'content') $('out').value = last.content || '(空)';
  else $('out').value = last.pretty;
}

$('send').onclick = async () => {
  const key = $('key').value.trim();
  const base = $('base').value.trim();
  const model = $('model').value.trim();
  if (!key) { $('status').textContent = '先填 API Key'; return; }
  localStorage.setItem('ds_key', key);
  localStorage.setItem('ds_base', base);
  localStorage.setItem('ds_model', model);

  const payload = {
    model: model,
    temperature: parseFloat($('temp').value) || 1,
    max_tokens: parseInt($('mt').value, 10) || 2500,
    messages: [
      { role: 'system', content: $('sys').value },
      { role: 'user', content: $('usr').value }
    ]
  };

  $('send').disabled = true;
  $('status').className = 'status';
  $('status').textContent = '请求中…';
  const t0 = performance.now();
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base: base, key: key, payload: payload })
    });
    const res = await r.json();
    const ms = Math.round(performance.now() - t0);
    let raw = null;
    try { raw = JSON.parse(res.body); } catch (e) { raw = { _unparsed: res.body }; }
    last = { raw: raw, content: '', pretty: '' };

    const ch = raw && raw.choices && raw.choices[0];
    const content = ch && ch.message && ch.message.content;
    last.content = content || '';
    const usage = raw && raw.usage;
    const fin = ch && ch.finish_reason;

    let line = 'HTTP ' + res.status + ' · ' + ms + 'ms';
    if (fin) line += ' · finish_reason=' + fin;
    if (usage) line += ' · prompt ' + usage.prompt_tokens + ' / completion ' + usage.completion_tokens;
    if (raw && raw.error) line += '\n错误：' + (raw.error.message || JSON.stringify(raw.error));
    $('status').textContent = line;
    $('status').className = 'status ' + (res.status === 200 && !(raw && raw.error) ? 'ok' : 'bad');

    try {
      const s = last.content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
      const a = s.indexOf('{'), b = s.lastIndexOf('}');
      last.pretty = JSON.stringify(JSON.parse(s.slice(a, b + 1)), null, 2);
    } catch (e) {
      last.pretty = '(不是合法 JSON，见「模型原文」)\n\n' + last.content;
    }
    show(document.querySelector('#tabs button.on').dataset.t);

    const n = last.content ? last.content.length : 0;
    $('note').textContent = content ? ('原文长度 ' + n + ' 字符' + (fin === 'length' ? ' —— 被截断了' : '')) : '';
  } catch (e) {
    $('status').className = 'status bad';
    $('status').textContent = '请求失败：' + e.message +
      '\n连不上本地转发脚本。请先双击 tools\\start-prompt-lab.bat，' +
      '看到「提示词试验台：http://127.0.0.1:8777/」后再点发送。';
  } finally {
    $('send').disabled = false;
  }
};
</script>
</body>
</html>
'''


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            self._send(200, b'{"ok":true}')
            return
        if self.path == '/prompts':
            import json as _json
            data = {k: P.full(k) for k in ('short', 'long', 'doujin')}
            self._send(200, _json.dumps(data, ensure_ascii=False).encode('utf-8'))
            return
        if self.path in ('/', '/index.html'):
            self._send(200, PAGE.encode('utf-8'), 'text/html; charset=utf-8')
        else:
            self._send(404, b'not found', 'text/plain; charset=utf-8')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.end_headers()

    def do_POST(self):
        if self.path != '/api':
            self._send(404, b'not found', 'text/plain; charset=utf-8')
            return
        n = int(self.headers.get('Content-Length', 0))
        req = json.loads(self.rfile.read(n).decode('utf-8'))
        base = (req.get('base') or '').rstrip('/')
        key = req.get('key') or ''
        url = base + '/chat/completions'
        data = json.dumps(req.get('payload') or {}, ensure_ascii=False).encode('utf-8')
        r = urllib.request.Request(url, data=data, method='POST', headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
        })
        t0 = time.time()
        try:
            resp = urllib.request.urlopen(r, timeout=300)
            code = resp.status
            body = resp.read()
        except urllib.error.HTTPError as e:
            code = e.code
            body = e.read()
        except Exception as e:
            code = 0
            body = json.dumps({'error': {'message': str(e)}}, ensure_ascii=False).encode('utf-8')
        out = json.dumps({'status': code, 'body': body.decode('utf-8', 'replace'),
                          'ms': int((time.time() - t0) * 1000)}, ensure_ascii=False).encode('utf-8')
        self._send(200, out)

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    url = 'http://127.0.0.1:%d/' % PORT
    try:
        srv = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    except OSError:
        print('端口 %d 已被占用，可能已经有一个在运行了。' % PORT)
        print('直接打开：' + url)
        webbrowser.open(url)
        time.sleep(3)
        raise SystemExit(0)
    print('提示词试验台：' + url)
    print('关掉这个窗口即停止。')
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    srv.serve_forever()
