// 死後旅程：人生結束後播放的過場動畫
// 取材自民間信仰（《玉曆寶鈔》、十八層地獄、孟婆湯）、但丁《神曲》、古埃及《亡者之書》、《聖經・啟示錄》
(function () {
  const REALM_NAME = { HEAVEN: '天堂', PURGATORY: '煉獄', HELL: '地獄' };
  const REALM_COLOR = { HEAVEN: '#f2c94c', PURGATORY: '#b8a6ea', HELL: '#ff4a3a' };
  const HELL_LEVELS = ['拔舌地獄', '剪刀地獄', '鐵樹地獄', '孽鏡地獄', '蒸籠地獄', '銅柱地獄',
    '刀山地獄', '冰山地獄', '油鍋地獄', '牛坑地獄', '石壓地獄', '舂臼地獄',
    '血池地獄', '枉死地獄', '磔刑地獄', '火山地獄', '石磨地獄', '刀鋸地獄'];
  const SINS = ['驕傲', '嫉妒', '憤怒', '懶惰', '貪婪', '暴食', '色慾'];

  let root, stageEl, lineEl, nextEl, titleEl, srcEl, cv, g2d;
  let skipping = false, muted = false;
  let typingDone = null, clickWaiter = null;
  const timers = new Set();
  let audio = null;

  class SkipSignal extends Error {}

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => (n >= 0 ? '+' : '') + n;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- 外框與樣式 ----------
  function build() {
    const style = document.createElement('style');
    style.textContent = `
      #journey { position: fixed; inset: 0; z-index: 1000; background: #000; color: #f0ecf6;
        opacity: 0; pointer-events: none; transition: opacity .8s, background 1.6s; overflow: hidden;
        font-family: -apple-system, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", serif; cursor: pointer; user-select: none; }
      #journey.on { opacity: 1; pointer-events: auto; }
      #journey canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
      #journey .jstage { position: absolute; left: 0; right: 0; top: 56px; bottom: 150px; z-index: 1; }
      #journey .jlayer { position: absolute; inset: 0; opacity: 0; transition: opacity 1.2s; }
      #journey .jlayer.in { opacity: 1; }
      #journey .jlayer > svg { width: 100%; height: 100%; display: block; }
      #journey .jhead { position: absolute; top: 14px; left: 18px; z-index: 3; padding: 6px 14px; border-radius: 10px; background: rgba(6,4,10,.45); }
      #journey .jhead:has(.jtitle:empty) { display: none; }
      #journey .jtitle { font-size: 26px; letter-spacing: 8px; text-shadow: 0 0 12px rgba(0,0,0,.8); transition: opacity .8s; }
      #journey .jsrc { font-size: 12px; opacity: .6; margin-top: 2px; letter-spacing: 1px; }
      #journey .jtools { position: absolute; top: 16px; right: 16px; z-index: 4; display: flex; gap: 8px; }
      #journey .jtools button { background: rgba(0,0,0,.45); color: #eee; border: 1px solid rgba(255,255,255,.25);
        border-radius: 8px; padding: 6px 12px; font: inherit; font-size: 14px; cursor: pointer; }
      #journey .jtext { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 3;
        width: min(760px, calc(100% - 32px)); min-height: 96px; padding: 18px 24px 22px;
        background: rgba(6,4,10,.72); border: 1px solid rgba(255,255,255,.14); border-radius: 14px;
        font-size: 19px; line-height: 1.7; backdrop-filter: blur(4px); }
      #journey .jnext { position: absolute; right: 18px; bottom: 8px; font-size: 13px; opacity: .7; animation: jblink 1s infinite; }
      @keyframes jblink { 50% { opacity: .15; } }
      #journey.shake .jstage { animation: jshake .6s; }
      @keyframes jshake { 0%,100% { transform: none; } 20% { transform: translate(-10px, 6px); } 40% { transform: translate(9px, -7px); }
        60% { transform: translate(-6px, -4px); } 80% { transform: translate(5px, 5px); } }
      #journey .jbob { animation: jbob 3.2s ease-in-out infinite; }
      @keyframes jbob { 50% { transform: translateY(-8px); } }
      #journey .ecg { fill: none; stroke: #4dff7a; stroke-width: 3; stroke-dasharray: 1; stroke-dashoffset: 1;
        animation: jdraw 5.2s linear forwards; filter: drop-shadow(0 0 6px #4dff7a); }
      @keyframes jdraw { to { stroke-dashoffset: 0; } }
      #journey .jwalkin { animation: jwalkin 7s ease-in forwards; transform-box: view-box; transform-origin: 400px 330px; }
      @keyframes jwalkin { to { transform: translate(0, -60px) scale(.35); opacity: .2; } }
      #journey .jroadwalk { animation: jroadwalk 14s linear forwards; transform-box: view-box; transform-origin: 400px 500px; }
      @keyframes jroadwalk { from { transform: translate(0, 0) scale(1); } to { transform: translate(0, -230px) scale(.25); } }
      #journey .jrays { animation: jspin 60s linear infinite; transform-box: view-box; transform-origin: 400px -40px; }
      @keyframes jspin { to { transform: rotate(360deg); } }
      #journey .jdoorL, #journey .jdoorR { transition: transform 3s ease-in-out; transform-box: fill-box; }
      #journey .jdoorL { transform-origin: left center; } #journey .jdoorR { transform-origin: right center; }
      #journey .open .jdoorL, #journey .open .jdoorR { transform: scaleX(.06); }
      #journey .jrise { transition: transform 6s ease-out; transform-box: view-box; transform-origin: 400px 520px; }
      #journey .open .jrise { transform: translateY(-140px) scale(.7); }
      #journey .jfall { animation: jfall 5s ease-in forwards; transform-box: view-box; transform-origin: 400px 120px; }
      @keyframes jfall { to { transform: translateY(300px) scale(.15); opacity: 0; } }
      #journey .jwave { stroke-dasharray: 18 14; animation: jflow 3s linear infinite; }
      @keyframes jflow { to { stroke-dashoffset: -64; } }
      #journey .jsteam { animation: jsteam 3s ease-out infinite; opacity: 0; transform-box: fill-box; }
      @keyframes jsteam { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: .6; } 100% { opacity: 0; transform: translateY(-40px); } }
      #journey .jwindow { animation: jflicker 2.4s ease-in-out infinite; }
      @keyframes jflicker { 50% { opacity: .55; } }
      #journey .mirror-text { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
        justify-content: center; text-align: center; color: #0e1420; transition: opacity .4s; padding: 10px; box-sizing: border-box; }
      #journey .mirror-text .ms { font-size: 15px; opacity: .7; letter-spacing: 3px; }
      #journey .mirror-text .mc { font-size: 22px; font-weight: bold; margin: 8px 0; line-height: 1.4; }
      #journey .mirror-text .mk { font-size: 30px; font-weight: bold; }
      #journey .jstamp { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(3); opacity: 0;
        font-size: min(22vw, 140px); font-weight: 900; letter-spacing: .2em; transition: transform .5s cubic-bezier(.2,1.6,.4,1), opacity .3s;
        pointer-events: none; white-space: nowrap; }
      #journey .jstamp.show { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      #journey .jflame { animation: jflame .5s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center bottom; }
      @keyframes jflame { to { transform: scaleY(1.25) scaleX(.9); } }
      #journey .jbubble { animation: jbubble 1.8s ease-out infinite; transform-box: fill-box; opacity: 0; }
      @keyframes jbubble { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-34px); } }
      #journey .jchoices { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
      #journey .jchoices button { flex: 1 1 200px; padding: 12px 16px; font: inherit; font-size: 17px; color: #fff; cursor: pointer;
        background: rgba(90,75,138,.55); border: 1px solid rgba(200,180,255,.5); border-radius: 10px; }
      #journey .jchoices button:hover { background: rgba(120,100,180,.75); }
      #journey .ledger { color: #3a1a0a; font-size: 16px; height: 100%; overflow: hidden; }
      #journey .ledger .lt { text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 6px; padding-bottom: 8px; margin-bottom: 6px; border-bottom: 2px solid #8a6a3a; }
      #journey .ledger .lr { display: flex; justify-content: space-between; gap: 12px; padding: 7px 4px; border-bottom: 1px dashed #b8a070; animation: jrow .5s; }
      #journey .ledger .lr b, #journey .ledger .ls b { color: #a01010; }
      #journey .ledger .ls { margin-top: 14px; text-align: right; font-size: 20px; animation: jrow .5s; }
      @keyframes jrow { from { opacity: 0; transform: translateX(-10px); } }
      #journey .jsnipA, #journey .jsnipB { transform-box: view-box; transform-origin: 400px 260px; animation: jsnipA 1.2s ease-in-out infinite alternate; }
      #journey .jsnipB { animation-name: jsnipB; }
      @keyframes jsnipA { to { transform: rotate(-13deg); } }
      @keyframes jsnipB { to { transform: rotate(13deg); } }
      #journey .jpound { animation: jpound 1.1s ease-in infinite; }
      @keyframes jpound { 0%, 100% { transform: translateY(-60px); } 55% { transform: translateY(40px); } 65% { transform: translateY(32px); } }
      #journey .jsaw { animation: jsaw 1s ease-in-out infinite alternate; }
      @keyframes jsaw { from { transform: translateX(-50px); } to { transform: translateX(50px); } }
      #journey .ledger .lr i { font-style: normal; font-size: 13px; color: #7a3a1a; white-space: nowrap; margin-left: auto; }
      @media (max-width: 600px) {
        #journey .jtext { font-size: 16px; padding: 14px 16px 20px; min-height: 84px; bottom: 16px; }
        #journey .jstage { bottom: 130px; }
        #journey .jtitle { font-size: 20px; letter-spacing: 4px; }
      }`;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.id = 'journey';
    root.innerHTML = `
      <svg width="0" height="0" style="position:absolute"><defs>
        <filter id="jglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="jbigglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>
        <radialGradient id="jmirror" cx="45%" cy="40%" r="65%">
          <stop offset="0" stop-color="#eef4ff"/><stop offset=".6" stop-color="#b8c6dc"/><stop offset="1" stop-color="#7a889e"/></radialGradient>
        <linearGradient id="jroad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2a1a1e"/><stop offset="1" stop-color="#4a3a3a"/></linearGradient>
        <linearGradient id="jdoor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#e8dcc0"/></linearGradient>
        <linearGradient id="jmount" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#6a5a80"/><stop offset="1" stop-color="#2a2238"/></linearGradient>
        <radialGradient id="jgate" cx="50%" cy="60%" r="60%">
          <stop offset="0" stop-color="#5a1010"/><stop offset="1" stop-color="#050203"/></radialGradient>
      </defs></svg>
      <canvas></canvas>
      <div class="jstage"></div>
      <div class="jhead"><div class="jtitle"></div><div class="jsrc"></div></div>
      <div class="jtools"><button class="jmute">🔊 音效</button><button class="jskip">跳過 ⏭</button></div>
      <div class="jtext"><span class="jline"></span><span class="jnext">點一下繼續 ▼</span></div>`;
    document.body.appendChild(root);
    stageEl = root.querySelector('.jstage');
    lineEl = root.querySelector('.jline');
    nextEl = root.querySelector('.jnext');
    titleEl = root.querySelector('.jtitle');
    srcEl = root.querySelector('.jsrc');
    cv = root.querySelector('canvas');
    g2d = cv.getContext('2d');

    root.addEventListener('click', e => { if (!e.target.closest('.jtools')) advance(); });
    root.querySelector('.jskip').onclick = skip;
    const muteBtn = root.querySelector('.jmute');
    muteBtn.onclick = () => { muted = !muted; muteBtn.textContent = muted ? '🔇 靜音' : '🔊 音效'; };
    document.addEventListener('keydown', e => {
      if (!root.classList.contains('on')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
      if (e.key === 'Escape') skip();
    });
    window.addEventListener('resize', resize);
  }

  // ---------- 旁白控制 ----------
  function advance() {
    if (typingDone) typingDone();
    else if (clickWaiter) clickWaiter();
  }

  function skip() {
    skipping = true;
    if (typingDone) typingDone();
    if (clickWaiter) clickWaiter();
    timers.forEach(f => f());
  }

  function check() { if (skipping) throw new SkipSignal(); }

  /** 逐字顯示一句旁白 */
  async function type(text) {
    check();
    nextEl.style.visibility = 'hidden';
    await new Promise(res => {
      let i = 0;
      const finish = () => { clearInterval(t); lineEl.textContent = text; typingDone = null; res(); };
      typingDone = finish;
      lineEl.textContent = '';
      const t = setInterval(() => {
        i++;
        lineEl.textContent = text.slice(0, i);
        if (i >= text.length) finish();
      }, 42);
    });
    check();
  }

  /** 逐字顯示一句旁白，然後等玩家點一下 */
  async function say(text) {
    await type(text);
    nextEl.style.visibility = 'visible';
    await new Promise(res => { clickWaiter = () => { clickWaiter = null; res(); }; });
    check();
  }

  /** 問玩家一個問題，回傳選了第幾個選項 */
  async function ask(question, options) {
    await type(question);
    const box = document.createElement('div');
    box.className = 'jchoices';
    const idx = await new Promise(res => {
      const cancel = () => done(-1);
      const done = i => { timers.delete(cancel); res(i); };
      timers.add(cancel);
      options.forEach((text, i) => {
        const b = document.createElement('button');
        b.textContent = text;
        b.onclick = e => { e.stopPropagation(); done(i); };
        box.appendChild(b);
      });
      root.querySelector('.jtext').appendChild(box);
    });
    box.remove();
    check();
    return idx;
  }

  /** 顯示一句旁白，不等待 */
  function show(text) {
    lineEl.textContent = text;
    nextEl.style.visibility = 'hidden';
  }

  /** 等待一段時間；clickable 時點一下可以提早結束 */
  async function wait(ms, clickable = false) {
    check();
    await new Promise(res => {
      const done = () => { timers.delete(done); clearTimeout(t); if (clickWaiter === done) clickWaiter = null; res(); };
      const t = setTimeout(done, ms);
      timers.add(done);
      if (clickable) clickWaiter = done;
    });
    check();
  }

  /** 換場景：標題、出處、背景、粒子效果、圖畫 */
  function scene(title, source, bg, mode, svg) {
    titleEl.textContent = title;
    srcEl.textContent = source ? '取材：' + source : '';
    root.style.background = bg;
    setParticles(mode);
    const olds = [...stageEl.querySelectorAll('.jlayer')];
    const layer = document.createElement('div');
    layer.className = 'jlayer';
    layer.innerHTML = svg;
    stageEl.appendChild(layer);
    void layer.offsetWidth; // 先讓瀏覽器畫出透明狀態，淡入動畫才會生效
    layer.classList.add('in');
    for (const old of olds) { old.classList.remove('in'); setTimeout(() => old.remove(), 1300); }
    return layer;
  }

  function shake() {
    root.classList.remove('shake');
    void root.offsetWidth;
    root.classList.add('shake');
  }

  // ---------- 音效 ----------
  function tone(freq, dur, { type = 'sine', gain = 0.05, delay = 0, slide = 0 } = {}) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime + delay;
      const o = audio.createOscillator(), gn = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
      gn.gain.setValueAtTime(0, t0);
      gn.gain.linearRampToValueAtTime(gain, t0 + 0.02);
      gn.gain.setValueAtTime(gain, t0 + Math.max(0.03, dur - 0.3));
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gn).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch (e) { /* 沒有音效也能玩 */ }
  }
  const gong = () => { tone(110, 3, { gain: 0.12, slide: 0.9 }); tone(220, 2.4, { gain: 0.05, type: 'triangle' }); };
  const chime = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 2.2, { gain: 0.04, delay: i * 0.18, type: 'triangle' }));
  const rumble = () => tone(55, 2.5, { gain: 0.15, type: 'sawtooth', slide: 0.6 });

  // ---------- 粒子效果（霧、花瓣、火星、光點……） ----------
  let parts = [], pmode = 'none', raf = null, W = 0, H = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const R = (a, b) => a + Math.random() * (b - a);

  function spawn(init) {
    switch (pmode) {
      case 'fog': return { k: 'blob', x: init ? R(-200, W) : -250, y: R(H * .35, H), r: R(120, 260), vx: R(.15, .5), vy: 0, a: R(.03, .08), c: '190,200,220' };
      case 'mist': return { k: 'blob', x: init ? R(-200, W) : -250, y: R(H * .2, H), r: R(140, 280), vx: R(.1, .35), vy: 0, a: R(.04, .09), c: '210,190,230' };
      case 'petals': return { k: 'petal', x: R(-50, W), y: init ? R(0, H) : -20, vx: R(.3, 1), vy: R(.6, 1.5), r: R(4, 8), rot: R(0, 6), vr: R(-.04, .04), a: R(.6, .95), c: '210,30,45', sway: R(0, 6) };
      case 'embers': return { k: 'dot', x: R(0, W), y: init ? R(0, H) : H + 10, vx: R(-.4, .4), vy: -R(.8, 2.4), r: R(1, 3), a: R(.5, 1), c: Math.random() < .5 ? '255,140,40' : '255,80,30', sway: R(0, 6) };
      case 'light': return { k: 'dot', x: R(0, W), y: init ? R(0, H) : H + 10, vx: R(-.2, .2), vy: -R(.3, .9), r: R(1.5, 3.5), a: R(.4, .9), c: '255,240,190', sway: R(0, 6) };
      case 'feathers': return { k: 'feather', x: R(0, W), y: init ? R(0, H) : -20, vx: R(-.2, .3), vy: R(.3, .7), r: R(6, 11), rot: R(0, 6), vr: R(-.02, .02), a: R(.5, .9), c: '255,255,255', sway: R(0, 6) };
      case 'dust': return { k: 'dot', x: R(0, W), y: R(0, H), vx: R(-.15, .15), vy: R(-.15, .15), r: R(.6, 1.6), a: R(.2, .6), c: '220,230,255', sway: R(0, 6) };
      case 'snow': return { k: 'dot', x: R(0, W), y: init ? R(0, H) : -10, vx: R(-.3, .3), vy: R(.6, 1.6), r: R(1, 3), a: R(.5, .95), c: '235,245,255', sway: R(0, 6) };
      case 'blossom': return { k: 'petal', x: R(-50, W), y: init ? R(0, H) : -20, vx: R(-.3, .8), vy: R(.5, 1.2), r: R(4, 7), rot: R(0, 6), vr: R(-.04, .04), a: R(.6, .95), c: Math.random() < .5 ? '255,170,200' : '255,215,225', sway: R(0, 6) };
      case 'stars': return { k: 'star', x: R(0, W), y: R(0, H * .6), vx: 0, vy: 0, r: R(.5, 1.6), a: R(.3, 1), c: '255,255,255', sway: R(0, 6) };
    }
    return null;
  }

  const MAX = { fog: 18, mist: 22, petals: 70, embers: 110, light: 80, feathers: 26, dust: 60, stars: 120, snow: 110, blossom: 80 };

  function setParticles(mode) {
    pmode = mode;
    parts = [];
    if (mode === 'none') return;
    for (let i = 0; i < MAX[mode] * .8; i++) parts.push(spawn(true));
  }

  function frame(t) {
    g2d.clearRect(0, 0, W, H);
    if (pmode !== 'none' && parts.length < MAX[pmode] && Math.random() < .5) parts.push(spawn(false));
    parts = parts.filter(p => p && p.x > -320 && p.x < W + 320 && p.y > -40 && p.y < H + 40);
    for (const p of parts) {
      p.x += p.vx + (p.sway !== undefined && p.k !== 'star' ? Math.sin(t / 900 + p.sway) * .3 : 0);
      p.y += p.vy;
      if (p.vr) p.rot += p.vr;
      g2d.globalAlpha = p.k === 'star' ? p.a * (.5 + .5 * Math.sin(t / 500 + p.sway)) : p.a;
      if (p.k === 'blob') {
        const gr = g2d.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        gr.addColorStop(0, `rgba(${p.c},1)`);
        gr.addColorStop(1, `rgba(${p.c},0)`);
        g2d.fillStyle = gr;
        g2d.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else if (p.k === 'petal' || p.k === 'feather') {
        g2d.save();
        g2d.translate(p.x, p.y);
        g2d.rotate(p.rot);
        g2d.fillStyle = `rgb(${p.c})`;
        g2d.beginPath();
        g2d.ellipse(0, 0, p.r, p.k === 'feather' ? p.r * .3 : p.r * .45, 0, 0, Math.PI * 2);
        g2d.fill();
        g2d.restore();
      } else {
        g2d.fillStyle = `rgb(${p.c})`;
        g2d.shadowColor = `rgb(${p.c})`;
        g2d.shadowBlur = p.r * 4;
        g2d.beginPath();
        g2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g2d.fill();
        g2d.shadowBlur = 0;
      }
    }
    g2d.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  // ---------- 圖畫零件 ----------
  /** 玩家的靈魂（半透明的小幽靈） */
  function ghost(x, y, s = 1, tint = '220,235,255') {
    return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#jglow)"><g class="jbob">
      <circle cx="0" cy="-62" r="13" fill="rgba(${tint},.85)"/>
      <path d="M-14,-46 Q-22,-10 -24,22 Q-12,12 -6,24 Q0,12 6,24 Q12,12 24,22 Q22,-10 14,-46 Q0,-52 -14,-46Z" fill="rgba(${tint},.6)"/>
    </g></g>`;
  }

  /** 直書文字 */
  function vtext(x, y, text, size, fill, gap = size * 1.25) {
    return [...text].map((ch, i) =>
      `<text x="${x}" y="${y + i * gap}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${esc(ch)}</text>`).join('');
  }

  function lantern(x, y, color = '#ff5a2a', label = '') {
    return `<g><line x1="${x}" y1="${y - 30}" x2="${x}" y2="${y - 16}" stroke="#555" stroke-width="2"/>
      <ellipse cx="${x}" cy="${y}" rx="22" ry="20" fill="${color}" opacity=".5" filter="url(#jbigglow)"/>
      <ellipse cx="${x}" cy="${y}" rx="14" ry="17" fill="${color}"/>
      <rect x="${x - 9}" y="${y - 19}" width="18" height="4" fill="#3a2010"/><rect x="${x - 9}" y="${y + 15}" width="18" height="4" fill="#3a2010"/>
      ${label ? `<text x="${x}" y="${y + 1}" font-size="13" fill="#3a0a00" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${label}</text>` : ''}</g>`;
  }

  /** 黑白無常 */
  function wuchang(x, white, delay) {
    const robe = white ? '#e9ecef' : '#17181c', edge = white ? '#8a9399' : '#4a4d55';
    const face = white ? '#f2f1ea' : '#2e2e33', ink = white ? '#222' : '#ddd';
    return `<g class="jbob" style="animation-delay:${delay}s">
      <path d="M${x - 26},250 L${x - 66},470 L${x + 66},470 L${x + 26},250 Z" fill="${robe}" stroke="${edge}" stroke-width="2"/>
      <path d="M${x - 26},262 L${x - 70},360 L${x - 52},368 L${x - 20},300" fill="${robe}" stroke="${edge}" stroke-width="2"/>
      <path d="M${x + 26},262 L${x + 70},360 L${x + 52},368 L${x + 20},300" fill="${robe}" stroke="${edge}" stroke-width="2"/>
      <line x1="${x - 40}" y1="330" x2="${x + 40}" y2="330" stroke="${edge}" stroke-width="3"/>
      <ellipse cx="${x}" cy="230" rx="22" ry="25" fill="${face}" stroke="${edge}"/>
      <path d="M${x - 12},224 l8,3 M${x + 12},224 l-8,3" stroke="${white ? '#333' : '#f44'}" stroke-width="3"/>
      ${white ? `<path d="M${x - 4},242 Q${x - 3},280 ${x + 2},300 Q${x + 6},282 ${x + 5},242Z" fill="#c8323a"/>` : `<path d="M${x - 8},244 Q${x},240 ${x + 8},244" stroke="#888" stroke-width="2" fill="none"/>`}
      <path d="M${x - 15},110 L${x + 15},110 L${x + 30},210 L${x - 30},210 Z" fill="${robe}" stroke="${edge}" stroke-width="2"/>
      ${vtext(x, 132, white ? '一見生財' : '天下太平', 15, ink, 19)}
      ${white
        ? `<line x1="${x + 62}" y1="360" x2="${x + 92}" y2="470" stroke="#ccc" stroke-width="5"/>
           <path d="M${x + 62},360 l-8,22 M${x + 66},362 l2,24 M${x + 70},360 l10,20" stroke="#fff" stroke-width="3"/>`
        : `<path d="M${x - 62},362 Q${x - 140},420 ${x - 230},380" stroke="#8a8a8a" stroke-width="4" stroke-dasharray="7 4" fill="none"/>`}
    </g>`;
  }

  function spiderLily(x, y, s) {
    let p = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})">
      <line x1="0" y1="0" x2="0" y2="-26" stroke="#2f4a22" stroke-width="2"/>`;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.45;
      const ex = Math.cos(a) * 17, ey = -26 + Math.sin(a) * 15;
      p += `<path d="M0,-26 Q${(ex * .5).toFixed(1)},${(ey - 12).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" stroke="#d81830" stroke-width="2.2" fill="none"/>`;
    }
    return p + '<circle cy="-26" r="3" fill="#ff3a4a"/></g>';
  }

  // ---------- 各幕 ----------
  async function sDeath(d) {
    scene('', '', '#000', 'none', `<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
      <polyline class="ecg" pathLength="1" points="0,150 110,150 125,150 140,95 152,205 165,150 270,150 285,150 300,90 312,210 325,150 425,150 440,150 450,130 460,165 470,150 800,150"/></svg>`);
    [0.95, 1.95, 2.9].forEach(t => tone(1000, 0.14, { delay: t, gain: 0.04 }));
    tone(1000, 2.6, { delay: 3.4, gain: 0.04 });
    await wait(700);
    await say('嗶……嗶……嗶……');
    await say('嗶——————————');
    await say(`${d.age} 歲的你，聽見家人在床邊呼喚你的名字。`);
    await say('聲音越來越遠，眼前越來越暗……');
  }

  async function sWuchang(d) {
    scene('黑白無常', '民間信仰・勾魂使者', 'radial-gradient(ellipse at 50% 85%, #1e2433, #05060a 70%)', 'fog',
      `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMax meet">
        ${ghost(130, 420, 1)}
        ${wuchang(330, true, 0)}${wuchang(520, false, 1.2)}
        ${lantern(250, 330, '#e8f0ff', '冥')}${lantern(610, 330, '#7aa8ff', '冥')}
        <ellipse cx="400" cy="480" rx="420" ry="30" fill="rgba(180,190,210,.12)"/>
      </svg>`);
    await say('再睜開眼時，你飄在半空中，低頭看見躺在床上的自己。');
    tone(180, 1.2, { type: 'square', gain: 0.02, slide: 0.7 });
    await say('霧裡傳來鐵鍊拖在地上的聲音……');
    await say('兩道身影從霧中走出，一白一黑，戴著高高的帽子。');
    await say('白無常的帽子寫著「一見生財」，黑無常的寫著「天下太平」。');
    await say(`「${d.name}，陽壽已盡，跟我們走吧。」`);
  }

  async function sGate() {
    const layer = scene('鬼門關', '民間傳說', 'linear-gradient(#0a0507, #1c0b0e 60%, #0b0405)', 'fog',
      `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMax meet">
        <rect x="270" y="175" width="260" height="300" fill="url(#jgate)"/>
        <rect x="228" y="165" width="44" height="310" fill="#2a1416" stroke="#6a3a2a" stroke-width="2"/>
        <rect x="528" y="165" width="44" height="310" fill="#2a1416" stroke="#6a3a2a" stroke-width="2"/>
        ${vtext(250, 205, '善惡到頭終有報', 18, '#d8b060', 34)}
        ${vtext(550, 205, '只爭來早與來遲', 18, '#d8b060', 34)}
        <path d="M130,170 Q250,150 400,92 Q550,150 670,170 L640,184 L160,184 Z" fill="#1c1012" stroke="#7a4030" stroke-width="2"/>
        <path d="M190,120 Q300,110 400,70 Q500,110 610,120 L590,132 L210,132 Z" fill="#1c1012" stroke="#7a4030" stroke-width="2"/>
        <rect x="330" y="128" width="140" height="44" fill="#3a0c0c" stroke="#c9a040" stroke-width="2"/>
        <text x="400" y="151" font-size="26" fill="#e8c070" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="6">鬼門關</text>
        ${lantern(195, 230, '#ff3a2a')}${lantern(605, 230, '#ff3a2a')}
        <g class="jwalkin">${ghost(400, 470, 1.4)}</g>
      </svg>`);
    await say('你跟著黑白無常，來到一座巨大的城門前。');
    await say('城門上寫著三個字——鬼門關。');
    await say('兩旁的柱子刻著：「善惡到頭終有報，只爭來早與來遲。」');
    rumble();
    shake();
    await say('你一跨過門檻，身後的大門就「轟」的一聲關上了。');
    return layer;
  }

  async function sRoad() {
    const flowers = [];
    for (let i = 0; i < 80; i++) {
      const t = Math.random();
      const y = 232 + t * t * 268;
      const half = 10 + (y - 220) / 280 * 200;
      const side = i % 2 ? 1 : -1;
      flowers.push({ y, html: spiderLily(400 + side * (half + 8 + Math.random() * (40 + t * 220)), y, 0.25 + t * 1.1) });
    }
    flowers.sort((a, b) => a.y - b.y);
    scene('黃泉路', '民間傳說・彼岸花', 'linear-gradient(#14070d, #2a0a10 55%, #120507)', 'petals',
      `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMax meet">
        <circle cx="620" cy="90" r="46" fill="#a02020" opacity=".55" filter="url(#jbigglow)"/>
        <circle cx="620" cy="90" r="34" fill="#c84040" opacity=".7"/>
        <rect x="0" y="220" width="800" height="280" fill="#160709"/>
        <polygon points="390,220 410,220 610,500 190,500" fill="url(#jroad)"/>
        ${flowers.map(f => f.html).join('')}
        <g class="jroadwalk">${ghost(400, 500, 1.2)}</g>
      </svg>`);
    await say('過了鬼門關，眼前是一條看不見盡頭的路——黃泉路。');
    await say('路的兩旁，開滿了血紅色的彼岸花。');
    await say('傳說彼岸花「花開不見葉，葉生不見花」，就像生與死，永遠不會相見。');
    await say('你走著走著，這一生的記憶，開始一點一點浮上來……');
  }

  async function sHome(d) {
    const sorted = [...d.history].sort((a, b) => b.karma - a.karma);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    let houses = '';
    for (let i = 0; i < 9; i++) {
      const x = 470 + i * 38, h = 30 + (i * 37 % 40);
      houses += `<rect x="${x}" y="${470 - h}" width="32" height="${h}" fill="#0c0c18"/>
        <polygon points="${x - 3},${470 - h} ${x + 16},${452 - h} ${x + 35},${470 - h}" fill="#0c0c18"/>`;
      if (i % 3 === 1) houses += `<rect x="${x + 11}" y="${480 - h}" width="10" height="9" fill="#ffcf70" opacity=".8"/>`;
    }
    houses += `<rect class="jwindow" x="${470 + 4 * 38 + 11}" y="${480 - 63}" width="10" height="9" fill="#ffd27a" filter="url(#jglow)"/>`;
    scene('望鄉台', '《玉曆寶鈔》', 'linear-gradient(#070b1e, #191634 70%, #0a0a14)', 'stars',
      `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMax meet">
        <circle cx="660" cy="80" r="30" fill="#f2ecd0" filter="url(#jglow)"/>
        ${houses}
        <rect x="0" y="470" width="800" height="30" fill="#08080f"/>
        <rect x="90" y="400" width="300" height="100" fill="#2a2a38" stroke="#4a4a5a"/>
        <rect x="120" y="330" width="240" height="72" fill="#30303f" stroke="#4a4a5a"/>
        <rect x="150" y="270" width="180" height="62" fill="#383848" stroke="#5a5a6a"/>
        <rect x="190" y="418" width="100" height="40" fill="#1a1a24" stroke="#c9a040"/>
        <text x="240" y="439" font-size="22" fill="#e8c070" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="3">望鄉台</text>
        ${ghost(260, 270, 1)}
      </svg>`);
    await say('黃泉路的盡頭有一座高台，叫做望鄉台。');
    await say('這是亡魂最後一次回頭望向人間的地方。');
    await say('遠方，有一扇窗戶還亮著燈。那是你的家。');
    if (best && best.karma > 0) {
      await say(`你想起${best.stage}的時候，你選擇了「${best.choice}」。`);
      await say('想到這裡，你的心裡暖暖的。');
    }
    if (worst && worst.karma < 0) {
      await say(`你也想起${worst.stage}的時候，你選擇了「${worst.choice}」。`);
      await say('你別過頭，不敢再看下去。');
    } else {
      await say('回頭看這一生，你沒有什麼好後悔的。');
    }
  }

  async function sMirror(d) {
    const layer = scene('孽鏡台', '《玉曆寶鈔》第一殿', 'radial-gradient(circle at 50% 42%, #1c2234, #050508 70%)', 'dust',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">
        <rect x="330" y="420" width="140" height="22" fill="#5a4220"/>
        <rect x="290" y="440" width="220" height="30" fill="#4a3418"/>
        <rect x="385" y="400" width="30" height="24" fill="#6a4c24"/>
        <circle class="mring" cx="400" cy="240" r="190" fill="none" stroke="#c9a040" stroke-width="6" opacity=".25" filter="url(#jbigglow)" style="transition: stroke .4s, opacity .4s"/>
        <circle cx="400" cy="240" r="170" fill="url(#jmirror)" stroke="#a07a30" stroke-width="18"/>
        <circle cx="400" cy="240" r="180" fill="none" stroke="#6a4c1c" stroke-width="3"/>
        ${[0, 60, 120, 180, 240, 300].map(a => {
          const r = a * Math.PI / 180;
          return `<circle cx="${400 + Math.cos(r) * 170}" cy="${240 + Math.sin(r) * 170}" r="7" fill="#e0b860"/>`;
        }).join('')}
        <rect x="320" y="12" width="160" height="40" fill="#2a1a0a" stroke="#c9a040" stroke-width="2"/>
        <text x="400" y="33" font-size="22" fill="#e8c070" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="6">孽鏡台</text>
        <foreignObject x="270" y="120" width="260" height="240"><div xmlns="http://www.w3.org/1999/xhtml" class="mirror-text"></div></foreignObject>
      </svg>`);
    const box = layer.querySelector('.mirror-text');
    const ring = layer.querySelector('.mring');
    await say('殿前立著一面巨大的銅鏡，鏡框上刻著五個字：');
    await say('「孽鏡台前無好人」。');
    await say('這面鏡子會照出你一生做過的每一件事，誰也騙不了它。');
    show('鏡子亮了起來……（點一下可以加快）');
    for (const h of d.history) {
      const col = h.karma > 0 ? '#f2c94c' : h.karma < 0 ? '#ff3a2a' : '#aab';
      box.style.opacity = 0;
      await wait(250);
      box.innerHTML = `<div class="ms">${esc(h.stage)}</div><div class="mc">${esc(h.choice)}</div>
        <div class="mk" style="color:${h.karma > 0 ? '#9a6a00' : h.karma < 0 ? '#b01010' : '#556'}">${fmt(h.karma)}</div>`;
      box.style.opacity = 1;
      ring.style.stroke = col;
      ring.style.opacity = .9;
      tone(h.karma >= 0 ? 660 : 160, 0.5, { gain: 0.03, type: h.karma >= 0 ? 'sine' : 'sawtooth' });
      await wait(1900, true);
      ring.style.opacity = .25;
    }
    box.style.opacity = 0;
    await wait(300);
    box.innerHTML = `<div class="ms">一生業力總和</div><div class="mk" style="font-size:44px;color:${d.karma >= 0 ? '#9a6a00' : '#b01010'}">${fmt(d.karma)}</div>`;
    box.style.opacity = 1;
    await say('鏡中的畫面漸漸淡去。你這一生，已經全部被記錄下來了。');
  }

  async function sJudge(d) {
    const layer = scene('閻羅殿', '民間信仰・閻羅王 ＋ 古埃及《亡者之書》秤心儀式', 'linear-gradient(#170404, #2c0a08 60%, #0c0303)', 'embers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <rect x="40" y="0" width="54" height="520" fill="#5a0e0e"/><rect x="706" y="0" width="54" height="520" fill="#5a0e0e"/>
        <rect x="36" y="60" width="62" height="10" fill="#c9a040"/><rect x="702" y="60" width="62" height="10" fill="#c9a040"/>
        <rect x="300" y="6" width="200" height="40" fill="#2a0808" stroke="#c9a040" stroke-width="2"/>
        <text x="400" y="27" font-size="22" fill="#e8c070" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="6">閻羅殿</text>
        <path d="M290,260 Q290,165 400,152 Q510,165 510,260 Z" fill="#4a0c0c" stroke="#8a2a1a"/>
        <ellipse cx="400" cy="125" rx="34" ry="38" fill="#6a2a1a"/>
        <path d="M368,132 Q400,215 432,132 Q400,152 368,132Z" fill="#0c0c0c"/>
        <ellipse cx="386" cy="118" rx="6" ry="3" fill="#ffcc55" filter="url(#jglow)"/>
        <ellipse cx="414" cy="118" rx="6" ry="3" fill="#ffcc55" filter="url(#jglow)"/>
        <path d="M364,96 Q364,66 400,62 Q436,66 436,96 Z" fill="#111"/>
        <rect x="296" y="84" width="68" height="9" rx="4" fill="#111"/><rect x="436" y="84" width="68" height="9" rx="4" fill="#111"/>
        <rect x="210" y="250" width="380" height="64" fill="#4a1010" stroke="#c9a040" stroke-width="2"/>
        <rect x="222" y="262" width="356" height="40" fill="none" stroke="#c9a040" stroke-width="1" opacity=".6"/>
        <path d="M330,250 L398,240 L398,252 Z M402,240 L470,250 L402,252 Z" fill="#e8dcc0" stroke="#8a7a50"/>
        <text x="400" y="284" font-size="16" fill="#e8c070" text-anchor="middle" dominant-baseline="middle" letter-spacing="4">生死簿</text>
        <polygon points="400,500 360,512 440,512" fill="#c9a040"/>
        <line x1="400" y1="340" x2="400" y2="505" stroke="#c9a040" stroke-width="6"/>
        <circle cx="400" cy="338" r="8" fill="#e8c070"/>
        <g class="jbeam" transform="translate(400 340)"><line x1="-140" y1="0" x2="140" y2="0" stroke="#e8c070" stroke-width="6" stroke-linecap="round"/></g>
        <g class="jpanL"><line x1="0" y1="0" x2="-38" y2="72" stroke="#c9a040" stroke-width="2"/><line x1="0" y1="0" x2="38" y2="72" stroke="#c9a040" stroke-width="2"/>
          <ellipse cx="0" cy="74" rx="46" ry="9" fill="#c9a040"/>
          <path d="M0,68 C-18,54 -22,42 -12,36 C-6,32 0,36 0,42 C0,36 6,32 12,36 C22,42 18,54 0,68Z" fill="#c0202a" filter="url(#jglow)"/></g>
        <g class="jpanR"><line x1="0" y1="0" x2="-38" y2="72" stroke="#c9a040" stroke-width="2"/><line x1="0" y1="0" x2="38" y2="72" stroke="#c9a040" stroke-width="2"/>
          <ellipse cx="0" cy="74" rx="46" ry="9" fill="#c9a040"/>
          <g transform="translate(0 56) rotate(-20)"><ellipse rx="26" ry="7" fill="#f4f4f4"/><line x1="-30" y1="0" x2="26" y2="0" stroke="#aaa" stroke-width="1.5"/></g></g>
      </svg>`);
    const beam = layer.querySelector('.jbeam'), panL = layer.querySelector('.jpanL'), panR = layer.querySelector('.jpanR');
    const setAngle = deg => {
      const r = deg * Math.PI / 180, c = Math.cos(r) * 140, s = Math.sin(r) * 140;
      beam.setAttribute('transform', `translate(400 340) rotate(${deg})`);
      panL.setAttribute('transform', `translate(${400 - c} ${340 - s})`);
      panR.setAttribute('transform', `translate(${400 + c} ${340 + s})`);
    };
    setAngle(0);
    gong();
    await say('最後，你被帶到了閻羅殿。');
    await say('閻羅王坐在大殿正中。判官翻開生死簿，找到了你的名字。');
    await say('你的心被放上天秤，另一端，是一根羽毛。');
    await say('古埃及人相信：心比羽毛還重的人，生前犯下了太多罪。');
    show('天秤慢慢傾斜……');
    // 業力越高，心越輕（左邊往上）
    const target = clamp(d.karma / 5, -24, 24);
    const start = performance.now(), dur = 3600;
    await new Promise(res => {
      const step = now => {
        const t = Math.min(1, (now - start) / dur);
        const wobble = Math.sin(t * 14) * 10 * (1 - t);
        setAngle(target * (1 - Math.pow(1 - t, 3)) + wobble);
        if (t < 1 && !skipping) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    check();
    const stamp = document.createElement('div');
    stamp.className = 'jstamp';
    stamp.textContent = REALM_NAME[d.realm];
    stamp.style.color = REALM_COLOR[d.realm];
    stamp.style.textShadow = `0 0 40px ${REALM_COLOR[d.realm]}`;
    layer.appendChild(stamp);
    await wait(200);
    stamp.classList.add('show');
    gong();
    shake();
    await wait(1200);
    await say(`閻羅王拍下驚堂木：「${d.name}，業力 ${fmt(d.karma)}。${d.verdict}」`);
  }

  // ---------- 死後世界的共用工具 ----------
  const HELL_DESC = [
    '生前搬弄是非、說謊騙人、出口傷人的人，會在這裡被小鬼用鐵鉗拔出舌頭。',
    '剪斷別人希望、拆散他人緣分的人，會在這裡被巨大的剪刀剪去手指。',
    '挑撥離間、背叛親友的人，會被吊在長滿利刃的鐵樹上。',
    '做了壞事卻想瞞天過海的人，會被帶到孽鏡前，照出自己醜陋的原形。',
    '造謠生事、散播是非的人，會被放進蒸籠裡，日夜受熱氣蒸烤。',
    '毀人家園、逼人無處容身的人，會被綁在燒得通紅的銅柱上。',
    '殺害生命、欺凌弱小的人，要赤著腳爬上插滿刀刃的山。',
    '冷漠無情、見死不救的人，會被丟上冰山，永遠感覺不到溫暖。',
    '偷盜搶劫、詐騙他人的人，會被丟進滾燙的油鍋裡。',
    '虐待動物的人，會被丟進牛坑，讓牛群反覆踐踏。',
    '傷害孩子、拋棄骨肉的人，會被巨大的石頭壓住，動彈不得。',
    '浪費糧食、只顧自己享樂的人，會被放進石臼裡舂打。',
    '不孝不敬、讓父母傷心的人，會被丟進翻滾的血池。',
    '害人枉死的人，會被關進枉死城，和那些冤魂一起日夜徘徊。',
    '褻瀆亡者、趁火打劫的人，會被綁在木架上受磔刑。',
    '貪贓枉法、害人性命的人，會被推進噴發的火山。',
    '貪官污吏、見錢眼開的人，會被放進石磨裡磨。',
    '作惡多端、罪大惡極的人，會在最底層受刀鋸之刑。'
  ];

  // 依選項文字判斷這件壞事屬於哪一層地獄（由上往下比對，第一個符合的就是）
  const SIN_RULES = [
    [10, /牠|動物/],
    [15, /遺物|趁亂/],
    [18, /翻他的錢包/],
    [16, /排放/],
    [4, /不說|保守秘密|模仿|傳給|抄下來還/],
    [17, /收錢|月餅|內線|大筆買進|囤積|高價|^收下$|佣金/],
    [2, /拿錢叫他離開|嘲笑/],
    [5, /散布|分享|轉傳|拍影片|閒話/],
    [11, /趕出家門|威脅|哭著跑走|孩子/],
    [6, /房東|租她|放火/],
    [1, /說|騙|謊|嫁禍|罵|羞辱|學他講話|大吼|恨|怪老頭|指責/],
    [13, /不聞不問|兄弟|爸|媽|父|母|奶奶|阿公|家人|很少聯絡|生日派對/],
    [3, /瞞著|交往|過戶|討好|站在兒子|背叛/],
    [14, /舊的不管|走過|放門口|照做|轉院|裁掉|抗議/],
    [9, /偷|錢包|拿走|抽走|口袋|收起來|賣掉|轉一點|留一包|默默收下|拿去買|作品集|分你一半/],
    [4, /假裝|藏起來|領獎|業配|沉默|秘密|跑掉|已讀/],
    [7, /打他|欺負|一起笑|騎走|瀉藥|一起去|丟/],
    [12, /享樂|花光|零食|吃掉|試一根|賭/],
    [8, /不去|不回|自己先|不關我的事|不管|不想惹麻煩|離開|開走|留下來養/]
  ];
  function sinLevel(h) {
    for (const [lv, re] of SIN_RULES) if (re.test(h.choice)) return lv;
    return h.karma <= -25 ? 18 : h.karma <= -10 ? 7 : 8;
  }

  const goodDeeds = d => d.history.filter(h => h.karma > 0);
  const badDeeds = d => d.history.filter(h => h.karma < 0);
  // 和模擬器的規則一致：地獄每天平均贖罪 3 點，煉獄每天平均淨增 1.75 點
  const hellDays = karma => Math.max(1, Math.ceil((-50 - karma) / 3));
  const purgDays = karma => Math.max(1, Math.ceil((50 - karma) / 1.75));
  const hellDepth = karma => clamp(Math.ceil((-karma - 50) / 10) + 1, 1, 18);

  /** 用 requestAnimationFrame 跑一段 0→1 的動畫 */
  async function animate(ms, onStep) {
    const start = performance.now();
    await new Promise(res => {
      const step = now => {
        const t = Math.min(1, (now - start) / ms);
        onStep(t);
        if (t < 1 && !skipping) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    check();
  }

  function funnelRings() {
    let rings = '';
    for (let i = 0; i < 9; i++) {
      const t = i / 8, y = 150 + t * 290, rx = 380 * (1 - t) + 34 * t, ry = 64 * (1 - t) + 8 * t;
      rings += `<ellipse cx="400" cy="${y}" rx="${rx}" ry="${ry}" fill="rgba(25,2,2,.55)" stroke="rgb(255,${Math.round(150 - t * 90)},40)" stroke-opacity="${.3 + t * .6}" stroke-width="${2 + t * 2}"/>`;
    }
    return rings + '<ellipse cx="400" cy="446" rx="70" ry="24" fill="#ff6a20" filter="url(#jbigglow)"/>';
  }

  function cloudBank(y = 430, color = '#fffaf0') {
    let c = '';
    for (let i = 0; i < 22; i++) c += `<circle cx="${(i * 41) % 820 - 10}" cy="${y + (i * 17 % 50)}" r="${50 + (i * 23 % 40)}" fill="${color}" opacity=".95"/>`;
    return c;
  }

  /** 仙鶴 */
  function crane(x, y, s = 1, delay = 0) {
    return `<g transform="translate(${x} ${y}) scale(${s})"><g class="jbob" style="animation-delay:${delay}s">
      <path d="M-30,0 Q0,-14 34,-4 Q8,6 -30,0Z" fill="#fff"/>
      <path d="M30,-4 Q52,-24 60,-34" stroke="#fff" stroke-width="4" fill="none"/>
      <circle cx="61" cy="-35" r="5" fill="#fff"/><circle cx="62" cy="-39" r="3" fill="#e0302a"/>
      <path d="M65,-35 l14,3" stroke="#d8b860" stroke-width="2"/>
      <path d="M-8,-4 Q-20,-46 -48,-58 Q-26,-30 -14,-2Z" fill="#fff"/><path d="M-44,-56 l-6,-4" stroke="#222" stroke-width="5"/>
      <path d="M-30,0 l-26,10" stroke="#ddd" stroke-width="3"/>
    </g></g>`;
  }

  /** 小鬼 */
  function imp(x, y, s = 1, color = '#3a5a9a', flip = false) {
    return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><g class="jbob" style="animation-delay:${(x % 9) / 5}s">
      <path d="M-20,0 L-24,-48 Q0,-60 24,-48 L20,0Z" fill="${color}"/>
      <circle cx="0" cy="-68" r="18" fill="${color}"/>
      <path d="M-12,-80 l-6,-16 l12,8Z M12,-80 l6,-16 l-12,8Z" fill="#e8d8b0"/>
      <circle cx="-6" cy="-70" r="3" fill="#ffdd33"/><circle cx="6" cy="-70" r="3" fill="#ffdd33"/>
      <path d="M-7,-60 q7,5 14,0" stroke="#111" stroke-width="2" fill="none"/>
      <path d="M-22,-40 L-34,-20 M22,-40 L36,-28" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
    </g></g>`;
  }

  /** 牛頭馬面 */
  function guards() {
    const trident = x => `<line x1="${x}" y1="250" x2="${x}" y2="475" stroke="#777" stroke-width="5"/>
      <path d="M${x - 18},226 L${x - 18},250 L${x + 18},250 L${x + 18},226 M${x},250 L${x},216" stroke="#9a9a9a" stroke-width="5" fill="none"/>`;
    const body = x => `<path d="M${x - 30},330 L${x - 54},475 L${x + 54},475 L${x + 30},330 Z" fill="#1c0c0c" stroke="#5a1a1a" stroke-width="2"/>`;
    return `<g class="jbob">${body(80)}
        <path d="M56,292 Q28,282 34,254 Q48,276 62,284Z M104,292 Q132,282 126,254 Q112,276 98,284Z" fill="#d8d0b8"/>
        <ellipse cx="80" cy="305" rx="28" ry="26" fill="#3a2418"/>
        <ellipse cx="80" cy="320" rx="16" ry="11" fill="#5a3a28"/>
        <circle cx="70" cy="300" r="3.5" fill="#ff4a2a"/><circle cx="90" cy="300" r="3.5" fill="#ff4a2a"/>
        ${trident(132)}
      </g>
      <g class="jbob" style="animation-delay:1.1s">${body(720)}
        <path d="M708,270 l-6,-22 l14,12Z M728,266 l4,-22 l8,16Z" fill="#2a1a12"/>
        <ellipse cx="722" cy="302" rx="18" ry="38" fill="#2a1a12" transform="rotate(18 722 302)"/>
        <path d="M710,274 Q692,302 704,334" stroke="#0c0c0c" stroke-width="7" fill="none"/>
        <circle cx="718" cy="290" r="3.5" fill="#ff4a2a"/>
        ${trident(668)}
      </g>`;
  }

  const SINNER = '255,210,200';
  const sinners = (pts, tint = SINNER) => pts.map(([x, y, s]) => ghost(x, y, s, tint)).join('');
  const flames = (x0, n, gap, y = 510) => Array.from({ length: n }, (_, i) => {
    const x = x0 + i * gap;
    return `<path class="jflame" style="animation-delay:${i * .13}s" d="M${x - 18},${y} Q${x - 10},${y - 40} ${x},${y - 74} Q${x + 10},${y - 40} ${x + 18},${y}Z" fill="${i % 2 ? '#ff5a1a' : '#ffb030'}"/>`;
  }).join('');

  // ---------- 十八層地獄，每一層的畫面 ----------
  const HELL_ART = {
    1: () => `${ghost(290, 450, 1.25, SINNER)}
      <path class="jtongue" d="M296,372 Q420,440 520,350" stroke="#d0304a" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M512,340 l26,-8 M512,358 l26,6" stroke="#aaa" stroke-width="5" stroke-linecap="round"/>
      ${imp(575, 455, 1.4, '#3a5a9a', true)}${imp(200, 470, .9, '#5a3a8a')}`,
    2: () => `<path d="M220,170 Q400,150 580,170" stroke="#d0304a" stroke-width="3" fill="none" stroke-dasharray="14 10"/>
      <g class="jsnipA"><polygon points="400,260 600,180 610,196" fill="#c8ced8" stroke="#6a727e" stroke-width="2"/>
        <line x1="400" y1="260" x2="300" y2="360" stroke="#444" stroke-width="12"/><circle cx="286" cy="378" r="26" fill="none" stroke="#333" stroke-width="10"/></g>
      <g class="jsnipB"><polygon points="400,260 600,340 610,324" fill="#c8ced8" stroke="#6a727e" stroke-width="2"/>
        <line x1="400" y1="260" x2="300" y2="160" stroke="#444" stroke-width="12"/><circle cx="286" cy="142" r="26" fill="none" stroke="#333" stroke-width="10"/></g>
      <circle cx="400" cy="260" r="10" fill="#888"/>
      ${sinners([[480, 470, .8], [560, 480, .7], [620, 470, .75]])}${imp(230, 470, 1.1, '#2a6a5a')}`,
    3: () => {
      let b = '';
      const branches = [[400, 330, 250, 250], [400, 300, 560, 220], [400, 250, 280, 170], [400, 220, 520, 140]];
      for (const [x1, y1, x2, y2] of branches) {
        b += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a3a40" stroke-width="12" stroke-linecap="round"/>`;
        for (let k = 1; k < 6; k++) {
          const x = x1 + (x2 - x1) * k / 6, y = y1 + (y2 - y1) * k / 6;
          b += `<polygon points="${x - 4},${y} ${x},${y - 18} ${x + 4},${y}" fill="#d8dee8"/><polygon points="${x - 4},${y} ${x},${y + 16} ${x + 4},${y}" fill="#b8c0cc"/>`;
        }
      }
      const hang = [[300, 262], [480, 254], [330, 188], [470, 170]].map(([x, y]) =>
        `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 50}" stroke="#8a7a5a" stroke-width="2"/>${ghost(x, y + 120, .6, SINNER)}`).join('');
      return `<path d="M380,480 L392,200 L408,200 L420,480Z" fill="#2a2a30"/>${b}${hang}`;
    },
    4: () => `<rect x="380" y="400" width="40" height="80" fill="#5a4220"/>
      <circle cx="400" cy="250" r="160" fill="url(#jmirror)" stroke="#a07a30" stroke-width="16"/>
      <g opacity=".9"><circle cx="400" cy="200" r="34" fill="#4a0a0a"/>
        <path d="M378,176 l-10,-30 l20,18Z M422,176 l10,-30 l-20,18Z" fill="#4a0a0a"/>
        <path d="M360,232 Q330,320 330,380 L470,380 Q470,320 440,232 Q400,220 360,232Z" fill="#4a0a0a"/>
        <circle cx="388" cy="198" r="5" fill="#ff3a2a"/><circle cx="412" cy="198" r="5" fill="#ff3a2a"/></g>
      <rect x="330" y="60" width="140" height="36" fill="#2a1a0a" stroke="#c9a040" stroke-width="2"/>
      <text x="400" y="79" font-size="20" fill="#e8c070" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="6">孽鏡台</text>
      ${ghost(400, 500, 1.3, SINNER)}`,
    5: () => {
      let st = '';
      for (let i = 0; i < 3; i++) {
        const y = 400 - i * 70;
        st += `<rect x="290" y="${y - 60}" width="220" height="60" fill="#c8a060" stroke="#8a6a30" stroke-width="3"/>
          <line x1="290" y1="${y - 40}" x2="510" y2="${y - 40}" stroke="#a88040" stroke-width="2"/><line x1="290" y1="${y - 20}" x2="510" y2="${y - 20}" stroke="#a88040" stroke-width="2"/>
          <ellipse cx="400" cy="${y}" rx="110" ry="14" fill="#b89050"/>`;
      }
      const steam = [330, 370, 410, 450].map((x, i) => `<path class="jsteam" style="animation-delay:${i * .6}s" d="M${x},180 q-10,-20 0,-40 q10,-20 0,-40" stroke="rgba(255,255,255,.8)" stroke-width="5" fill="none"/>`).join('');
      return `<rect x="270" y="400" width="260" height="80" fill="#3a2a22"/>${flames(300, 6, 40, 440)}${st}
        <ellipse cx="400" cy="200" rx="116" ry="18" fill="#d8b070" stroke="#8a6a30" stroke-width="3" transform="rotate(-6 400 200)"/>
        ${[350, 400, 450].map(x => `<circle cx="${x}" cy="206" r="12" fill="rgba(255,220,210,.9)"/>`).join('')}${steam}`;
    },
    6: () => `<defs><linearGradient id="jcopper" x1="0" x2="1"><stop offset="0" stop-color="#8a2a10"/><stop offset=".5" stop-color="#ff8a3a"/><stop offset="1" stop-color="#8a2a10"/></linearGradient></defs>
      ${flames(330, 4, 46, 500)}
      <rect x="360" y="110" width="80" height="370" rx="10" fill="url(#jcopper)" filter="url(#jglow)"/>
      ${ghost(400, 380, 1.1, SINNER)}
      ${[290, 330, 370].map(y => `<path d="M352,${y} Q400,${y + 18} 448,${y}" stroke="#555" stroke-width="5" stroke-dasharray="8 4" fill="none"/>`).join('')}`,
    7: () => {
      const blades = [];
      for (let i = 0; i < 80; i++) {
        const t = ((i * 37) % 100) / 100, y = 175 + t * 300, half = (y - 140) * .78;
        const x = 400 + (((i * 53) % 100) / 50 - 1) * half;
        blades.push({ y, s: `<polygon points="${x - 5},${y} ${x},${y - 26} ${x + 5},${y}" fill="#d8dee8" stroke="#8a929e" stroke-width="1"/>` });
      }
      blades.sort((a, b) => a.y - b.y);
      return `<polygon points="400,140 680,485 120,485" fill="#2c1212"/>${blades.map(b => b.s).join('')}
        ${sinners([[330, 425, .55], [462, 365, .5], [400, 265, .45], [525, 455, .55]])}`;
    },
    8: () => `<polygon points="110,485 230,200 300,330 380,110 470,320 545,205 690,485" fill="#cfe8ff" stroke="#fff" stroke-width="3" opacity=".92"/>
      <polygon points="230,200 262,262 210,302" fill="#a8d0f0"/><polygon points="380,110 422,222 350,262" fill="#a8d0f0"/>
      <polygon points="545,205 575,282 512,302" fill="#a8d0f0"/>
      ${sinners([[300, 410, .8], [420, 385, .7], [525, 430, .8]], '190,220,255')}`,
    9: () => cauldron('#ff8a20'),
    10: () => {
      const ox = (x, y, s, d) => `<g transform="translate(${x} ${y}) scale(${s} ${Math.abs(s)})"><g class="jbob" style="animation-delay:${d}s;animation-duration:.6s">
        <ellipse cx="0" cy="0" rx="46" ry="24" fill="#3a2418"/>
        <rect x="-36" y="14" width="9" height="30" fill="#3a2418"/><rect x="-14" y="14" width="9" height="30" fill="#3a2418"/>
        <rect x="12" y="14" width="9" height="30" fill="#3a2418"/><rect x="30" y="14" width="9" height="30" fill="#3a2418"/>
        <ellipse cx="50" cy="-10" rx="18" ry="14" fill="#4a2c1c"/>
        <path d="M44,-22 q-6,-16 -16,-18 M58,-22 q6,-16 16,-18" stroke="#e8e0c8" stroke-width="5" fill="none"/>
        <circle cx="56" cy="-12" r="2.5" fill="#ff4a2a"/></g></g>`;
      return `<ellipse cx="400" cy="400" rx="260" ry="70" fill="#1a0c06" stroke="#6a4020" stroke-width="6"/>
        ${sinners([[350, 420, .7], [440, 410, .65], [400, 440, .7]])}
        ${ox(230, 340, 1, 0)}${ox(560, 330, -1, .2)}${ox(330, 300, .8, .4)}${ox(490, 450, -1.1, .1)}${ox(260, 450, 1.1, .3)}`;
    },
    11: () => `${sinners([[330, 480, .9], [400, 485, .9], [470, 480, .9]])}
      <path d="M230,300 Q220,170 360,140 Q520,120 580,220 Q610,320 540,400 L260,400 Q220,360 230,300Z" fill="#6a6a70" stroke="#3a3a40" stroke-width="4"/>
      <path d="M330,200 l30,40 l-10,40 M460,180 l-20,50 l30,30" stroke="#3a3a40" stroke-width="3" fill="none"/>
      ${imp(640, 420, 1.1, '#5a3a8a', true)}`,
    12: () => `<path d="M290,360 L320,480 L480,480 L510,360Z" fill="#7a7a80" stroke="#4a4a4e" stroke-width="4"/>
      <ellipse cx="400" cy="360" rx="110" ry="20" fill="#3a3a3e"/>
      <circle cx="400" cy="352" r="12" fill="rgba(255,220,210,.9)"/>
      <g class="jpound"><rect x="385" y="40" width="30" height="240" fill="#8a6a40"/><rect x="360" y="250" width="80" height="70" rx="10" fill="#6a6a70"/></g>
      ${imp(230, 470, 1.2, '#2a6a5a')}${imp(570, 470, 1.2, '#3a5a9a', true)}`,
    13: () => {
      let heads = '';
      for (let i = 0; i < 9; i++) heads += `<g class="jbob" style="animation-delay:${i * .3}s"><circle cx="${210 + i * 48}" cy="${380 + (i % 3) * 18}" r="11" fill="rgba(255,220,210,.85)"/></g>`;
      return `<ellipse cx="400" cy="400" rx="280" ry="78" fill="#6a0610" stroke="#3a0408" stroke-width="6"/>
        <ellipse cx="400" cy="396" rx="250" ry="62" fill="#a00a18" filter="url(#jglow)"/>${heads}
        ${[0, 1, 2, 3, 4, 5].map(i => `<circle class="jbubble" style="animation-delay:${i * .4}s" cx="${260 + i * 56}" cy="400" r="6" fill="#d02030"/>`).join('')}`;
    },
    14: () => {
      let wall = '<rect x="120" y="220" width="560" height="260" fill="#1e2a26" stroke="#3a4a44" stroke-width="3"/>';
      for (let i = 0; i < 14; i++) wall += `<rect x="${120 + i * 40}" y="200" width="24" height="22" fill="#1e2a26" stroke="#3a4a44" stroke-width="2"/>`;
      return `${wall}<path d="M340,480 L340,350 A60,60 0 0,1 460,350 L460,480Z" fill="#050807"/>
        <rect x="335" y="236" width="130" height="40" fill="#0c1410" stroke="#7a9a8a" stroke-width="2"/>
        <text x="400" y="257" font-size="22" fill="#a8d8c0" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="6">枉死城</text>
        ${lantern(300, 300, '#5aff9a')}${lantern(500, 300, '#5aff9a')}
        ${sinners([[200, 500, .6], [260, 505, .55], [560, 500, .6], [620, 505, .55], [400, 470, .5], [700, 505, .5]], '170,230,200')}`;
    },
    15: () => `<rect x="300" y="140" width="16" height="340" fill="#6a4a2a"/><rect x="484" y="140" width="16" height="340" fill="#6a4a2a"/>
      <rect x="290" y="150" width="220" height="16" fill="#7a5a3a"/>
      ${ghost(400, 380, 1.3, SINNER)}
      <path d="M316,230 L360,280 M484,230 L440,280 M316,380 L360,350 M484,380 L440,350" stroke="#8a7a5a" stroke-width="4"/>
      ${imp(200, 470, 1.2, '#3a5a9a')}${imp(600, 470, 1.2, '#5a3a8a', true)}
      <path d="M232,380 l40,-40 l8,8 l-40,40Z M568,380 l-40,-40 l-8,8 l40,40Z" fill="#d8dee8"/>`,
    16: () => `<path d="M100,485 L330,170 L470,170 L700,485Z" fill="#2a1410"/>
      <ellipse cx="400" cy="172" rx="70" ry="14" fill="#ff6a1a" filter="url(#jglow)"/>
      <path d="M360,175 Q330,300 300,485 M420,178 Q450,320 520,485" stroke="#ff7a20" stroke-width="12" fill="none" filter="url(#jglow)"/>
      ${[0, 1, 2, 3, 4].map(i => `<circle class="jbubble" style="animation-delay:${i * .35}s;animation-duration:1.4s" cx="${360 + i * 20}" cy="160" r="${8 + i % 2 * 5}" fill="#ffb030"/>`).join('')}
      <ellipse cx="400" cy="120" rx="90" ry="50" fill="#ff5a1a" opacity=".35" filter="url(#jbigglow)"/>
      ${sinners([[260, 430, .6], [560, 420, .6], [420, 330, .5]])}`,
    17: () => {
      let grooves = '';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        grooves += `<line x1="400" y1="250" x2="${400 + Math.cos(a) * 130}" y2="${250 + Math.sin(a) * 130}" stroke="#55555a" stroke-width="5"/>`;
      }
      return `<rect x="378" y="380" width="44" height="100" fill="#3a3a3e"/>
        <g style="transform-box:view-box;transform-origin:400px 250px;animation:jspin 14s linear infinite">
          <circle cx="400" cy="250" r="140" fill="#7a7a80" stroke="#4a4a4e" stroke-width="8"/>${grooves}
          <circle cx="400" cy="250" r="22" fill="#3a3a3e"/></g>
        ${sinners([[240, 475, .8], [560, 475, .8], [310, 485, .65]])}`;
    },
    18: () => {
      let teeth = 'M220,300';
      for (let i = 0; i < 30; i++) teeth += ` l6,14 l6,-14`;
      return `<rect x="350" y="130" width="22" height="350" fill="#6a4a2a"/><rect x="428" y="130" width="22" height="350" fill="#6a4a2a"/>
        ${ghost(400, 430, 1.2, SINNER)}
        <g class="jsaw"><rect x="200" y="282" width="400" height="20" fill="#c8ced8" stroke="#6a727e" stroke-width="2"/>
          <path d="${teeth}" fill="#c8ced8" stroke="#6a727e" stroke-width="1"/>
          <rect x="176" y="276" width="28" height="32" rx="4" fill="#6a4a2a"/><rect x="596" y="276" width="28" height="32" rx="4" fill="#6a4a2a"/></g>
        ${imp(160, 470, 1.3, '#3a5a9a')}${imp(640, 470, 1.3, '#5a3a8a', true)}`;
    }
  };

  function cauldron(liquid) {
    let bubbles = '';
    for (let i = 0; i < 8; i++) {
      bubbles += `<circle class="jbubble" style="animation-delay:${i * .35}s" cx="${282 + i * 32}" cy="302" r="${4 + (i % 3) * 2}" fill="${liquid}"/>`;
    }
    return `${flames(250, 9, 38, 510)}
      <path d="M225,300 Q225,482 400,482 Q575,482 575,300 Z" fill="#1c1c1e" stroke="#4a4a4e" stroke-width="3"/>
      <ellipse cx="400" cy="300" rx="175" ry="28" fill="#2a2a2e" stroke="#5a5a5e" stroke-width="3"/>
      <ellipse cx="400" cy="302" rx="155" ry="20" fill="${liquid}" filter="url(#jglow)"/>
      ${bubbles}
      ${[330, 390, 455].map((x, i) => `<g class="jbob" style="animation-delay:${i * .5}s">
        <circle cx="${x}" cy="292" r="11" fill="rgba(255,220,210,.85)"/>
        <path d="M${x - 13},300 l-9,-20 M${x + 13},300 l9,-20" stroke="rgba(255,220,210,.85)" stroke-width="4"/></g>`).join('')}`;
  }

  function hellScene(lv) {
    const cold = lv === 8;
    const ghostly = lv === 14;
    const bg = cold ? 'linear-gradient(#0a1428, #1a2a48 60%, #08101e)'
      : ghostly ? 'radial-gradient(ellipse at 50% 90%, #0e2a20, #06120e 55%, #020504)'
      : 'radial-gradient(ellipse at 50% 90%, #6a1008, #200404 55%, #050101)';
    return scene(`第${lv}層・${HELL_LEVELS[lv - 1]}`, '民間信仰・十八層地獄', bg, cold ? 'snow' : ghostly ? 'fog' : 'embers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">${HELL_ART[lv]()}${guards()}</svg>`);
  }

  // ---------- 天堂（中國的天界） ----------
  async function sNanTian() {
    let rays = '';
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, b = a + 0.12;
      rays += `<polygon points="400,-40 ${400 + Math.cos(a) * 900},${-40 + Math.sin(a) * 900} ${400 + Math.cos(b) * 900},${-40 + Math.sin(b) * 900}" fill="rgba(255,250,220,.16)"/>`;
    }
    const studs = x0 => [0, 1, 2, 3].map(r => [0, 1, 2].map(c => `<circle cx="${x0 + 16 + c * 21}" cy="${215 + r * 40}" r="5" fill="#f0c860"/>`).join('')).join('');
    const general = (x, flip) => `<g class="jbob" style="animation-delay:${flip ? 1 : 0}s">
      <path d="M${x - 26},300 L${x - 40},400 L${x + 40},400 L${x + 26},300Z" fill="#c8a040" stroke="#8a6a20" stroke-width="2"/>
      <rect x="${x - 30}" y="296" width="60" height="16" fill="#e8c860"/>
      <circle cx="${x}" cy="278" r="18" fill="#f0d8b8"/>
      <path d="M${x - 20},270 Q${x},240 ${x + 20},270Z" fill="#d8b040"/><path d="M${x},244 l0,-18" stroke="#e03030" stroke-width="4"/>
      <line x1="${x + (flip ? -46 : 46)}" y1="210" x2="${x + (flip ? -46 : 46)}" y2="400" stroke="#8a6a3a" stroke-width="5"/>
      <path d="M${x + (flip ? -46 : 46)},210 l-10,20 l20,0Z" fill="#d8dee8"/>
      <path d="M${x + (flip ? -46 : 46)},226 q${flip ? 16 : -16},6 ${flip ? 18 : -18},18" stroke="#d8dee8" stroke-width="5" fill="none"/>
    </g>`;
    const layer = scene('南天門', '中國神話・天庭', 'linear-gradient(#fff6d8, #f6dca0 35%, #d8b8d8 75%, #a898c8)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <g class="jrays">${rays}</g>
        <rect x="320" y="190" width="160" height="210" fill="#fffef0" filter="url(#jbigglow)"/>
        <rect x="320" y="190" width="160" height="210" fill="#fffde8"/>
        <g class="jdoorL"><rect x="320" y="190" width="80" height="210" fill="#c8302a" stroke="#8a1a1a" stroke-width="2"/>${studs(320)}</g>
        <g class="jdoorR"><rect x="400" y="190" width="80" height="210" fill="#c8302a" stroke="#8a1a1a" stroke-width="2"/>${studs(400)}</g>
        <rect x="290" y="160" width="30" height="250" fill="#b8282a" stroke="#f0c860" stroke-width="3"/>
        <rect x="480" y="160" width="30" height="250" fill="#b8282a" stroke="#f0c860" stroke-width="3"/>
        <path d="M200,166 Q300,152 400,100 Q500,152 600,166 L575,180 L225,180 Z" fill="#e8b840" stroke="#a8781a" stroke-width="2"/>
        <path d="M250,112 Q330,104 400,66 Q470,104 550,112 L532,124 L268,124 Z" fill="#e8b840" stroke="#a8781a" stroke-width="2"/>
        <rect x="336" y="124" width="128" height="40" fill="#1a3a7a" stroke="#f0c860" stroke-width="3"/>
        <text x="400" y="145" font-size="24" fill="#f8e090" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="6">南天門</text>
        ${general(220, false)}${general(580, true)}
        ${crane(150, 120, 1, 0)}${crane(660, 90, -.8, .8)}
        ${cloudBank(430)}
        <g class="jrise">${ghost(400, 520, 1.3)}</g>
      </svg>`);
    await say('一道溫暖的光從天上灑下來，你的身體變得好輕、好輕。');
    setParticles('feathers');
    await say('你乘著雲往上飛，兩隻仙鶴在你身邊盤旋。');
    await say('雲的盡頭，是一座金光閃閃的大門——南天門。兩位天將手持長戟，守在門口。');
    layer.querySelector('svg').classList.add('open');
    chime();
    await say('天將看了看你，側身讓出了路：「請進。」朱紅色的大門，緩緩打開了。');
  }

  async function sReunion() {
    let flowers = '';
    for (let i = 0; i < 70; i++) {
      const c = ['#ff9ab0', '#ffd36a', '#ffffff', '#c9a6ff'][i % 4];
      flowers += `<circle cx="${(i * 97) % 800}" cy="${400 + (i * 53) % 115}" r="${3 + (i % 3)}" fill="${c}"/>`;
    }
    scene('重逢', '天界', 'linear-gradient(#fff1d0, #ffe2b0 35%, #bfe0a0 70%, #86b870)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <circle cx="640" cy="90" r="60" fill="#fff6c0" filter="url(#jbigglow)"/>
        <path d="M0,360 Q200,300 420,350 T800,330 L800,520 L0,520Z" fill="#a8d488"/>
        <path d="M0,410 Q260,370 520,400 T800,390 L800,520 L0,520Z" fill="#8cc070"/>
        ${flowers}
        <rect x="110" y="250" width="22" height="160" fill="#8a6a4a"/>
        <circle cx="120" cy="230" r="70" fill="#7ab060"/><circle cx="70" cy="262" r="45" fill="#6aa050"/><circle cx="172" cy="258" r="50" fill="#88c070"/>
        ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${80 + i * 18}" cy="${210 + (i % 3) * 25}" r="6" fill="#ffd040"/>`).join('')}
        ${ghost(290, 455, 1.1)}
        ${ghost(530, 445, 1.05, '255,226,190')}${ghost(610, 435, 0.9, '255,236,210')}${ghost(690, 450, 1.1, '255,220,200')}
        <g filter="url(#jglow)"><g class="jbob" style="animation-delay:.6s">
          <ellipse cx="455" cy="440" rx="22" ry="12" fill="rgba(255,236,210,.85)"/><circle cx="433" cy="427" r="11" fill="rgba(255,236,210,.9)"/>
          <path d="M426,419 l-4,-9 l9,5Z M438,418 l2,-10 l6,8Z" fill="rgba(255,236,210,.9)"/>
          <path d="M476,434 q12,-10 8,-20" stroke="rgba(255,236,210,.9)" stroke-width="4" fill="none"/>
        </g></g>
      </svg>`);
    await say('門後是一片看不到盡頭的草原，空氣裡有你最喜歡的味道。');
    await say('遠遠地，有人在向你揮手。');
    await say('是那些比你先離開的人。他們看起來年輕又健康，好像從來沒有老過。');
    await say('連小時候養的那隻狗，也搖著尾巴朝你飛奔過來。');
    await say('「我們一直在等你。」');
  }

  async function sPeach() {
    let peaches = '';
    for (let i = 0; i < 14; i++) {
      const x = 560 + Math.cos(i * 2.4) * (40 + (i * 13) % 70), y = 170 + Math.sin(i * 2.4) * (30 + (i * 7) % 50);
      peaches += `<circle cx="${x}" cy="${y}" r="13" fill="#ffa0b0"/><circle cx="${x - 4}" cy="${y - 4}" r="5" fill="#ffd0d8"/><path d="M${x},${y - 13} q4,-6 10,-6" stroke="#5a9a4a" stroke-width="3" fill="none"/>`;
    }
    const lotus = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="26" ry="8" fill="#5aa86a"/><path d="M${x - 10},${y - 2} Q${x},${y - 30} ${x + 10},${y - 2}Z" fill="#ffb8d0"/><path d="M${x - 18},${y - 2} Q${x - 12},${y - 22} ${x - 2},${y - 4}Z M${x + 18},${y - 2} Q${x + 12},${y - 22} ${x + 2},${y - 4}Z" fill="#ffd0e0"/>`;
    scene('瑤池蟠桃會', '中國神話・西王母', 'linear-gradient(#fdf0f4, #f8e0e8 40%, #d8f0e8 75%, #b8e0d8)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <rect x="548" y="220" width="24" height="200" fill="#8a5a3a"/>
        <circle cx="560" cy="180" r="110" fill="#8ac878"/><circle cx="490" cy="210" r="60" fill="#7ab868"/><circle cx="640" cy="200" r="70" fill="#98d088"/>
        ${peaches}
        <ellipse cx="260" cy="430" rx="230" ry="50" fill="#7ad0d0" opacity=".9"/>
        <path class="jwave" d="M60,430 Q160,420 260,432 T460,428" stroke="#e8ffff" stroke-width="2" fill="none"/>
        ${lotus(160, 430)}${lotus(260, 445)}${lotus(360, 425)}
        <rect x="430" y="400" width="320" height="18" fill="#b8302a"/><rect x="450" y="418" width="10" height="60" fill="#8a1a1a"/><rect x="720" y="418" width="10" height="60" fill="#8a1a1a"/>
        ${[480, 540, 600, 660, 710].map((x, i) => `<ellipse cx="${x}" cy="398" rx="20" ry="6" fill="#fff"/><circle cx="${x}" cy="390" r="${i % 2 ? 8 : 6}" fill="${i % 2 ? '#ffa0b0' : '#f8d080'}"/>`).join('')}
        ${ghost(470, 390, .9, '255,220,235')}${ghost(700, 390, .9, '255,236,210')}${ghost(590, 380, .8)}
        ${crane(150, 150, .9, .4)}
      </svg>`);
    chime();
    await say('西王母在瑤池畔擺下了蟠桃宴，邀請新來的你一起入席。');
    await say('傳說蟠桃園裡的桃子，三千年一開花、三千年一結果，吃了就能長生不老。');
    await say('神仙們舉杯向你道賀。你咬了一口蟠桃，甜到了心裡。');
  }

  async function sApsara() {
    const fairy = (x, y, s, c, d) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="jbob" style="animation-delay:${d}s">
      <path d="M-70,10 Q-20,-20 30,0 Q80,20 120,-10" stroke="${c}" stroke-width="6" fill="none" opacity=".8"/>
      <path d="M-60,30 Q0,10 40,24 Q90,40 130,20" stroke="#fff3a0" stroke-width="4" fill="none" opacity=".8"/>
      <path d="M-30,0 Q0,-14 40,-6 Q10,14 -30,0Z" fill="#fff0e0"/>
      <path d="M-30,0 Q-50,8 -70,4 Q-48,-6 -30,-4Z" fill="${c}"/>
      <circle cx="46" cy="-12" r="11" fill="#fbe0c8"/><path d="M40,-22 q8,-10 16,0" fill="#2a2a2a"/>
      <path d="M50,-4 L70,-30" stroke="#fbe0c8" stroke-width="4"/><circle cx="72" cy="-34" r="7" fill="#ff9ab8"/>
    </g></g>`;
    scene('天女散花', '《維摩詰經》＋ 敦煌飛天', 'linear-gradient(#3a4a9a, #8a7ac8 45%, #e8b8d8 80%, #fff0e0)', 'blossom',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">
        ${fairy(200, 140, 1.3, '#4ab8a8', 0)}${fairy(560, 100, 1.1, '#e86a8a', .8)}${fairy(420, 260, 1.2, '#f0a030', 1.5)}
        ${cloudBank(470, '#fff6fa')}
        ${ghost(400, 470, .9)}
      </svg>`);
    tone(587, 2, { gain: 0.03, type: 'triangle' }); tone(784, 2, { gain: 0.03, type: 'triangle', delay: .4 });
    await say('空中傳來仙樂。天女們披著長長的彩帶飛舞，把花瓣撒向四方。');
    await say('《維摩詰經》說：花瓣落在放下執念的人身上會滑落；落在心有掛礙的人身上，就會黏住。');
    await say('你低頭一看——身上一片花瓣都沒有沾上。');
  }

  async function sStars(d) {
    const good = goodDeeds(d);
    const n = good.length;
    if (!n) return;
    const pts = good.map((h, i) => ({
      x: n === 1 ? 400 : 110 + i * 580 / (n - 1),
      y: 160 + Math.sin(i * 1.9) * 80 + (i % 2) * 20,
      r: 4 + Math.min(9, h.karma / 3)
    }));
    const lines = pts.slice(1).map((p, i) =>
      `<line class="cl" x1="${pts[i].x}" y1="${pts[i].y}" x2="${p.x}" y2="${p.y}" stroke="rgba(255,240,200,.6)" stroke-width="1.5" style="opacity:0;transition:opacity 1s"/>`).join('');
    const stars = pts.map(p =>
      `<circle class="cs" cx="${p.x}" cy="${p.y}" r="${p.r}" fill="#fff6d0" filter="url(#jglow)" style="opacity:0;transition:opacity .8s"/>`).join('');
    const layer = scene('善念的星宿', '天界', 'linear-gradient(#070a22, #1c1840 60%, #3a2856)', 'stars',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">
        ${lines}${stars}
        <text class="cname" x="400" y="400" font-size="32" fill="#ffe9a8" text-anchor="middle" letter-spacing="8" filter="url(#jglow)" style="opacity:0;transition:opacity 1.5s">${esc(d.name)}星</text>
        <path d="M0,470 Q400,430 800,470 L800,520 L0,520Z" fill="#fff" opacity=".12"/>
        ${ghost(160, 490, .7)}${ghost(220, 495, .6, '255,236,250')}
      </svg>`);
    const cs = layer.querySelectorAll('.cs'), cl = layer.querySelectorAll('.cl');
    await say('夜晚，太白金星帶你來到銀河邊。');
    await say('「你看，」他捋著白鬍子說，「你在人間做過的每一件好事，都會變成天上的一顆星。」');
    for (let i = 0; i < n; i++) {
      cs[i].style.opacity = 1;
      if (i > 0) cl[i - 1].style.opacity = 1;
      show(`✦ ${good[i].stage}：${good[i].choice}`);
      tone(523 + i * 66, 0.9, { gain: 0.03, type: 'triangle' });
      await wait(1600, true);
    }
    layer.querySelector('.cname').style.opacity = 1;
    chime();
    await say(`${n} 顆星連成了一個星宿。從今以後，它就叫做「${d.name}星」。`);
    await say('每當人間有人抬頭看見它，心裡就會湧起一點點想做好事的勇氣。');
  }

  async function sParadise() {
    const island = (x, y, w, i) => `<g class="jbob" style="animation-delay:${i * .7}s">
      <path d="M${x - w},${y} Q${x},${y + w * .9} ${x + w},${y} Z" fill="#b89a78"/>
      <ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * .16}" fill="#7cc06a"/>
      <rect x="${x - w * .43}" y="${y - w * .14}" width="${w * .06}" height="${w * .16}" fill="#7a5a3a"/>
      <circle cx="${x - w * .4}" cy="${y - w * .25}" r="${w * .2}" fill="#5aa85a"/>
      <rect x="${x + w * .1}" y="${y + 2}" width="${w * .12}" height="${w * 1.2}" fill="rgba(225,242,255,.6)"/>
    </g>`;
    const pavilion = (x, y) => `<g class="jbob" style="animation-delay:.7s">
      <rect x="${x - 28}" y="${y - 44}" width="6" height="44" fill="#c8302a"/><rect x="${x + 22}" y="${y - 44}" width="6" height="44" fill="#c8302a"/>
      <path d="M${x - 50},${y - 44} Q${x},${y - 56} ${x},${y - 78} Q${x},${y - 56} ${x + 50},${y - 44} Z" fill="#e8b840" stroke="#a8781a"/>
      <path d="M${x - 36},${y - 66} Q${x},${y - 74} ${x},${y - 94} Q${x},${y - 74} ${x + 36},${y - 66} Z" fill="#e8b840" stroke="#a8781a"/>
    </g>`;
    scene('天宮的日子', '中國神話・天庭', 'linear-gradient(#bfe4ff, #e8f4ff 45%, #fff0d8 75%, #ffd8e4)', 'feathers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        ${['#ff8a8a', '#ffc070', '#fff07a', '#8ae08a', '#7ac0ff', '#b08aff'].map((c, i) =>
          `<path d="M60,440 A340,320 0 0,1 740,440" fill="none" stroke="${c}" stroke-width="10" opacity=".35" transform="translate(0 ${i * 10})"/>`).join('')}
        ${island(200, 210, 90, 0)}${island(570, 160, 110, 1)}${island(410, 330, 80, 2)}${island(690, 320, 60, 3)}
        ${pavilion(585, 158)}
        ${crane(330, 110, .8, .3)}
        ${ghost(180, 200, .45, '255,236,210')}${ghost(420, 322, .45)}${ghost(455, 322, .4, '255,226,190')}
        ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<ellipse cx="${(i * 131) % 800}" cy="${475 + (i % 3) * 14}" rx="${80 + (i % 3) * 30}" ry="26" fill="#fff" opacity=".85"/>`).join('')}
      </svg>`);
    chime();
    await say('在天上，沒有病痛，沒有飢餓，也沒有眼淚。');
    await say('你可以在雲上的亭子裡下棋、在仙山之間散步，或是學一樣一直想學、卻沒時間學的樂器。');
    await say('偶爾，你會趴在雲朵邊緣，偷偷往人間看。');
    await say('「天上一日，人間一年。」你在天上過了短短幾十天，人間已經過了好幾十年。');
    await say('你看著家人長大、變老，然後一個一個來到這裡，和你團聚。');
  }

  // ---------- 煉獄 ----------
  async function sPurgatory(d) {
    let terraces = '', souls = '';
    const terraceY = i => 450 - i * 52;
    for (let i = 0; i < 7; i++) {
      const y = terraceY(i), hw = 70 + (y - 90) / 410 * 250;
      terraces += `<path d="M${400 - hw},${y} Q400,${y + 20} ${400 + hw},${y}" stroke="rgba(255,230,210,.45)" stroke-width="3" fill="none"/>
        <text x="${400 + hw + 10}" y="${y + 4}" font-size="14" fill="rgba(255,235,220,.75)">第${i + 1}層・${SINS[i]}</text>`;
      for (let k = 0; k < 4; k++) souls += `<circle cx="${400 - hw * .8 + k * hw * .5 + (i * 13 % 20)}" cy="${y + 8}" r="3" fill="rgba(230,220,255,.5)"/>`;
    }
    const layer = scene('煉獄山', '但丁《神曲・煉獄篇》', 'linear-gradient(#262040, #4a3a5c 50%, #7a5868)', 'mist',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <circle cx="400" cy="70" r="70" fill="#ffe8a0" opacity=".55" filter="url(#jbigglow)"/>
        <path d="M60,510 L330,96 Q400,40 470,96 L740,510 Z" fill="url(#jmount)"/>
        ${terraces}${souls}
        <path d="M370,510 L370,478 A30,30 0 0,1 430,478 L430,510 Z" fill="#1a1426" stroke="#c9a0e0" stroke-width="2"/>
        <text class="jday" x="776" y="30" font-size="22" fill="#f0e6ff" font-weight="bold" text-anchor="end"></text>
        <circle class="jme" cx="400" cy="495" r="8" fill="#fff" filter="url(#jglow)"/>
      </svg>`);
    const me = layer.querySelector('.jme'), dayEl = layer.querySelector('.jday');
    const total = purgDays(d.karma);
    let curY = 495;
    const climbTo = async (y, dayFrom, dayTo, ms) => {
      const y0 = curY;
      await animate(ms, t => {
        const e = 1 - Math.pow(1 - t, 2);
        me.setAttribute('cy', y0 + (y - y0) * e);
        me.setAttribute('cx', 400 + Math.sin((y0 + (y - y0) * e) / 18) * 30);
        dayEl.textContent = `第 ${Math.round(dayFrom + (dayTo - dayFrom) * t)} 天`;
      });
      curY = y;
    };
    await say('你被帶到一座高聳入雲的山腳下，山頂閃著金色的光。');
    await say('但丁在《神曲》裡寫道：煉獄山有七層平台，對應七種罪——驕傲、嫉妒、憤怒、懶惰、貪婪、暴食、色慾。');
    await say('靈魂要一層一層往上爬，在每一層洗去對應的罪。爬到山頂，就能進入天界。');
    const bad = badDeeds(d);
    for (let i = 0; i < bad.length; i++) {
      const t = Math.min(6, Math.floor((i + 1) * 7 / (bad.length + 1)));
      const dayFrom = Math.round(total * i / (bad.length + 1)), dayTo = Math.round(total * (i + 1) / (bad.length + 1));
      show(`第 ${t + 1} 層・${SINS[t]}：你在這裡洗去了「${bad[i].choice}」`);
      await climbTo(terraceY(t) + 4, dayFrom, dayTo, 1300);
      tone(392 + t * 40, 0.6, { gain: 0.03, type: 'triangle' });
      await wait(1300, true);
    }
    show('繼續往上爬……');
    await climbTo(90, Math.round(total * bad.length / (bad.length + 1)), total, 2200);
    chime();
    await say(`第 ${total} 天，你終於爬上了山頂。`);
  }

  async function sEden(days) {
    let trees = '';
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 92, y = 250 + (i % 3) * 12, c = ['#6aa858', '#7ab868', '#5a9850'][i % 3];
      trees += `<rect x="${x - 6}" y="${y}" width="12" height="70" fill="#7a5a3a"/><circle cx="${x}" cy="${y - 10}" r="${34 + (i % 2) * 8}" fill="${c}"/>`;
    }
    scene('地上樂園', '但丁《神曲・煉獄篇》', 'linear-gradient(#e0f2d0, #f8f2c8 45%, #b8e0c8)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <rect x="0" y="300" width="800" height="220" fill="#a8d890"/>
        ${trees}
        <path d="M0,360 Q200,330 400,380 T800,360" stroke="#7ac0e8" stroke-width="30" fill="none" opacity=".85"/>
        <path class="jwave" d="M0,360 Q200,330 400,380 T800,360" stroke="#e8f6ff" stroke-width="2" fill="none"/>
        <path d="M0,465 Q250,435 420,480 T800,455" stroke="#f0c860" stroke-width="30" fill="none" opacity=".85"/>
        <path class="jwave" d="M0,465 Q250,435 420,480 T800,455" stroke="#fff8d8" stroke-width="2" fill="none"/>
        <text x="40" y="340" font-size="17" fill="#2a5a7a" font-weight="bold">勒特河（遺忘之河）</text>
        <text x="560" y="438" font-size="17" fill="#7a5a10" font-weight="bold">歐諾埃河（善憶之河）</text>
        ${ghost(420, 432, 1)}
      </svg>`);
    await say('山頂是一座美麗的花園，但丁稱它為「地上樂園」。');
    await say('這裡有兩條河。喝下勒特河的水，你會忘記自己犯過的錯；');
    await say('喝下歐諾埃河的水，你會重新想起自己做過的每一件好事。');
    await say(`經過 ${days} 天的修行，你的靈魂終於乾乾淨淨，可以升上天界了。`);
  }

  // ---------- 地獄 ----------
  async function sHell(d) {
    const depth = hellDepth(d.karma);
    const layer = scene('墜入地府', '民間信仰・十八層地獄', 'radial-gradient(ellipse at 50% 92%, #7a1808, #220404 50%, #050101)', 'embers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        ${funnelRings()}
        <text class="jdepth" x="400" y="70" font-size="50" fill="#ff6a4a" text-anchor="middle" dominant-baseline="middle" font-weight="900" letter-spacing="8" filter="url(#jglow)"></text>
        <g class="jfall">${ghost(400, 210, 1.2)}</g>
      </svg>`);
    const counter = layer.querySelector('.jdepth');
    await say('腳下的地面突然裂開——');
    rumble();
    for (let i = 1; i <= depth; i++) {
      counter.textContent = `第 ${i} 層`;
      show(`往下墜……${HELL_LEVELS[i - 1]}`);
      if (i % 3 === 0) shake();
      tone(140 - i * 4, 0.25, { type: 'sawtooth', gain: 0.03 });
      await wait(Math.max(160, 420 - i * 15));
    }
    shake();
    await say(`你一路墜落到第 ${depth} 層：${HELL_LEVELS[depth - 1]}。`);
  }

  /** 十八層地獄全圖，標出你的罪會去的層 */
  async function sMap(d) {
    const depth = hellDepth(d.karma);
    const levels = new Set(badDeeds(d).map(sinLevel));
    let rows = '';
    for (let i = 0; i < 18; i++) {
      const lv = i + 1, y = 34 + i * 25, mine = levels.has(lv);
      const w = 520 - i * 14, x = 400 - w / 2;
      rows += `<rect class="mrow" data-lv="${lv}" x="${x}" y="${y}" width="${w}" height="21" rx="3"
          fill="${mine ? '#a8281a' : `rgb(${60 - i * 2},${18 - i / 2},${14 - i / 2})`}" stroke="${mine ? '#ffb070' : '#4a1a12'}" stroke-width="${mine ? 2 : 1}"/>
        <text x="400" y="${y + 11}" font-size="13" fill="${mine ? '#fff0d8' : '#c8a090'}" text-anchor="middle" dominant-baseline="middle">第${lv}層・${HELL_LEVELS[i]}</text>`;
      if (lv === depth) rows += `<text x="${x + w + 10}" y="${y + 12}" font-size="14" fill="#ff8a5a" dominant-baseline="middle" font-weight="bold">◀ 你在這裡</text>`;
    }
    scene('十八層地獄', '民間信仰・《玉曆寶鈔》', 'radial-gradient(ellipse at 50% 30%, #3a0c08, #120303 60%, #050101)', 'embers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">${rows}</svg>`);
    gong();
    await say('判官帶你來到一張巨大的地獄圖前。');
    await say('民間傳說，地獄一共有十八層，每一層懲罰不同的罪，越往下越苦。');
    await say(`你這一生犯下的罪，牽連到其中 ${levels.size} 層。每一層，你都得親自走一遭。`);
  }

  /** 依照你的每一件壞事，走過對應的地獄 */
  async function sTour(d) {
    const groups = new Map();
    for (const h of badDeeds(d)) {
      const lv = sinLevel(h);
      if (!groups.has(lv)) groups.set(lv, []);
      groups.get(lv).push(h);
    }
    const order = [...groups.keys()].sort((a, b) => a - b);
    for (const lv of order) {
      hellScene(lv);
      if (lv === 6 || lv === 16 || lv === 9) tone(90, 1.2, { type: 'sawtooth', gain: 0.03, slide: .7 });
      const deeds = groups.get(lv).map(h => `「${h.choice}」`).join('、');
      await say(`第 ${lv} 層，${HELL_LEVELS[lv - 1]}。因為你生前${deeds}——`);
      await say(HELL_DESC[lv - 1]);
    }
    await say('牛頭和馬面拿著鋼叉，一層一層押著你走。很痛，但是不會死——因為你早就已經死了。');
  }

  async function sLedger(d) {
    const days = hellDays(d.karma);
    const layer = scene('判官的帳簿', '民間信仰・判官與生死簿', 'radial-gradient(circle at 50% 40%, #2a1410, #080303 70%)', 'dust',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">
        <rect x="130" y="24" width="540" height="472" rx="6" fill="#e8dcc0" stroke="#8a6a3a" stroke-width="6"/>
        <foreignObject x="150" y="40" width="500" height="446"><div xmlns="http://www.w3.org/1999/xhtml" class="ledger"></div></foreignObject>
      </svg>`);
    const box = layer.querySelector('.ledger');
    box.innerHTML = `<div class="lt">${esc(d.name)}・罪業簿</div>`;
    await say('最後，判官攤開一本泛黃的帳簿，把你欠下的每一筆債都算清楚。');
    for (const h of badDeeds(d)) {
      const row = document.createElement('div');
      row.className = 'lr';
      row.innerHTML = `<span>${esc(h.stage)}・${esc(h.choice)}</span><i>${HELL_LEVELS[sinLevel(h) - 1]}</i><b>${h.karma}</b>`;
      box.appendChild(row);
      tone(150, 0.3, { type: 'square', gain: 0.02 });
      await wait(1000, true);
    }
    const sum = document.createElement('div');
    sum.className = 'ls';
    sum.innerHTML = `業力 <b>${fmt(d.karma)}</b>　刑期 <b>${days}</b> 天`;
    box.appendChild(sum);
    gong();
    await say(`判官提筆一揮：你要在地獄待上 ${days} 天，等業力回到 -50，才能離開。`);
  }

  async function sRise(d) {
    const depth = hellDepth(d.karma), days = hellDays(d.karma);
    const layer = scene('贖罪', '民間信仰・十八層地獄', 'radial-gradient(ellipse at 50% 92%, #7a1808, #220404 50%, #050101)', 'embers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        ${funnelRings()}
        <text class="rl" x="400" y="60" font-size="46" fill="#ff7a5a" text-anchor="middle" dominant-baseline="middle" font-weight="900" letter-spacing="8" filter="url(#jglow)">第 ${depth} 層</text>
        <text class="rd" x="400" y="108" font-size="20" fill="#ffd0c0" text-anchor="middle" dominant-baseline="middle"></text>
        <g class="rg">${ghost(400, 440, .9)}</g>
      </svg>`);
    const rl = layer.querySelector('.rl'), rd = layer.querySelector('.rd'), rg = layer.querySelector('.rg');
    await say('一天又一天，你在刑罰中慢慢明白了自己犯下的錯。');
    show('每受一天刑，罪就輕了一點……');
    await animate(6500, t => {
      rl.textContent = `第 ${Math.max(1, Math.round(depth - (depth - 1) * t))} 層`;
      rd.textContent = `第 ${Math.round(days * t)} 天　業力 ${fmt(Math.round(d.karma + (-50 - d.karma) * t))}`;
      rg.setAttribute('transform', `translate(0 ${-t * 250})`);
    });
    chime();
    await say(`第 ${days} 天，你的業力終於回到了 -50。刑期滿了。`);
  }

  async function sJizo() {
    const days = purgDays(-50);
    let rays = '';
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, b = a + 0.14;
      rays += `<polygon points="400,180 ${400 + Math.cos(a) * 700},${180 + Math.sin(a) * 700} ${400 + Math.cos(b) * 700},${180 + Math.sin(b) * 700}" fill="rgba(255,220,140,.12)"/>`;
    }
    let lotus = '';
    for (let i = -4; i <= 4; i++) {
      lotus += `<ellipse cx="${400 + i * 26}" cy="${452 + Math.abs(i) * 3}" rx="16" ry="34" fill="${Math.abs(i) % 2 ? '#f0a0b8' : '#f8c8d8'}" stroke="#d87898" transform="rotate(${i * 12} ${400 + i * 26} ${470})"/>`;
    }
    scene('地藏王菩薩', '佛教・地藏菩薩', 'radial-gradient(circle at 50% 38%, #6a4a10, #1a0c04 60%, #050202)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <g style="transform-box:view-box;transform-origin:400px 180px;animation:jspin 80s linear infinite">${rays}</g>
        <circle cx="400" cy="150" r="95" fill="#ffd870" opacity=".25" filter="url(#jbigglow)"/>
        <circle cx="400" cy="150" r="66" fill="none" stroke="#ffd870" stroke-width="5" filter="url(#jglow)"/>
        <path d="M325,212 Q296,330 288,450 L512,450 Q504,330 475,212 Q400,190 325,212Z" fill="#b8642a" stroke="#e8a050" stroke-width="2"/>
        <path d="M340,214 L480,440" stroke="#d88a3a" stroke-width="14" opacity=".75"/>
        <path d="M352,218 Q400,290 448,218" fill="none" stroke="#e8a050" stroke-width="4"/>
        <circle cx="400" cy="160" r="38" fill="#f0d0a8"/>
        <path d="M384,162 q6,4 12,0 M404,162 q6,4 12,0" stroke="#6a4a2a" stroke-width="2" fill="none"/>
        <circle cx="400" cy="142" r="3" fill="#d88a5a"/>
        <path d="M392,180 q8,5 16,0" stroke="#a86a4a" stroke-width="2" fill="none"/>
        <line x1="515" y1="118" x2="515" y2="455" stroke="#d8b860" stroke-width="6"/>
        <ellipse cx="515" cy="104" rx="22" ry="28" fill="none" stroke="#e8c870" stroke-width="5"/>
        <circle cx="497" cy="122" r="6" fill="none" stroke="#e8c870" stroke-width="3"/><circle cx="533" cy="122" r="6" fill="none" stroke="#e8c870" stroke-width="3"/>
        <circle cx="336" cy="300" r="16" fill="#fff8e0" filter="url(#jglow)"/>
        ${lotus}
        ${ghost(170, 480, .9)}
      </svg>`);
    chime();
    await say('黑暗中，忽然亮起一道溫柔的金光。');
    await say('一位手持錫杖的僧人緩緩走來——是地藏王菩薩。');
    await say('祂曾經發下大願：「地獄不空，誓不成佛。」為了救度受苦的眾生，祂一直留在這裡。');
    await say('「知錯能改，就還有希望。」祂牽起你的手，帶你走出了地獄。');
    await say(`之後，你又在人間與天界之間修行了 ${days} 天，一點一點洗淨了罪，終於可以升上天界。`);
  }

  // ---------- 奈何橋：選擇要不要轉世 ----------
  async function sBridge(d) {
    scene('奈何橋', '民間傳說・孟婆湯', 'linear-gradient(#060c18, #0e1a2c 60%, #0a1420)', 'stars',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <circle cx="660" cy="80" r="28" fill="#e8eef8" filter="url(#jglow)"/>
        <rect x="0" y="410" width="800" height="110" fill="#0a1e30"/>
        ${[430, 452, 474, 496].map((y, i) => `<path class="jwave" style="animation-delay:${-i * .7}s" d="M0,${y} Q100,${y - 6} 200,${y} T400,${y} T600,${y} T800,${y}" stroke="rgba(140,190,230,.35)" stroke-width="2" fill="none"/>`).join('')}
        <path d="M150,420 Q400,250 650,420 L650,438 Q400,272 150,438Z" fill="#3a4252" stroke="#7a8494" stroke-width="2"/>
        ${[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map(t => {
          const x = 150 + t * 500, y = 420 - Math.sin(t * Math.PI) * 85;
          return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 22}" stroke="#7a8494" stroke-width="3"/>`;
        }).join('')}
        <text x="400" y="372" font-size="20" fill="#c8d4e8" text-anchor="middle" font-weight="bold" letter-spacing="6">奈何橋</text>
        <g class="jbob">
          <path d="M70,420 Q60,350 90,330 Q120,320 128,350 Q140,380 136,420 Z" fill="#3a3640"/>
          <circle cx="104" cy="318" r="15" fill="#c8b8a8"/>
          <circle cx="98" cy="304" r="9" fill="#ccc"/>
          <line x1="58" y1="345" x2="50" y2="420" stroke="#6a5a40" stroke-width="4"/>
          <path d="M128,360 L160,358" stroke="#3a3640" stroke-width="10" stroke-linecap="round"/>
        </g>
        <path d="M150,352 Q170,372 190,352 Z" fill="#8a6a40" stroke="#c8a870"/>
        ${[160, 170, 180].map((x, i) => `<path class="jsteam" style="animation-delay:${i * .8}s" d="M${x},348 q-6,-10 0,-20 q6,-10 0,-20" stroke="rgba(230,240,255,.7)" stroke-width="2" fill="none"/>`).join('')}
        ${ghost(330, 330, .8)}
        <rect x="0" y="500" width="800" height="20" fill="#06101a"/>
      </svg>`);
    await say('……很久很久以後。');
    await say('有一天，你來到了奈何橋。橋下是流著遺忘之水的忘川河，橋頭站著一位老婆婆——孟婆。');
    await say('她舀起一碗熱湯：「喝下它，你就會忘記這一生，重新投胎做人。」');
    const pick = await ask('你要喝下孟婆湯嗎？', ['🍵 喝下孟婆湯，轉世投胎', '不喝，我想記得這一生']);
    if (pick === 0) {
      await say('湯是溫的，有點甜，又有點苦。');
      const best = [...goodDeeds(d)].sort((a, b) => b.karma - a.karma)[0];
      await say(best ? `你最後想起的畫面，是${best.stage}時，你選擇「${best.choice}」的那一刻。` : '你努力想記住些什麼，卻什麼都想不起來了。');
      scene('', '', '#fffaf2', 'none', '');
      tone(880, 1.5, { gain: 0.03, type: 'triangle' });
      await say('……哇啊——哇啊——');
      await say('你聽見了嬰兒的哭聲。那是你自己的聲音。新的人生，開始了。');
      return 'reincarnate';
    }
    await say('孟婆嘆了口氣，收回了碗：「也好。等你準備好了，再來吧。」');
    await say('你轉身走回雲端。在那裡，你所愛的人都還在等你。');
    return 'stay';
  }

  // ---------- 對外介面 ----------
  async function play(d) {
    if (!root) build();
    resize();
    skipping = false;
    typingDone = clickWaiter = null;
    root.style.background = '#000';
    lineEl.textContent = '';
    root.classList.add('on');
    if (!raf) raf = requestAnimationFrame(frame);

    const result = { choice: 'skip', hellDays: 0, purgDays: 0, depth: 0 };
    if (d.realm === 'HELL') {
      result.depth = hellDepth(d.karma);
      result.hellDays = hellDays(d.karma);
      result.purgDays = purgDays(-50);
    } else if (d.realm === 'PURGATORY') {
      result.purgDays = purgDays(d.karma);
    }

    const scenes = [sDeath, sWuchang, sGate, sRoad, sHome, sMirror, sJudge];
    if (d.realm === 'HEAVEN') scenes.push(sNanTian, sReunion, sPeach, sApsara, sStars, sParadise);
    else if (d.realm === 'PURGATORY') scenes.push(sPurgatory, () => sEden(result.purgDays), sNanTian, sReunion, sParadise);
    else scenes.push(sHell, sMap, sTour, sLedger, sRise, sJizo, sNanTian, sReunion, sParadise);

    try {
      for (const s of scenes) await s(d);
      result.choice = await sBridge(d);
    } catch (e) {
      if (!(e instanceof SkipSignal)) console.error(e);
    }
    root.classList.remove('on');
    await new Promise(r => setTimeout(r, 800));
    cancelAnimationFrame(raf);
    raf = null;
    stageEl.innerHTML = '';
    titleEl.textContent = srcEl.textContent = '';
    setParticles('none');
    return result;
  }

  window.Journey = {
    /**
     * ending: { soul:{name, age, karma, realm}, verdict, history:[{stage, choice, karma}] }
     * 回傳 { choice: 'reincarnate' | 'stay' | 'skip', hellDays, purgDays, depth }
     */
    play: ending => play({
      name: ending.soul.name, age: ending.soul.age, karma: ending.soul.karma,
      realm: ending.soul.realm, verdict: ending.verdict, history: ending.history
    }),
    sinLevel,
    /** 開發用：直接預覽某一層地獄或某個天界場景，例如 Journey.preview(9) 或 Journey.preview('sPeach') */
    preview(what, d = { name: '測試者', age: 80, karma: 100, realm: 'HEAVEN', verdict: '', history: [{ stage: '童年', choice: '當志工', karma: 10 }, { stage: '少年', choice: '讓座', karma: 5 }, { stage: '中年', choice: '捐一筆錢', karma: 12 }] }) {
      if (!root) build();
      resize();
      root.classList.add('on');
      if (!raf) raf = requestAnimationFrame(frame);
      const fns = { sNanTian, sReunion, sPeach, sApsara, sStars, sParadise, sMap, sLedger };
      if (typeof what === 'number') hellScene(what);
      else fns[what](d).catch(() => {});
    }
  };
})();
