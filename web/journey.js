// 死後旅程：人生結束後播放的過場動畫
// 地獄取材自中國民間信仰（《玉曆寶鈔》、十八層地獄、地藏王、孟婆湯）
// 天堂取材自西方故事（《聖經》、但丁《神曲・天堂篇》、希臘神話、散文詩〈彩虹橋〉）
// 審判後會在天堂或地獄「住下來」，一天一天過那裡的生活，每天的選擇會寫進日記（地獄還會影響刑期）
(function () {
  const REALM_NAME = { HEAVEN: '天堂', HELL: '地獄' };
  const REALM_COLOR = { HEAVEN: '#f2c94c', HELL: '#ff4a3a' };
  const HELL_LEVELS = ['拔舌地獄', '剪刀地獄', '鐵樹地獄', '孽鏡地獄', '蒸籠地獄', '銅柱地獄',
    '刀山地獄', '冰山地獄', '油鍋地獄', '牛坑地獄', '石壓地獄', '舂臼地獄',
    '血池地獄', '枉死地獄', '磔刑地獄', '火山地獄', '石磨地獄', '刀鋸地獄'];

  let root, stageEl, lineEl, nextEl, titleEl, srcEl, cv, g2d;
  let skipping = false, muted = false;
  let skipBtn, inFixed = false; // inFixed：目前這一幕是否每次都一樣（可以跳過）
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
        <linearGradient id="jpearl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#f4eef8"/><stop offset=".7" stop-color="#e8f0fa"/><stop offset="1" stop-color="#f8e8f0"/></linearGradient>
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
    skipBtn = root.querySelector('.jskip');
    cv = root.querySelector('canvas');
    g2d = cv.getContext('2d');

    root.addEventListener('click', e => { if (!e.target.closest('.jtools')) advance(); });
    skipBtn.onclick = skip;
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

  /** 跳過每次都一樣的場景，直到下一個會因玩家選擇而不同的場景 */
  function skip() {
    if (!inFixed || skipping) return;
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
      case 'petals': return { k: 'petal', x: R(-50, W), y: init ? R(0, H) : -20, vx: R(.3, 1), vy: R(.6, 1.5), r: R(4, 8), rot: R(0, 6), vr: R(-.04, .04), a: R(.6, .95), c: '210,30,45', sway: R(0, 6) };
      case 'embers': return { k: 'dot', x: R(0, W), y: init ? R(0, H) : H + 10, vx: R(-.4, .4), vy: -R(.8, 2.4), r: R(1, 3), a: R(.5, 1), c: Math.random() < .5 ? '255,140,40' : '255,80,30', sway: R(0, 6) };
      case 'light': return { k: 'dot', x: R(0, W), y: init ? R(0, H) : H + 10, vx: R(-.2, .2), vy: -R(.3, .9), r: R(1.5, 3.5), a: R(.4, .9), c: '255,240,190', sway: R(0, 6) };
      case 'feathers': return { k: 'feather', x: R(0, W), y: init ? R(0, H) : -20, vx: R(-.2, .3), vy: R(.3, .7), r: R(6, 11), rot: R(0, 6), vr: R(-.02, .02), a: R(.5, .9), c: '255,255,255', sway: R(0, 6) };
      case 'dust': return { k: 'dot', x: R(0, W), y: R(0, H), vx: R(-.15, .15), vy: R(-.15, .15), r: R(.6, 1.6), a: R(.2, .6), c: '220,230,255', sway: R(0, 6) };
      case 'snow': return { k: 'dot', x: R(0, W), y: init ? R(0, H) : -10, vx: R(-.3, .3), vy: R(.6, 1.6), r: R(1, 3), a: R(.5, .95), c: '235,245,255', sway: R(0, 6) };
      case 'blossom': return { k: 'petal', x: R(-50, W), y: init ? R(0, H) : -20, vx: R(-.3, .8), vy: R(.5, 1.2), r: R(4, 7), rot: R(0, 6), vr: R(-.04, .04), a: R(.6, .95), c: Math.random() < .5 ? '255,170,200' : '255,215,225', sway: R(0, 6) };
      case 'money': return { k: 'paper', x: R(0, W), y: init ? R(0, H) : -20, vx: R(-.3, .3), vy: R(.5, 1.3), r: R(7, 12), rot: R(0, 6), vr: R(-.05, .05), a: R(.7, 1), c: '232,192,64', sway: R(0, 6) };
      case 'stars': return { k: 'star', x: R(0, W), y: R(0, H * .6), vx: 0, vy: 0, r: R(.5, 1.6), a: R(.3, 1), c: '255,255,255', sway: R(0, 6) };
    }
    return null;
  }

  const MAX = { fog: 18, petals: 70, embers: 110, light: 80, feathers: 26, dust: 60, stars: 120, snow: 110, blossom: 80, money: 60 };

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
      } else if (p.k === 'paper') {
        g2d.save();
        g2d.translate(p.x, p.y);
        g2d.rotate(p.rot);
        g2d.fillStyle = `rgb(${p.c})`;
        g2d.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2);
        g2d.fillStyle = '#c82a1a';
        g2d.fillRect(-p.r * .3, -p.r * .3, p.r * .6, p.r * .6);
        g2d.restore();
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
        <g class="mtext" style="transition:opacity .4s"></g>
      </svg>`);
    const box = layer.querySelector('.mtext');
    const ring = layer.querySelector('.mring');
    // 用 SVG 文字畫在鏡面正中間，每列一行：[文字, 字級, 顏色, 粗體]
    const setMirror = rows => {
      const lh = r => r[1] * 1.4;
      let y = 240 - rows.reduce((a, r) => a + lh(r), 0) / 2;
      box.innerHTML = rows.map(([text, size, color, bold]) => {
        const cy = y + lh([0, size]) / 2;
        y += lh([0, size]);
        return `<text x="400" y="${cy}" font-size="${size}" fill="${color}" text-anchor="middle" dominant-baseline="middle"${bold ? ' font-weight="bold"' : ''}>${esc(text)}</text>`;
      }).join('');
    };
    // 長句切成每行最多 9 個字，標點不放在行首
    const wrap = (text, n = 9) => {
      const lines = [];
      let cur = '';
      for (const ch of text) {
        if (cur.length >= n && !/[，。、！？」』）]/.test(ch)) { lines.push(cur); cur = ''; }
        cur += ch;
      }
      return cur ? [...lines, cur] : lines;
    };
    await say('殿前立著一面巨大的銅鏡，鏡框上刻著七個字：');
    await say('「孽鏡台前無好人」。');
    await say('這面鏡子會照出你一生做過的每一件事，誰也騙不了它。');
    show('鏡子亮了起來……（點一下可以加快）');
    for (const h of d.history) {
      const col = h.karma > 0 ? '#f2c94c' : h.karma < 0 ? '#ff3a2a' : '#aab';
      box.style.opacity = 0;
      await wait(250);
      setMirror([
        [h.stage, 15, '#4a5468'],
        ...wrap(h.choice).map(line => [line, 22, '#0e1420', true]),
        [fmt(h.karma), 30, h.karma > 0 ? '#9a6a00' : h.karma < 0 ? '#b01010' : '#556', true]
      ]);
      box.style.opacity = 1;
      ring.style.stroke = col;
      ring.style.opacity = .9;
      tone(h.karma >= 0 ? 660 : 160, 0.5, { gain: 0.03, type: h.karma >= 0 ? 'sine' : 'sawtooth' });
      await wait(1900, true);
      ring.style.opacity = .25;
    }
    box.style.opacity = 0;
    await wait(300);
    setMirror([['一生業力總和', 15, '#4a5468'], [fmt(d.karma), 44, d.karma >= 0 ? '#9a6a00' : '#b01010', true]]);
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
  // 和模擬器的規則一致：業力低於 0 就下地獄，每天平均贖罪 3 點，回到 0 就刑滿
  const hellDays = karma => Math.max(1, Math.ceil(-karma / 3));
  const hellDepth = karma => clamp(Math.ceil(-karma / 10), 1, 18);

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

  // ---------- 天堂（西方的天國） ----------
  /** 天使：翅膀、白袍、光環，item 可以是 'harp' 或 'trumpet' */
  function angel(x, y, s = 1, delay = 0, item = '') {
    const hold = item === 'harp'
      ? `<path d="M12,-34 L34,-34 Q40,-4 18,14 Z" fill="none" stroke="#e8b840" stroke-width="3"/>
         ${[17, 22, 27].map(sx => `<line x1="${sx}" y1="-32" x2="${sx}" y2="${sx > 24 ? -4 : 6}" stroke="#f8e8b0" stroke-width="1"/>`).join('')}`
      : item === 'trumpet'
        ? `<path d="M10,-52 L58,-76 L64,-62 Z" fill="#f0c040" stroke="#b8902a"/><ellipse cx="61" cy="-69" rx="5" ry="9" fill="#ffe080" transform="rotate(-26 61 -69)"/>`
        : '';
    // s 是負數時只左右翻轉
    return `<g transform="translate(${x} ${y}) scale(${s} ${Math.abs(s)})"><g class="jbob" style="animation-delay:${delay}s">
      <path d="M-8,-48 Q-62,-92 -80,-28 Q-62,-40 -52,-8 Q-32,-30 -8,-20Z" fill="#fffdf6" stroke="#e8dcc0" stroke-width="1.5"/>
      <path d="M8,-48 Q62,-92 80,-28 Q62,-40 52,-8 Q32,-30 8,-20Z" fill="#fffdf6" stroke="#e8dcc0" stroke-width="1.5"/>
      <path d="M-14,-46 L-30,40 L30,40 L14,-46 Q0,-52 -14,-46Z" fill="#fff" stroke="#e0d4b8" stroke-width="1.5"/>
      <circle cx="0" cy="-62" r="13" fill="#f6dcc0"/>
      <path d="M-13,-62 Q-13,-80 0,-78 Q13,-80 13,-62 Q8,-72 0,-72 Q-8,-72 -13,-62Z" fill="#e8c060"/>
      <ellipse cx="0" cy="-84" rx="15" ry="4" fill="none" stroke="#ffd860" stroke-width="3" filter="url(#jglow)"/>
      ${hold}
    </g></g>`;
  }

  /** 從畫面頂端放射出來的光芒 */
  function sunRays(n = 16, alpha = .16) {
    let rays = '';
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = a + 0.12;
      rays += `<polygon points="400,-40 ${400 + Math.cos(a) * 900},${-40 + Math.sin(a) * 900} ${400 + Math.cos(b) * 900},${-40 + Math.sin(b) * 900}" fill="rgba(255,250,220,${alpha})"/>`;
    }
    return `<g class="jrays">${rays}</g>`;
  }

  /** 聖彼得：白鬍子、金鑰匙、生命冊 */
  function peter(x) {
    return `<g class="jbob" style="animation-delay:.5s">
      <path d="M${x - 30},300 L${x - 54},430 L${x + 54},430 L${x + 30},300 Z" fill="#3a5a9a" stroke="#24406e" stroke-width="2"/>
      <path d="M${x - 24},302 L${x + 14},430 L${x + 54},430 L${x + 30},300Z" fill="#d0a040" opacity=".9"/>
      <circle cx="${x}" cy="278" r="20" fill="#f0d0b0"/>
      <path d="M${x - 19},282 Q${x},336 ${x + 19},282 Q${x},296 ${x - 19},282Z" fill="#f6f6f6"/>
      <path d="M${x - 20},276 Q${x - 18},254 ${x},256 Q${x + 18},254 ${x + 20},276 Q${x},266 ${x - 20},276Z" fill="#eee"/>
      <ellipse cx="${x}" cy="250" rx="22" ry="5" fill="none" stroke="#ffd860" stroke-width="3" filter="url(#jglow)"/>
      <g transform="translate(${x - 50} 336) rotate(-35)" filter="url(#jglow)">
        <circle r="9" fill="none" stroke="#f0c040" stroke-width="4"/><line x1="9" y1="0" x2="46" y2="0" stroke="#f0c040" stroke-width="4"/>
        <path d="M36,0 v9 M44,0 v11" stroke="#f0c040" stroke-width="4"/></g>
      <g transform="rotate(-8 ${x + 38} 334)"><rect x="${x + 14}" y="316" width="48" height="34" rx="2" fill="#8a2a2a" stroke="#f0c040" stroke-width="2"/>
        <line x1="${x + 38}" y1="316" x2="${x + 38}" y2="350" stroke="#f0c040" stroke-width="1.5"/></g>
    </g>`;
  }

  /** 一扇珍珠做的拱門（左右兩片門可以打開） */
  function pearlGate(x, y, w, h) {
    const r = w / 2;
    return `<rect x="${x}" y="${y - r}" width="${w}" height="${h + r}" fill="#fffef0" filter="url(#jbigglow)"/>
      <path d="M${x},${y + h} L${x},${y} A${r},${r} 0 0,1 ${x + w},${y} L${x + w},${y + h}Z" fill="#fffde8"/>
      <g class="jdoorL"><path d="M${x},${y + h} L${x},${y} A${r},${r} 0 0,1 ${x + r},${y - r} L${x + r},${y + h}Z" fill="url(#jpearl)" stroke="#d8c8d8" stroke-width="2"/></g>
      <g class="jdoorR"><path d="M${x + r},${y + h} L${x + r},${y - r} A${r},${r} 0 0,1 ${x + w},${y} L${x + w},${y + h}Z" fill="url(#jpearl)" stroke="#d8c8d8" stroke-width="2"/></g>
      <path d="M${x - 10},${y + h} L${x - 10},${y} A${r + 10},${r + 10} 0 0,1 ${x + w + 10},${y} L${x + w + 10},${y + h}" fill="none" stroke="#e8c060" stroke-width="8"/>`;
  }

  /** 碧玉城牆 */
  function jasperWall(x, y, w, h) {
    let bricks = '';
    for (let r = 0; r < h / 30; r++) bricks += `<line x1="${x}" y1="${y + r * 30}" x2="${x + w}" y2="${y + r * 30}" stroke="rgba(255,255,255,.35)" stroke-width="1"/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#9ad6c2" stroke="#e8c060" stroke-width="3"/>${bricks}
      <rect x="${x - 4}" y="${y - 12}" width="${w + 8}" height="12" fill="#e8c060"/>`;
  }

  async function sGates() {
    let steps = '';
    for (let i = 0; i < 9; i++) {
      const t = i / 8, y = 520 - t * 120, hw = 120 - t * 60;
      steps += `<line x1="${400 - hw}" y1="${y}" x2="${400 + hw}" y2="${y}" stroke="rgba(230,190,90,${.45 + t * .5})" stroke-width="${5 - t * 2}"/>`;
    }
    const layer = scene('珍珠門', '《聖經・創世記》雅各的天梯 ＋《啟示錄》＋ 聖彼得守天門的傳說', 'linear-gradient(#fff6e0, #f8e6c0 35%, #d8d0f0 75%, #a8b8e8)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        ${sunRays()}
        ${jasperWall(60, 220, 260, 190)}${jasperWall(480, 220, 260, 190)}
        ${pearlGate(330, 200, 140, 200)}
        ${angel(170, 150, .8, 0, 'trumpet')}${angel(640, 130, -.8, .9, 'trumpet')}
        ${peter(560)}
        ${cloudBank(440)}
        <path d="M280,520 L340,400 L460,400 L520,520Z" fill="rgba(255,250,225,.5)"/>
        ${steps}
        <g class="jrise">${ghost(400, 520, 1.3)}</g>
      </svg>`);
    await say('閻羅王合上生死簿：「你不屬於地府。看，有人來接你了。」');
    await say('一道溫暖的光從天上灑下來，你的身體變得好輕、好輕。');
    setParticles('feathers');
    tone(392, 1.6, { gain: 0.04, type: 'triangle' }); tone(523, 2, { gain: 0.04, type: 'triangle', delay: .5 });
    await say('天使吹響號角，在你面前放下一道光的階梯。《創世記》裡，雅各曾在夢中看見這樣的天梯，天使在上面上上下下。');
    await say('階梯的盡頭是一道發光的大門。《啟示錄》說，天城的十二道門，每一道都是一整顆珍珠。');
    await say('門前站著一位白鬍子老人，手裡拿著金鑰匙——是聖彼得。傳說耶穌把「天國的鑰匙」交給了他。');
    await say('他翻開厚厚的《生命冊》，找到了你的名字，笑著點點頭：「歡迎回家。」');
    layer.querySelector('svg').classList.add('open');
    chime();
    await say('珍珠門緩緩打開了。');
  }

  async function sReunion() {
    let flowers = '';
    for (let i = 0; i < 70; i++) {
      const c = ['#ff9ab0', '#ffd36a', '#ffffff', '#c9a6ff'][i % 4];
      flowers += `<circle cx="${(i * 97) % 800}" cy="${400 + (i * 53) % 115}" r="${3 + (i % 3)}" fill="${c}"/>`;
    }
    const rainbow = ['#ff8a8a', '#ffc070', '#fff07a', '#8ae08a', '#7ac0ff', '#b08aff'].map((c, i) =>
      `<path d="M${380 + i * 9},372 A${210 - i * 9},${170 - i * 9} 0 0,1 ${800 - i * 9},372" fill="none" stroke="${c}" stroke-width="9" opacity=".7"/>`).join('');
    scene('彩虹橋', '散文詩〈彩虹橋〉', 'linear-gradient(#fff1d0, #ffe2b0 35%, #bfe0a0 70%, #86b870)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <circle cx="640" cy="90" r="60" fill="#fff6c0" filter="url(#jbigglow)"/>
        ${rainbow}
        <path d="M0,360 Q200,300 420,350 T800,330 L800,520 L0,520Z" fill="#a8d488"/>
        <path d="M0,410 Q260,370 520,400 T800,390 L800,520 L0,520Z" fill="#8cc070"/>
        ${flowers}
        <rect x="110" y="250" width="22" height="160" fill="#8a6a4a"/>
        <circle cx="120" cy="230" r="70" fill="#7ab060"/><circle cx="70" cy="262" r="45" fill="#6aa050"/><circle cx="172" cy="258" r="50" fill="#88c070"/>
        ${ghost(290, 455, 1.1)}
        ${ghost(530, 445, 1.05, '255,226,190')}${ghost(610, 435, 0.9, '255,236,210')}${ghost(690, 450, 1.1, '255,220,200')}
        <g filter="url(#jglow)"><g class="jbob" style="animation-delay:.6s">
          <ellipse cx="455" cy="440" rx="22" ry="12" fill="rgba(255,236,210,.85)"/><circle cx="433" cy="427" r="11" fill="rgba(255,236,210,.9)"/>
          <path d="M426,419 l-4,-9 l9,5Z M438,418 l2,-10 l6,8Z" fill="rgba(255,236,210,.9)"/>
          <path d="M476,434 q12,-10 8,-20" stroke="rgba(255,236,210,.9)" stroke-width="4" fill="none"/>
        </g></g>
      </svg>`);
    await say('你沿著小路走，來到一片看不到盡頭的草原，空氣裡有你最喜歡的味道。');
    await say('遠遠地，有人在向你揮手。是那些比你先離開的人，他們看起來年輕又健康，好像從來沒有老過。');
    await say('草原的另一頭架著一道彩虹。西方有一首散文詩說：寵物離開人世以後，會在彩虹橋邊的草原上奔跑，等主人來。');
    await say('小時候養的那隻狗認出了你，搖著尾巴朝你飛奔過來。');
    await say('「我們一直在等你。」');
  }

  async function sCity() {
    const FRUIT = ['#ff6a6a', '#ffb040', '#ffe040', '#8ad050', '#40c0a0', '#50a0ff', '#8a70ff', '#e070d0', '#ff8ab0', '#ffd0a0', '#c0f080', '#a0e0ff'];
    const tree = (x, y) => `<rect x="${x - 8}" y="${y - 70}" width="16" height="74" fill="#8a6a3a"/>
      <circle cx="${x}" cy="${y - 100}" r="52" fill="#6ab860"/><circle cx="${x - 34}" cy="${y - 80}" r="30" fill="#5aa850"/><circle cx="${x + 34}" cy="${y - 82}" r="32" fill="#78c468"/>
      ${FRUIT.map((c, i) => `<circle cx="${x + Math.cos(i * 0.52) * (24 + (i % 3) * 12)}" cy="${y - 96 + Math.sin(i * 0.52) * (18 + (i % 2) * 10)}" r="6" fill="${c}"/>`).join('')}`;
    const towers = [[150, 120, 60], [250, 80, 50], [340, 50, 60], [460, 60, 52], [550, 90, 56], [650, 130, 54]].map(([x, top, w]) =>
      `<rect x="${x - w / 2}" y="${top}" width="${w}" height="${230 - top}" fill="#f6d870" stroke="#d8a830" stroke-width="2"/>
       <path d="M${x - w / 2},${top} Q${x},${top - w * .9} ${x + w / 2},${top}Z" fill="#ffe8a0" stroke="#d8a830" stroke-width="2"/>
       ${[0, 1, 2].map(k => `<rect class="jwindow" style="animation-delay:${(x + k) % 7 / 3}s" x="${x - 6}" y="${top + 20 + k * 40}" width="12" height="22" rx="6" fill="#fffbe8"/>`).join('')}`).join('');
    const gate = x => `<path d="M${x - 26},360 L${x - 26},314 A26,26 0 0,1 ${x + 26},314 L${x + 26},360Z" fill="url(#jpearl)" stroke="#e8c060" stroke-width="3"/>`;
    scene('新耶路撒冷', '《聖經・啟示錄》第 21–22 章', 'linear-gradient(#fffaf0, #fff0c8 40%, #ffe6b0 70%, #e8d0a0)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <ellipse cx="400" cy="150" rx="320" ry="130" fill="#fffbe0" filter="url(#jbigglow)"/>
        ${towers}
        ${jasperWall(70, 230, 660, 130)}
        ${gate(220)}${gate(400)}${gate(580)}
        <path d="M380,360 L420,360 Q470,440 560,520 L240,520 Q330,440 380,360Z" fill="#bfe8ff" stroke="#e8f8ff" stroke-width="2"/>
        <path class="jwave" d="M400,370 Q380,430 330,520" stroke="#fff" stroke-width="2" fill="none"/>
        <path class="jwave" style="animation-delay:-1s" d="M400,370 Q420,430 470,520" stroke="#fff" stroke-width="2" fill="none"/>
        <path d="M0,400 L380,360 Q330,440 240,520 L0,520Z M800,400 L420,360 Q470,440 560,520 L800,520Z" fill="#e8c860" opacity=".55"/>
        ${tree(150, 500)}${tree(650, 500)}
        ${ghost(300, 500, .8)}
      </svg>`);
    chime();
    await say('天使帶你走進天堂的中心——一座發光的城，新耶路撒冷。');
    await say('《啟示錄》這樣描寫它：城牆是碧玉造的，城是純金的，好像明淨的玻璃；連街道都是用精金鋪成的。');
    await say('城裡不需要太陽，也不需要月亮，因為神的榮光照亮了一切。');
    await say('一條明亮如水晶的生命河從城中流出。河的兩岸長著生命樹，一年結十二次果子，每個月都有新的果實。');
    await say('你摘下一顆果子。咬下去的那一刻，你身上最後一點疲憊也消失了。');
  }

  async function sChoir() {
    const layer = scene('天使詩班', '《聖經・以賽亞書》＋《啟示錄》', 'linear-gradient(#5a6ab8, #9a8ad8 40%, #f0c8e0 78%, #fff4e4)', 'feathers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="400" cy="60" rx="260" ry="80" fill="#fff8e0" opacity=".5" filter="url(#jbigglow)"/>
        ${cloudBank(250, '#fff6fa')}
        ${angel(110, 230, .9, 0, 'harp')}${angel(250, 180, 1, .6, 'harp')}${angel(550, 180, -1, 1.2, 'harp')}${angel(690, 230, -.9, .3, 'harp')}
        ${angel(400, 150, .8, .9, 'trumpet')}
        ${cloudBank(470, '#fff')}
        <g class="jhalo" style="opacity:0;transition:opacity 1.5s">
          <path d="M374,420 L360,486 L440,486 L426,420 Q400,410 374,420Z" fill="#fff" stroke="#e8dcc0" stroke-width="2"/>
          <ellipse cx="400" cy="378" rx="18" ry="5" fill="none" stroke="#ffd860" stroke-width="4" filter="url(#jglow)"/>
        </g>
        ${ghost(400, 470, .9)}
      </svg>`);
    const sing = () => [[523, 659, 784], [587, 740, 880], [523, 659, 784]].forEach((ch, i) =>
      ch.forEach(f => tone(f, 1.4, { gain: 0.025, type: 'triangle', delay: i * 1.1 })));
    sing();
    await say('空中傳來歌聲。成千上萬的天使站在雲上，彈著豎琴。');
    await say('他們齊聲唱著：「聖哉！聖哉！聖哉！」——這是《以賽亞書》和《啟示錄》裡，天使日夜不停的讚美。');
    layer.querySelector('.jhalo').style.opacity = 1;
    chime();
    await say('一位天使為你披上潔白的長袍。你的頭上，也亮起了一圈光環。');
    await say('你發現，自己竟然也會唱這首歌。');
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
    const layer = scene('你的星座', '希臘神話・星座傳說', 'linear-gradient(#070a22, #1c1840 60%, #3a2856)', 'stars',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">
        ${lines}${stars}
        <text class="cname" x="400" y="400" font-size="32" fill="#ffe9a8" text-anchor="middle" letter-spacing="8" filter="url(#jglow)" style="opacity:0;transition:opacity 1.5s">${esc(d.name)}座</text>
        <path d="M0,470 Q400,430 800,470 L800,520 L0,520Z" fill="#fff" opacity=".12"/>
        ${angel(150, 490, .6, 0)}${ghost(230, 495, .6)}
      </svg>`);
    const cs = layer.querySelectorAll('.cs'), cl = layer.querySelectorAll('.cl');
    await say('有一天，你的守護天使帶你飛到了天堂的最外圍，那裡是一整片星空。');
    await say('「你看，」天使說，「你在人間做過的每一件好事，都變成了天上的一顆星。」');
    for (let i = 0; i < n; i++) {
      cs[i].style.opacity = 1;
      if (i > 0) cl[i - 1].style.opacity = 1;
      show(`✦ ${good[i].stage}：${good[i].choice}`);
      tone(523 + i * 66, 0.9, { gain: 0.03, type: 'triangle' });
      await wait(1600, true);
    }
    layer.querySelector('.cname').style.opacity = 1;
    chime();
    await say(`${n} 顆星連成了一個星座。就像希臘神話裡被放上夜空的英雄，它從此叫做「${d.name}座」。`);
    await say('每當人間有人抬頭看見它，心裡就會湧起一點點想做好事的勇氣。');
  }

  /** 但丁《天堂篇》的最高天：所有得救的靈魂坐在一朵光的玫瑰上 */
  async function sRose() {
    let tiers = '';
    for (let i = 0; i < 7; i++) {
      const cy = 280 + i * 30, rx = 110 + i * 46, ry = 26 + i * 9, count = 12 + i * 4;
      tiers += `<ellipse cx="400" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(255,240,220,${.06 + i * .02})" stroke="rgba(255,230,180,.5)" stroke-width="1.5"/>`;
      for (let k = 0; k < count; k++) {
        const a = k / count * Math.PI * 2, px = 400 + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
        const rot = Math.atan2(Math.sin(a) * ry, Math.cos(a) * rx) * 180 / Math.PI + 90;
        tiers += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="9" ry="16" fill="${k % 2 ? '#fff4f0' : '#ffe0e8'}" opacity="${.55 + i * .06}" transform="rotate(${rot.toFixed(0)} ${px.toFixed(1)} ${py.toFixed(1)})"/>
          <circle cx="${px.toFixed(1)}" cy="${(py - 6).toFixed(1)}" r="2.5" fill="#fffbe8" filter="url(#jglow)"/>`;
      }
    }
    let rays = '';
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2, b = a + 0.08;
      rays += `<polygon points="400,190 ${400 + Math.cos(a) * 700},${190 + Math.sin(a) * 700} ${400 + Math.cos(b) * 700},${190 + Math.sin(b) * 700}" fill="rgba(255,240,190,.1)"/>`;
    }
    scene('天上的玫瑰', '但丁《神曲・天堂篇》＋《聖經・啟示錄》', 'radial-gradient(circle at 50% 35%, #fff0c0, #e8b860 35%, #7a4a20 75%, #2a1408)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <g style="transform-box:view-box;transform-origin:400px 190px;animation:jspin 90s linear infinite">${rays}</g>
        ${tiers}
        <circle cx="400" cy="190" r="90" fill="#fffbe8" filter="url(#jbigglow)"/>
        <circle cx="400" cy="190" r="34" fill="#fff"/>
        ${ghost(470, 482, .55)}${ghost(430, 486, .5, '255,236,210')}${ghost(510, 484, .5, '255,226,190')}
      </svg>`);
    chime();
    await say('最後，你來到了天堂的最高處。');
    await say('但丁在《神曲・天堂篇》的結尾寫道：所有得救的靈魂，都坐在一朵巨大的光之玫瑰上，一層層的花瓣，就是一排排的座位。');
    await say('玫瑰的中心，是一道比太陽還亮、卻一點也不刺眼的光。');
    await say('《啟示錄》說：神要擦去他們一切的眼淚；不再有死亡，也不再有悲哀、哭號、疼痛。');
    await say('你在屬於自己的那片花瓣上坐下。身邊，是你所愛的人。');
    await say('「是愛，推動了太陽和其他的星辰。」——這是《神曲》的最後一句。');
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
    hell.total = days;
    await say(`判官提筆一揮：你要在地獄待上 ${days} 天，等業力回到 0，才能離開。`);
    await say('「不過，」判官抬起頭，「你在地府怎麼過日子，也會記進這本帳裡。」');
  }

  async function sRise(d) {
    const depth = hellDepth(d.karma), { total, lived } = hell;
    if (total <= lived) return;
    const layer = scene('贖罪', '民間信仰・十八層地獄', 'radial-gradient(ellipse at 50% 92%, #7a1808, #220404 50%, #050101)', 'embers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        ${funnelRings()}
        <text class="rl" x="400" y="60" font-size="46" fill="#ff7a5a" text-anchor="middle" dominant-baseline="middle" font-weight="900" letter-spacing="8" filter="url(#jglow)">第 ${depth} 層</text>
        <text class="rd" x="400" y="108" font-size="20" fill="#ffd0c0" text-anchor="middle" dominant-baseline="middle"></text>
        <g class="rg">${ghost(400, 440, .9)}</g>
      </svg>`);
    const rl = layer.querySelector('.rl'), rd = layer.querySelector('.rd'), rg = layer.querySelector('.rg');
    const k0 = Math.round(d.karma * (1 - lived / total));
    await say(`剩下的 ${total - lived} 天，日子就這樣重複著：點卯、受刑、勞役、睡覺。`);
    show('每受一天刑，罪就輕了一點……');
    await animate(Math.min(6500, 2500 + (total - lived) * 200), t => {
      rl.textContent = `第 ${Math.max(1, Math.round(depth - (depth - 1) * t))} 層`;
      rd.textContent = `第 ${Math.round(lived + (total - lived) * t)} 天　業力 ${fmt(Math.round(k0 * (1 - t)))}`;
      rg.setAttribute('transform', `translate(0 ${-t * 250})`);
    });
    chime();
    await say(`第 ${total} 天，你的業力終於回到了 0。刑期滿了。`);
  }

  async function sJizo() {
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
    await say('「去吧，到奈何橋喝碗孟婆湯，重新做人。這一次，要好好過。」');
  }

  // ================= 死後的生活 =================
  let diary = [];                       // 死後生活的日記，結局畫面會列出來
  const hell = { total: 0, lived: 0 };  // 地獄刑期：總天數、已經過了幾天
  const HELL_LIVE_DAYS = 3;             // 地獄裡詳細演出的天數（剩下的快轉）
  const HEAVEN_DAYS = 4;                // 天堂裡可以自己安排的天數

  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  /** 大大的「第 N 天」字卡 */
  function dayCard(big, small, bg, color, mode) {
    return scene('', '', bg, mode, `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">
      <text x="400" y="220" font-size="68" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-weight="900" letter-spacing="14" filter="url(#jglow)">${esc(big)}</text>
      <text x="400" y="296" font-size="20" fill="${color}" opacity=".8" text-anchor="middle" dominant-baseline="middle" letter-spacing="4">${esc(small)}</text></svg>`);
  }

  // ---------- 天堂的圖畫零件 ----------
  function lion(x, y, s = 1) {
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="0" rx="70" ry="26" fill="#e0a848"/>
      <path d="M64,-4 Q100,-10 104,-34" stroke="#e0a848" stroke-width="6" fill="none"/><circle cx="104" cy="-36" r="7" fill="#a8641c"/>
      <rect x="-60" y="14" width="40" height="12" rx="6" fill="#e0a848"/><rect x="20" y="14" width="44" height="12" rx="6" fill="#e0a848"/>
      <circle cx="-70" cy="-22" r="38" fill="#a8641c"/>
      <circle cx="-74" cy="-20" r="25" fill="#ecb858"/>
      <path d="M-86,-24 q5,4 10,0 M-70,-24 q5,4 10,0" stroke="#5a3a1a" stroke-width="2.5" fill="none"/>
      <ellipse cx="-74" cy="-12" rx="6" ry="4" fill="#6a3a1a"/>
      <path d="M-80,-4 q6,5 12,0" stroke="#6a3a1a" stroke-width="2" fill="none"/></g>`;
  }

  function lamb(x, y, s = 1) {
    let wool = '';
    for (let i = 0; i < 7; i++) wool += `<circle cx="${-26 + i * 9}" cy="${-8 + (i % 2) * 8}" r="13" fill="#fffdf6" stroke="#e8e0d0"/>`;
    return `<g transform="translate(${x} ${y}) scale(${s})">${wool}
      <ellipse cx="38" cy="-10" rx="11" ry="9" fill="#3a3030"/><ellipse cx="30" cy="-16" rx="6" ry="3" fill="#3a3030" transform="rotate(-30 30 -16)"/>
      <path d="M33,-11 q3,2 6,0" stroke="#fff" stroke-width="1.5" fill="none"/></g>`;
  }

  /** 天堂的家：每一件好事是一個亮著燈的房間 */
  function mansion(n) {
    const rooms = Math.max(1, n), cols = Math.min(4, rooms), rows = Math.ceil(rooms / 4);
    const w = 150 + cols * 74, h = 110 + rows * 74, x0 = 400 - w / 2, base = 440, top = base - h;
    let win = '';
    for (let i = 0; i < rooms; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const rowCount = r === rows - 1 ? rooms - r * cols : cols;
      const wx = 400 - (rowCount * 74) / 2 + c * 74 + 17;
      win += `<rect class="mw" x="${wx}" y="${top + 26 + r * 74}" width="40" height="52" rx="20" fill="#9a8a6a" stroke="#e8c060" stroke-width="2" style="transition:fill .8s"/>`;
    }
    let cols2 = '';
    for (let i = 0; i <= cols + 1; i++) cols2 += `<rect x="${x0 + 8 + i * (w - 28) / (cols + 1)}" y="${top}" width="12" height="${h}" fill="#fff8e0" stroke="#e8d0a0"/>`;
    return `<rect x="${x0}" y="${top}" width="${w}" height="${h}" fill="#fff4d8" stroke="#e8c060" stroke-width="3"/>
      ${cols2}
      <path d="M${x0 - 20},${top} L400,${top - 70 - cols * 6} L${x0 + w + 20},${top}Z" fill="#f2c94c" stroke="#d8a830" stroke-width="3"/>
      <circle cx="400" cy="${top - 36 - cols * 3}" r="14" fill="#fffbe8" filter="url(#jglow)"/>
      ${win}
      <path d="M375,${base} L375,${base - 46} A25,25 0 0,1 425,${base - 46} L425,${base}Z" fill="url(#jpearl)" stroke="#e8c060" stroke-width="3"/>
      <rect x="${x0 - 30}" y="${base}" width="${w + 60}" height="10" fill="#e8c060"/>`;
  }

  // ---------- 天堂：你的家 ----------
  async function sMansion(d) {
    const good = goodDeeds(d);
    let flowers = '';
    for (let i = 0; i < 40; i++) flowers += `<circle cx="${(i * 89) % 800}" cy="${462 + (i * 31) % 50}" r="${3 + i % 3}" fill="${['#ff9ab0', '#ffd36a', '#fff', '#c9a6ff'][i % 4]}"/>`;
    const layer = scene('你在天上的家', '《聖經・約翰福音》14:2 ＋《馬太福音》6:20', 'linear-gradient(#fff8e8, #ffeccc 45%, #e8e0f8)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        ${sunRays(14, .12)}
        <path d="M0,450 Q400,420 800,450 L800,520 L0,520Z" fill="#b8e0a0"/>
        ${mansion(good.length)}
        ${flowers}
        ${angel(150, 420, .7, 0)}${ghost(230, 470, .7)}
      </svg>`);
    const wins = layer.querySelectorAll('.mw');
    await say('進了天門，天使帶你走過一條開滿花的小路，停在一棟房子前。');
    await say('耶穌說過：「在我父的家裡有許多住處。」每一個來到天堂的人，都有一個自己的家。');
    await say('「你在人間做的每一件好事，」天使說，「都是存在天上的財寶。這個家，就是用它們蓋起來的。」');
    if (!good.length) {
      wins[0].style.fill = '#fff4b0';
      await say('你這一生沒有做過什麼壞事，但也沒有特別做過什麼好事。所以，你的家只有一個房間。');
      await say('「不過別擔心，」天使笑著說，「在天堂，房子是可以慢慢加蓋的。」');
    } else {
      show('窗戶一扇一扇地亮了起來……（點一下可以加快）');
      for (let i = 0; i < good.length; i++) {
        wins[i].style.fill = '#fff4b0';
        wins[i].setAttribute('filter', 'url(#jglow)');
        tone(523 + i * 66, 0.8, { gain: 0.03, type: 'triangle' });
        show(`第 ${i + 1} 個房間：${good[i].stage}時，你「${good[i].choice}」`);
        await wait(1700, true);
      }
      await say(good.length >= 4 ? `你的家大得像一座宮殿，${good.length} 個房間，每一扇窗都亮著燈。` : `你的家有 ${good.length} 個房間，每一扇窗都亮著溫暖的燈。`);
    }
    chime();
    await say('你推開門。門口擺著一雙拖鞋，大小剛剛好。從今天起，這裡就是你永遠的家。');
  }

  // ---------- 天堂：可以自己安排的日子 ----------
  async function hFeast() {
    let seats = '';
    for (let i = 0; i < 6; i++) {
      const t = i / 5, y = 340 + t * 110, hw = 250 + t * 110;
      seats += ghost(400 - hw - 10, y + 30, .45 + t * .35, '255,236,210') + ghost(400 + hw + 10, y + 30, .45 + t * .35, '255,226,200');
      seats += `<circle cx="${400 - hw * .7}" cy="${y - 4}" r="${5 + t * 4}" fill="#8a4ab0"/><circle cx="${400 - hw * .7 + 8}" cy="${y - 2}" r="${5 + t * 4}" fill="#9a5ac0"/>
        <path d="M${400 + hw * .6},${y} l-${6 + t * 4},-${18 + t * 10} h${12 + t * 8}Z" fill="#f0c040"/>
        <ellipse cx="${400 + hw * .25}" cy="${y}" rx="${16 + t * 8}" ry="${7 + t * 3}" fill="#d8a060"/>`;
    }
    scene('羔羊的婚筵', '《聖經・啟示錄》19:9 ＋《路加福音》14、16 章', 'linear-gradient(#fff6e0, #f8e0b0 50%, #e8c890)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        ${sunRays(12, .1)}
        ${[90, 230, 570, 710].map(x => `<rect x="${x - 16}" y="60" width="32" height="300" fill="#fff8e8" stroke="#e8d0a0"/>`).join('')}
        <path d="M60,60 Q230,0 400,40 Q570,0 740,60" fill="none" stroke="#e8c060" stroke-width="8"/>
        <polygon points="250,330 550,330 760,500 40,500" fill="#fffdf6" stroke="#e8c060" stroke-width="3"/>
        ${seats}
        ${angel(700, 300, -.7, .4)}${ghost(400, 515, 1)}
      </svg>`);
    chime();
    await say('今天，天堂有一場盛大的宴席。《啟示錄》說：「凡被請赴羔羊之婚筵的，有福了。」');
    await say('長長的餐桌一眼望不到盡頭，桌上擺滿了剛出爐的麵包、成串的葡萄，杯子裡的酒永遠倒不完。');
    const pick = await ask('你要坐在哪裡？', ['🪑 坐在最末尾的位子', '👑 直接坐到最前面']);
    if (pick === 0) {
      await say('主人走過來，拍拍你的肩膀：「朋友，請上座。」');
      await say('耶穌講過這個比喻：赴宴時要坐在末位，主人自然會請你上座。「凡自高的，必降為卑；自卑的，必升為高。」');
    } else {
      await say('主人溫和地說：「這個位子是留給別人的。」你紅著臉換到了後面。');
      await say('不過沒關係。在天堂，沒有人會記仇，大家很快又笑成一團。');
    }
    await say('你的鄰座是一位穿著破衣服的老人，叫做拉撒路。《路加福音》說，他生前在財主門口討飯，死後被天使帶到了亞伯拉罕的懷裡。');
    await say('他舉起杯子對你笑：「在這裡，再也不會有人餓肚子了。」');
    return pick === 0 ? '赴天上的宴席，被主人請到了上座' : '赴天上的宴席，搶坐前排被請到了後面';
  }

  async function hGarden() {
    let grass = '';
    for (let i = 0; i < 50; i++) grass += `<circle cx="${(i * 71) % 800}" cy="${440 + (i * 37) % 70}" r="${3 + i % 3}" fill="${['#ff9ab0', '#fff', '#ffd36a'][i % 3]}"/>`;
    scene('伊甸園', '《聖經・創世記》第 2 章 ＋《以賽亞書》11:6', 'linear-gradient(#e8f8ff, #d0f0d0 50%, #90c878)', 'blossom',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <path d="M0,300 Q200,250 400,290 T800,280 L800,520 L0,520Z" fill="#9ad080"/>
        <path d="M380,290 Q340,380 200,520 L320,520 Q400,400 420,290Z" fill="#a8e0ff" stroke="#e8f8ff" stroke-width="2"/>
        <path class="jwave" d="M400,295 Q360,400 260,520" stroke="#fff" stroke-width="2" fill="none"/>
        <rect x="610" y="180" width="26" height="150" fill="#8a6a4a"/>
        <circle cx="623" cy="160" r="80" fill="#6ab860"/><circle cx="570" cy="200" r="50" fill="#5aa850"/><circle cx="680" cy="196" r="55" fill="#78c468"/>
        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<circle cx="${580 + (i * 23) % 90}" cy="${140 + (i * 31) % 90}" r="8" fill="#ff6a5a"/>`).join('')}
        ${grass}
        ${lion(560, 420, 1)}${lamb(600, 404, .8)}
        ${lamb(170, 440, .7)}${ghost(300, 480, .9)}
      </svg>`);
    await say('天使帶你來到一座開滿花的園子。一條河從園中流出，分成四道——就像《創世記》裡的伊甸園。');
    await say('以賽亞先知描寫過這樣的地方：「豺狼必與綿羊羔同居，豹子與山羊羔同臥……少壯獅子與牛犢同群，小孩子要牽引牠們。」');
    await say('一頭獅子正躺在樹下曬太陽，一隻小羊靠在牠身上，睡得正香。');
    const pick = await ask('你要做什麼？', ['🦁 摸摸獅子的鬃毛', '🐑 抱起小羊']);
    if (pick === 0) await say('獅子瞇起眼睛，喉嚨發出呼嚕呼嚕的聲音，像一隻超大的貓。');
    else await say('小羊軟綿綿的，身上有陽光的味道。牠在你懷裡打了個呵欠，又睡著了。');
    await say('一隻從來沒見過的鳥飛到你的肩膀上。天使說：「當年，亞當替每一種動物取了名字。這一隻剛剛誕生，還沒有名字，你來取吧。」');
    await say('你想了想，用一個你很想念的人的名字叫牠。');
    await say('那天下午，你靠著獅子睡了一個這輩子最安穩的午覺。');
    return pick === 0 ? '在伊甸園摸了獅子，替一隻新的鳥取了名字' : '在伊甸園抱著小羊午睡，替一隻新的鳥取了名字';
  }

  async function hFly() {
    const layer = scene('學飛', '《聖經・以賽亞書》40:31', 'linear-gradient(#6aa8f0, #a8d0ff 50%, #e8f4ff)', 'feathers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        ${cloudBank(120, '#fff')}${cloudBank(470, '#fff')}
        <g class="fg" transform="translate(0 0)">
          <path d="M386,402 Q340,360 320,400 Q344,396 356,416Z M414,402 Q460,360 480,400 Q456,396 444,416Z" fill="#fff" stroke="#e8dcc0" stroke-width="1.5"/>
          ${ghost(400, 470, .9)}</g>
        ${angel(220, 360, .9, 0)}${angel(620, 300, -.8, .8)}
      </svg>`);
    const fg = layer.querySelector('.fg');
    await say('早上醒來，你發現背上長出了一對小小的翅膀。');
    await say('一位天使來教你飛。《以賽亞書》說：「他們必如鷹展翅上騰；他們奔跑卻不困倦，行走卻不疲乏。」');
    await animate(900, t => fg.setAttribute('transform', `translate(0 ${-Math.sin(t * Math.PI) * 60})`));
    await say('第一次，你撲了兩下翅膀，就一頭栽進雲裡。雲軟軟的，一點都不痛。');
    await animate(3000, t => fg.setAttribute('transform', `translate(${Math.sin(t * 6) * 40} ${-t * 300})`));
    await say('第二次，你飛起來了！穿過一層又一層的雲，風從耳邊呼呼吹過。');
    await say('你飛得比任何飛機都還要高。小時候夢見過的事，原來在這裡實現了。');
    return '學會了用翅膀飛';
  }

  async function hEarth(d) {
    const best = [...goodDeeds(d)].sort((a, b) => b.karma - a.karma)[0];
    let town = '';
    for (let i = 0; i < 11; i++) {
      const x = 180 + i * 42, h = 30 + (i * 29 % 50);
      town += `<rect x="${x}" y="${400 - h}" width="34" height="${h}" fill="#2a3048"/>`;
      if (i % 2) town += `<rect x="${x + 12}" y="${410 - h}" width="10" height="10" fill="#ffd27a"/>`;
    }
    const layer = scene('從雲縫看人間', '《聖經・馬太福音》18:10', 'linear-gradient(#fff8e8, #ffeccc)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <ellipse cx="400" cy="330" rx="270" ry="130" fill="#141a30"/>
        <circle cx="560" cy="250" r="16" fill="#f2ecd0"/>
        ${town}
        <rect class="jwindow" x="380" y="348" width="16" height="14" fill="#ffd27a" filter="url(#jglow)"/>
        <g class="rb" style="opacity:0;transition:opacity 2s">${['#ff8a8a', '#ffc070', '#fff07a', '#8ae08a', '#7ac0ff'].map((c, i) =>
          `<path d="M${230 + i * 7},400 A${170 - i * 7},${130 - i * 7} 0 0,1 ${570 - i * 7},400" fill="none" stroke="${c}" stroke-width="6" opacity=".8"/>`).join('')}</g>
        <path d="M0,0 H800 V520 H0Z M130,330 A270,130 0 1,0 670,330 A270,130 0 1,0 130,330Z" fill="#fffaf0" fill-rule="evenodd"/>
        ${Array.from({ length: 28 }, (_, i) => { const a = i / 28 * Math.PI * 2; return `<circle cx="${(400 + Math.cos(a) * 275).toFixed(0)}" cy="${(330 + Math.sin(a) * 135).toFixed(0)}" r="${26 + (i * 7) % 18}" fill="#fffaf0"/>`; }).join('')}
        ${cloudBank(440, '#fffaf0')}
        ${ghost(160, 480, .8)}${angel(640, 470, -.6, .3)}
      </svg>`);
    await say('你趴在一朵雲的邊上，輕輕撥開雲層——下面就是人間。');
    await say('你一下就找到了你的家。家人圍坐在餐桌旁，桌上多擺了一副碗筷，是留給你的。');
    await say('耶穌說過，每個人的天使，都常在天上看著他們。你看見一位守護天使，靜靜站在你家人的身後。');
    const pick = await ask('你想為他們做點什麼？', ['🌈 請天使在他們窗外掛一道彩虹', '💭 送他們一個夢，告訴他們你很好']);
    if (pick === 0) {
      layer.querySelector('.rb').style.opacity = 1;
      chime();
      await say('不久，你的家人走到窗邊，指著天上的彩虹。這是你離開以後，他們第一次笑出來。');
    } else {
      await say('那天晚上，家人夢見了你。夢裡的你年輕又健康，笑著跟他們揮手。');
      await say('他們醒來時枕頭是濕的，心裡卻輕鬆了好多。');
    }
    if (best) await say(`你還看見，${best.stage}時被你幫助過的那個人，現在正用同樣的方式幫助著別人。`);
    return pick === 0 ? '從雲縫看見家人，請天使替他們掛了一道彩虹' : '從雲縫看見家人，送了他們一個好夢';
  }

  async function hElysium() {
    const column = x => `<rect x="${x - 12}" y="200" width="24" height="170" fill="#fffaf0" stroke="#e0d0b0"/>
      ${[0, 1, 2].map(k => `<line x1="${x - 6 + k * 6}" y1="204" x2="${x - 6 + k * 6}" y2="366" stroke="#e8dcc0"/>`).join('')}`;
    const olive = (x, y) => `<rect x="${x - 6}" y="${y - 60}" width="12" height="64" fill="#7a6a5a"/>
      <ellipse cx="${x}" cy="${y - 80}" rx="46" ry="34" fill="#8aa870"/><ellipse cx="${x - 26}" cy="${y - 64}" rx="26" ry="20" fill="#7a9860"/>`;
    scene('至福樂土', '希臘神話・荷馬《奧德賽》＋ 維吉爾《埃涅阿斯紀》第 6 卷', 'linear-gradient(#ffe8b8, #ffd890 40%, #c8e0a0 75%, #98c070)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <circle cx="160" cy="100" r="50" fill="#fff4c0" filter="url(#jbigglow)"/>
        <path d="M0,380 Q400,340 800,380 L800,520 L0,520Z" fill="#a8d080"/>
        <polygon points="420,160 640,160 530,110" fill="#fffaf0" stroke="#e0d0b0" stroke-width="2"/>
        <rect x="420" y="160" width="220" height="40" fill="#fff4e0" stroke="#e0d0b0"/>
        ${[440, 493, 547, 600].map(column).join('')}
        <rect x="410" y="370" width="240" height="14" fill="#f0e8d8"/>
        ${olive(120, 420)}${olive(740, 410)}
        ${ghost(300, 470, .9, '255,240,220')}
        <g transform="translate(300 400)"><path d="M10,-30 Q40,-60 34,-10 L14,-6Z" fill="none" stroke="#e8b840" stroke-width="3"/>
          ${[16, 22, 28].map(x => `<line x1="${x}" y1="-40" x2="${x - 4}" y2="-8" stroke="#fff" stroke-width="1"/>`).join('')}</g>
        ${ghost(180, 490, .7)}${ghost(560, 460, .65, '255,230,210')}${ghost(640, 470, .65, '255,236,220')}
      </svg>`);
    [392, 440, 494, 523, 494, 440].forEach((f, i) => tone(f, 0.9, { gain: 0.03, type: 'triangle', delay: i * 0.35 }));
    await say('天使說，天堂很大，連古希臘人想像的樂園也在這裡。你們穿過一片橄欖樹林，來到了「至福樂土」。');
    await say('荷馬在《奧德賽》裡說：這裡沒有雪，沒有暴風，也從不下雨，只有從大洋吹來的、輕柔的西風。');
    await say('維吉爾寫道：至福樂土有自己的太陽和星星。英雄們在草地上比賽摔角、賽跑，有人跳舞，有人唱歌。');
    await say('草地中央，一位穿長袍的樂手正在彈琴。他是奧菲斯——傳說他的琴聲能讓石頭流淚，連冥王都被他打動。');
    const pick = await ask('你要做什麼？', ['🏃 加入英雄們的賽跑', '🎶 坐下來聽奧菲斯彈琴']);
    if (pick === 0) {
      await say('你跑得飛快，膝蓋一點也不痛了。終點的英雄為你戴上一頂橄欖枝編成的花冠。');
    } else {
      await say('琴聲響起，你想起了人間所有美好的日子。你閉上眼睛，一首接著一首地聽，直到天上的星星亮起來。');
    }
    return pick === 0 ? '在至福樂土和古代英雄賽跑，得到一頂橄欖冠' : '在至福樂土聽奧菲斯彈了一整天的琴';
  }

  const HEAVEN_ACTS = [
    { label: '🌈 去彩虹橋邊的草原', fn: async d => { await sReunion(d); return '在彩虹橋邊，和先走一步的親人、小時候的狗重逢'; } },
    { label: '🏙 逛新耶路撒冷的黃金街', fn: async d => { await sCity(d); return '在黃金街散步，吃了生命樹的果子'; } },
    { label: '🎵 加入天使詩班', fn: async d => { await sChoir(d); return '加入天使詩班，得到了白袍和光環'; } },
    { label: '🍷 赴天上的宴席', fn: hFeast },
    { label: '🦁 去伊甸園看動物', fn: hGarden },
    { label: '🪽 跟天使學飛', fn: hFly },
    { label: '☁ 從雲縫看看人間的家人', fn: hEarth },
    { label: '🏛 拜訪希臘神話的至福樂土', fn: hElysium }
  ];
  const HEAVEN_MORNING = [
    '天堂沒有黑夜。《啟示錄》說：「不再有黑夜，他們也不用燈光、日光，因為主神要光照他們。」所以你醒來，不是因為天亮了，而是因為睡飽了。',
    '你在柔軟的床上醒來。不會腰痠，不會頭痛，連老花眼都好了。',
    '窗外有鳥在唱歌，是你從來沒聽過的旋律。門口有天使留下的字條：「今天想做什麼都可以。」',
    '在天堂住久了，你發現這裡沒有時鐘，也沒有人在趕時間。'
  ];

  async function sHeavenLife(d) {
    let pool = HEAVEN_ACTS.slice();
    for (let day = 1; day <= HEAVEN_DAYS; day++) {
      dayCard(`第 ${day} 天`, '天堂的日子', 'linear-gradient(#fffaf0, #ffeccc 55%, #e8e0f8)', '#b8862a', 'light');
      tone(784, 1.2, { gain: 0.03, type: 'triangle' });
      await wait(1500, true);
      await say(HEAVEN_MORNING[day - 1]);
      const opts = shuffle(pool).slice(0, 3);
      const act = opts[await ask('今天想去哪裡？', opts.map(a => a.label))];
      pool = pool.filter(a => a !== act);
      diary.push(`第 ${day} 天：${await act.fn(d)}`);
    }
  }

  /** 千年如一日：快轉 */
  async function sThousand() {
    const layer = scene('永遠', '《聖經・彼得後書》3:8', 'linear-gradient(#fff6e0, #f0e0f8 60%, #c8d8f8)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet">
        ${sunRays(16, .1)}
        <text class="tc" x="400" y="240" font-size="60" fill="#b8862a" text-anchor="middle" dominant-baseline="middle" font-weight="900" letter-spacing="6" filter="url(#jglow)"></text>
      </svg>`);
    const tc = layer.querySelector('.tc');
    await say('日子就這樣一天一天過去。宴席、花園、詩班、星空……每一天都不一樣，每一天都很好。');
    show('《彼得後書》說：「主看一日如千年，千年如一日。」');
    await animate(5000, t => {
      const days = Math.round(5 + Math.pow(t, 3) * 365000);
      tc.textContent = days < 365 ? `第 ${days} 天` : `第 ${Math.floor(days / 365)} 年`;
    });
    await say('不知道從哪一天開始，你不再數日子了。在天堂，時間不是拿來倒數的。');
  }

  // ---------- 地獄的圖畫零件 ----------
  function hungryGhost(x, y, s = 1) {
    const c = 'rgba(190,215,180,.75)';
    return `<g transform="translate(${x} ${y}) scale(${s})"><g class="jbob" style="animation-delay:${(x % 7) / 4}s">
      <path d="M-22,-24 L-34,4 M22,-24 L34,4 M-8,0 L-10,26 M8,0 L10,26" stroke="${c}" stroke-width="3"/>
      <ellipse cx="0" cy="-22" rx="26" ry="24" fill="${c}"/>
      <rect x="-3" y="-72" width="6" height="30" fill="${c}"/>
      <circle cx="0" cy="-80" r="12" fill="${c}"/>
      <circle cx="-4" cy="-82" r="2.5" fill="#111"/><circle cx="4" cy="-82" r="2.5" fill="#111"/>
      <ellipse cx="0" cy="-74" rx="2" ry="3" fill="#111"/></g></g>`;
  }

  /** 牢房：石牆、鐵欄杆、稻草 */
  function cellArt(extra = '') {
    let bricks = '';
    for (let r = 0; r < 12; r++) for (let c = 0; c < 9; c++)
      bricks += `<rect x="${c * 92 - (r % 2) * 46}" y="${r * 40}" width="90" height="38" fill="#1c1a1e" stroke="#2a2730"/>`;
    let bars = '';
    for (let i = 0; i < 9; i++) bars += `<rect x="${120 + i * 70}" y="40" width="9" height="420" fill="#3a3640" stroke="#55505e"/>`;
    return `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">${bricks}
      <rect x="560" y="70" width="90" height="70" fill="#06080a" stroke="#3a3640" stroke-width="4"/>
      <circle cx="605" cy="105" r="20" fill="#bfe8c8" opacity=".75" filter="url(#jglow)"/>
      <line x1="590" y1="70" x2="590" y2="140" stroke="#3a3640" stroke-width="4"/><line x1="620" y1="70" x2="620" y2="140" stroke="#3a3640" stroke-width="4"/>
      <ellipse cx="400" cy="470" rx="230" ry="26" fill="#6a5a30"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<line x1="${200 + i * 50}" y1="${462 + i % 3 * 6}" x2="${240 + i * 50}" y2="${470 - i % 2 * 6}" stroke="#9a8a50" stroke-width="2"/>`).join('')}
      ${extra}
      <rect x="110" y="30" width="600" height="14" fill="#3a3640"/><rect x="110" y="456" width="600" height="10" fill="#3a3640"/>
      ${bars}</svg>`;
  }

  // ---------- 地獄：酆都城 ----------
  async function sFengdu(d) {
    let roofs = '';
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 110, y = 150 + (i % 3) * 18;
      roofs += `<rect x="${x}" y="${y}" width="80" height="${240 - y}" fill="#140c10"/>
        <path d="M${x - 16},${y} Q${x + 40},${y - 26} ${x + 96},${y} Z" fill="#1e1218" stroke="#3a2028"/>
        <rect x="${x + 30}" y="${y + 20}" width="18" height="16" fill="#5aff9a" opacity=".35"/>`;
    }
    scene('酆都城', '民間傳說・鬼城酆都', 'linear-gradient(#050a08, #0c1612 55%, #050605)', 'fog',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <circle cx="660" cy="70" r="30" fill="#bfe8c8" opacity=".6" filter="url(#jglow)"/>
        ${roofs}
        <rect x="0" y="240" width="800" height="230" fill="#1a1416" stroke="#3a2a2a"/>
        ${Array.from({ length: 21 }, (_, i) => `<rect x="${i * 40}" y="222" width="26" height="20" fill="#1a1416" stroke="#3a2a2a"/>`).join('')}
        <path d="M320,470 L320,340 A80,80 0 0,1 480,340 L480,470Z" fill="#050303"/>
        <rect x="330" y="252" width="140" height="44" fill="#0c1410" stroke="#7a9a8a" stroke-width="2"/>
        <text x="400" y="275" font-size="26" fill="#a8d8c0" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="6">酆都城</text>
        ${lantern(150, 300, '#5aff9a', '冥')}${lantern(250, 300, '#5aff9a', '紙')}${lantern(550, 300, '#5aff9a', '茶')}${lantern(650, 300, '#5aff9a', '冥')}
        <rect x="0" y="470" width="800" height="50" fill="#0a0808"/>
        ${sinners([[360, 500, .55], [420, 505, .5], [470, 500, .55], [140, 505, .5]], '170,230,200')}
        ${ghost(250, 505, .75)}
        ${guards()}
      </svg>`);
    await say('牛頭和馬面押著你，來到地府的都城——酆都城。');
    await say('民間傳說，人死了都要到酆都報到。這裡跟人間的城市很像：有街道、有店鋪、有衙門。只是燈籠都是綠色的，路上走的全是鬼。');
    await say('街邊的紙紮鋪裡，擺著陽間燒下來的紙房子、紙汽車，甚至還有紙做的手機。');
    await say(`你被關進一間陰暗的牢房。門口掛著一塊木牌：「${d.name}，刑期 ${hell.total} 天」。`);
    await say('從明天開始，你就要在這裡過日子了。');
  }

  // ---------- 地獄：每一天 ----------
  const ROLLCALL = [
    ['地府沒有日出，也沒有雞啼。叫醒你的，是鬼差「噹——」的一聲銅鑼。', '所有罪魂排成一列，鬼差拿著名冊一個一個點名，這叫做「點卯」。'],
    ['噹——銅鑼又響了。你已經學會在第一聲鑼響時就站好。', '點完名，每個鬼都分到一塊木牌，上面寫著今天要去哪一層。'],
    ['點卯的時候，你發現隊伍裡少了幾張熟面孔。', '他們的刑期滿了，被帶去了奈何橋。你看著空出來的位子，心裡有點羨慕。']
  ];

  async function rollCall(d, day) {
    scene(`第 ${day} 天・清晨`, '民間信仰・鬼差點卯', 'radial-gradient(ellipse at 50% 90%, #3a0c08, #120303 60%, #050101)', 'fog',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <rect x="0" y="0" width="800" height="400" fill="#120808"/>
        <rect x="300" y="60" width="200" height="44" fill="#2a0808" stroke="#c9a040" stroke-width="2"/>
        <text x="400" y="83" font-size="22" fill="#e8c070" text-anchor="middle" dominant-baseline="middle" font-weight="bold" letter-spacing="6">陰司衙門</text>
        <rect x="0" y="400" width="800" height="120" fill="#1e1010"/>
        <g class="jbob"><line x1="560" y1="250" x2="560" y2="330" stroke="#8a6a3a" stroke-width="4"/>
          <circle cx="560" cy="290" r="30" fill="#c9a040" stroke="#8a6a20" stroke-width="4"/><circle cx="560" cy="290" r="8" fill="#8a6a20"/></g>
        ${imp(620, 470, 1.3, '#3a5a9a', true)}
        <rect x="220" y="300" width="70" height="90" fill="#e8dcc0" stroke="#8a6a3a" stroke-width="3"/>
        ${[0, 1, 2, 3, 4].map(i => `<line x1="232" y1="${318 + i * 14}" x2="278" y2="${318 + i * 14}" stroke="#5a3a1a" stroke-width="2"/>`).join('')}
        ${imp(180, 470, 1.2, '#5a3a8a')}
        ${sinners([[320, 500, .6], [380, 505, .6], [440, 500, .6], [500, 505, .6]])}
        ${ghost(440, 500, .62)}
      </svg>`);
    gong();
    const [a, b] = ROLLCALL[Math.min(day, ROLLCALL.length) - 1];
    await say(a);
    await say(b);
    if (day === 1) await say(`「${d.name}！」　「……到。」`);
  }

  async function torture(lv, deeds, day, seen) {
    hellScene(lv);
    if (lv === 6 || lv === 16 || lv === 9) tone(90, 1.2, { type: 'sawtooth', gain: 0.03, slide: .7 });
    const list = deeds.map(h => `「${h.choice}」`).join('、');
    if (seen) {
      await say(`今天，你又被押回了第 ${lv} 層，${HELL_LEVELS[lv - 1]}。同樣的刑罰，同樣的痛。`);
      await say(`受刑的時候，你一直想起自己生前${list}的那一刻。`);
    } else {
      if (day === 1) await say('點完卯，牛頭馬面押著你去「上工」——也就是受刑。');
      await say(`第 ${lv} 層，${HELL_LEVELS[lv - 1]}。因為你生前${list}——`);
      await say(HELL_DESC[lv - 1]);
      if (day === 1) await say('很痛，但是不會死——因為你早就已經死了。');
    }
  }

  // 每天下午會遇到的事。選擇會改變刑期：-1 減少、+1 增加、0 不變
  async function eMoney() {
    scene('紙錢', '民間信仰・燒紙錢', 'radial-gradient(ellipse at 50% 0%, #4a2a08, #1a0804 55%, #050101)', 'money',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <ellipse cx="400" cy="0" rx="300" ry="90" fill="#ff9a30" opacity=".35" filter="url(#jbigglow)"/>
        <rect x="0" y="440" width="800" height="80" fill="#1a0c08"/>
        ${ghost(400, 470, 1.1)}
        <g transform="translate(400 420)">${[0, 1, 2, 3].map(i => `<rect x="${-22 + i * 3}" y="${-i * 6}" width="44" height="26" fill="#e8c040" stroke="#a87a20"/><rect x="${-6 + i * 3}" y="${6 - i * 6}" width="12" height="12" fill="#c82a1a"/>`).join('')}</g>
        ${imp(590, 470, 1.3, '#3a5a9a', true)}
        ${hungryGhost(150, 470, 1)}${hungryGhost(230, 480, .85)}
      </svg>`);
    await say('中午，天上忽然飄下一大把黃色的紙片——是紙錢！');
    await say('原來，陽間的家人在為你燒紙錢。民間相信，燒給亡者的紙錢，到了陰間就能拿來花。');
    await say('一個鬼差湊過來，壓低聲音說：「有錢能使鬼推磨。分我一點，我讓你少受幾天罪。」');
    await say('角落裡，幾個瘦巴巴的孤魂野鬼盯著你手上的錢——他們已經很多年沒有人祭拜了。');
    const pick = await ask('你要怎麼用這筆錢？', ['💰 塞給鬼差，買通他', '🤲 分給沒人祭拜的孤魂野鬼', '🍵 自己去鬼市買碗熱湯']);
    if (pick === 0) {
      await say('鬼差收下錢，咧嘴一笑。可是當天晚上，判官就在帳簿上多記了一筆：「賄賂鬼差」。原來地府也是抓貪污的。');
      return { sign: 1, note: '用家人燒的紙錢賄賂鬼差，被判官多記了一筆' };
    }
    if (pick === 1) {
      await say('孤魂野鬼捧著紙錢，對你拜了又拜。判官在遠處看見了，提筆在帳簿上記了一行字。');
      return { sign: -1, note: '把家人燒的紙錢分給了孤魂野鬼' };
    }
    await say('你在鬼市買了一碗熱湯。湯沒有什麼味道，但捧在手裡，總算暖了一點。');
    return { sign: 0, note: '用紙錢在鬼市買了一碗熱湯' };
  }

  async function eFood() {
    scene('放飯', '佛教《盂蘭盆經》・目連救母', 'radial-gradient(ellipse at 50% 90%, #3a1a08, #120604 60%, #050101)', 'embers',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <rect x="0" y="440" width="800" height="80" fill="#1a0c08"/>
        <rect x="120" y="380" width="560" height="22" fill="#4a3220"/><rect x="140" y="400" width="14" height="50" fill="#3a2418"/><rect x="646" y="400" width="14" height="50" fill="#3a2418"/>
        ${[220, 340, 460, 580].map(x => `<path d="M${x - 30},378 Q${x},404 ${x + 30},378Z" fill="#5a4a3a"/>`).join('')}
        <g transform="translate(400 330)"><path d="M-36,0 Q0,40 36,0Z" fill="#5a4a3a" stroke="#8a7a6a"/>
          <path class="jflame" d="M-18,0 Q-10,-30 0,-56 Q10,-30 18,0Z" fill="#ff7a1a"/><path class="jflame" style="animation-delay:.2s" d="M-8,0 Q-4,-16 0,-30 Q4,-16 8,0Z" fill="#ffd040"/></g>
        ${ghost(400, 470, 1)}
        ${hungryGhost(560, 460, 1.1)}${hungryGhost(220, 470, .9)}${hungryGhost(680, 480, .8)}
        ${imp(110, 470, 1.1, '#2a6a5a')}
      </svg>`);
    await say('放飯的時間到了。鬼差提著一桶飯，倒進每個罪魂的碗裡。');
    await say('你餓得發慌，捧起碗就往嘴裡扒——飯一碰到嘴唇，竟然「轟」地燒成了火炭！');
    shake();
    rumble();
    await say('旁邊的老鬼苦笑：「沒用的。佛經裡說，目連的母親生前太貪心，死後成了餓鬼。目連捧飯給她，飯還沒進嘴就變成了火。」');
    await say('「在這裡，只顧著自己吃的飯，是吃不下去的。」');
    const pick = await ask('旁邊有一個瘦得只剩骨頭的餓鬼，碗裡什麼都沒有。', ['🍚 把你的飯讓給他', '😤 把他的空碗踢開，免得他跟你搶']);
    if (pick === 0) {
      await say('你把碗遞給他。奇怪的是，這一次飯沒有燒起來。他吃得狼吞虎嚥，你的肚子竟然也沒那麼餓了。');
      return { sign: -1, note: '把飯讓給了更餓的餓鬼' };
    }
    await say('你踢開他的碗，又扒了一口飯——滿嘴都是火。那個餓鬼縮回角落，一句話也沒說。');
    return { sign: 1, note: '欺負了一個餓鬼' };
  }

  async function eLabor() {
    let grooves = '';
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      grooves += `<line x1="400" y1="340" x2="${400 + Math.cos(a) * 150}" y2="${340 + Math.sin(a) * 40}" stroke="#55555a" stroke-width="3"/>`;
    }
    scene('鬼推磨', '民間俗語・有錢能使鬼推磨', 'radial-gradient(ellipse at 50% 90%, #4a1a0a, #160604 60%, #050101)', 'dust',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <rect x="0" y="440" width="800" height="80" fill="#1a0c08"/>
        <ellipse cx="400" cy="400" rx="170" ry="46" fill="#5a5a60" stroke="#3a3a3e" stroke-width="4"/>
        <rect x="230" y="340" width="340" height="60" fill="#6a6a70"/>
        <ellipse cx="400" cy="340" rx="170" ry="46" fill="#7a7a80" stroke="#4a4a4e" stroke-width="4"/>${grooves}
        <circle cx="400" cy="340" r="16" fill="#3a3a3e"/>
        <line x1="400" y1="340" x2="640" y2="300" stroke="#8a6a40" stroke-width="12" stroke-linecap="round"/>
        <g class="jbob">${ghost(600, 400, .9)}</g>
        <g class="jbob" style="animation-delay:.5s">${ghost(660, 410, .8, '200,200,190')}</g>
        ${imp(150, 470, 1.3, '#5a3a8a')}
        <path d="M180,360 Q230,320 260,350" stroke="#3a2010" stroke-width="4" fill="none"/>
      </svg>`);
    rumble();
    await say('下午是勞役時間。你被分去推石磨——這就是俗話說的「鬼推磨」。');
    await say('石磨重得像一座山，要好幾個鬼一起推才轉得動。');
    await say('跟你同一組的，是一個駝背的老鬼。他每推一步，腳都在發抖。');
    const pick = await ask('鬼差走開去喝茶了，你要怎麼做？', ['💪 多出點力，讓老鬼輕鬆一點', '😴 趁機偷懶']);
    if (pick === 0) {
      await say('你把肩膀頂在木桿上，用盡全身的力氣推。老鬼喘了口氣，小聲說了句「謝謝」。');
      await say('這是你來到地府以後，第一次有人跟你道謝。');
      return { sign: -1, note: '推磨時幫老鬼多出了一份力' };
    }
    await say('你偷偷放開手。石磨一沉，老鬼被壓得跪在地上。');
    await say('鬼差回來時剛好看見，「啪」的一鞭抽在你背上。');
    return { sign: 1, note: '推磨時偷懶，害老鬼被石磨壓倒' };
  }

  async function eSutra(d) {
    let lamps = '';
    for (let i = 0; i < 9; i++) {
      const x = 90 + i * 78, y = 400 + (i % 3) * 22;
      lamps += `<g class="jbob" style="animation-delay:${i * .3}s"><ellipse cx="${x}" cy="${y}" rx="20" ry="8" fill="#f0a0b8"/>
        <path d="M${x - 16},${y} Q${x - 10},${y - 22} ${x},${y - 26} Q${x + 10},${y - 22} ${x + 16},${y}Z" fill="#f8c8d8"/>
        <circle cx="${x}" cy="${y - 10}" r="5" fill="#ffe080" filter="url(#jglow)"/></g>`;
    }
    const layer = scene('超度', '民間信仰・誦經超度、盂蘭盆會', 'radial-gradient(ellipse at 50% 0%, #6a4a10, #1a0c04 55%, #050202)', 'light',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <polygon points="330,0 470,0 560,520 240,520" fill="rgba(255,220,140,.18)"/>
        <polygon points="370,0 430,0 470,520 330,520" fill="rgba(255,230,170,.18)"/>
        <rect x="0" y="440" width="800" height="80" fill="#140804" opacity=".8"/>
        ${lamps}
        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<text x="${330 + (i % 2) * 140}" y="${50 + i * 44}" font-size="22" fill="#ffe0a0" opacity=".6" text-anchor="middle">${'南無地藏王菩薩'[i]}</text>`).join('')}
        <g class="gk">${ghost(400, 470, 1)}</g>
        ${sinners([[230, 490, .6], [570, 490, .6], [650, 495, .55]])}
      </svg>`);
    [196, 196, 220, 196].forEach((f, i) => tone(f, 1, { gain: 0.04, type: 'triangle', delay: i * 0.7 }));
    await say('傍晚，地府的上空忽然傳來一陣誦經聲，一道金光從上面照了下來。');
    await say('是陽間的家人在寺廟裡為你誦經、點燈。民間相信，親人為亡者念的經，能減輕他在地獄受的苦。');
    await say(`金光照在身上，暖暖的。你聽見有人輕輕念著：「${d.name}，${d.name}……」`);
    const pick = await ask('你要怎麼做？', ['🙏 跪下來跟著念，誠心懺悔', '🙄 念經有什麼用，轉頭繼續發呆']);
    if (pick === 0) {
      layer.querySelector('.gk').setAttribute('filter', 'url(#jglow)');
      chime();
      await say('你跪下來，一句一句跟著念。念到後來，你哭了。');
      await say('這是你第一次，真心為自己做過的事感到抱歉。');
      return { sign: -1, note: '跟著家人的誦經聲，誠心懺悔' };
    }
    await say('金光慢慢暗了下去。家人的心意，你沒有接住。');
    return { sign: 0, note: '家人為你誦經，你卻轉過頭去' };
  }

  async function eGhostFest(d) {
    const worst = [...badDeeds(d)].sort((a, b) => a.karma - b.karma)[0];
    const person = (x, s, c = '#1a1a24') => `<g transform="translate(${x} 470) scale(${s})"><circle cx="0" cy="-92" r="16" fill="${c}"/><path d="M-22,0 L-18,-70 Q0,-80 18,-70 L22,0Z" fill="${c}"/></g>`;
    scene('中元節', '民間信仰・農曆七月十五、鬼門開', 'linear-gradient(#0a0c1c, #1c1a30 60%, #2a1a14)', 'stars',
      `<svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMax meet">
        <circle cx="640" cy="80" r="34" fill="#f8f0c0" filter="url(#jglow)"/>
        <rect x="380" y="200" width="320" height="270" fill="#2a2420"/>
        <polygon points="360,200 540,120 720,200" fill="#3a2a22"/>
        <rect x="430" y="260" width="70" height="60" fill="#ffc870" filter="url(#jglow)"/><rect x="580" y="260" width="70" height="60" fill="#ffc870" opacity=".8"/>
        ${lantern(420, 230, '#ff4a2a', '普')}${lantern(660, 230, '#ff4a2a', '渡')}
        <rect x="150" y="390" width="230" height="16" fill="#8a2a1a"/><rect x="160" y="404" width="12" height="66" fill="#6a2010"/><rect x="358" y="404" width="12" height="66" fill="#6a2010"/>
        ${[180, 220, 300, 340].map((x, i) => `<circle cx="${x}" cy="380" r="11" fill="${['#ff6a3a', '#ffd040', '#8ad050', '#ff6a3a'][i]}"/>`).join('')}
        <rect x="250" y="370" width="30" height="20" fill="#c8a060"/>
        ${[258, 265, 272].map((x, i) => `<line x1="${x}" y1="370" x2="${x}" y2="330" stroke="#c84a2a" stroke-width="2"/><path class="jsteam" style="animation-delay:${i * .7}s" d="M${x},328 q-5,-10 0,-20 q5,-10 0,-20" stroke="rgba(230,230,240,.6)" stroke-width="2" fill="none"/>`).join('')}
        <rect x="0" y="470" width="800" height="50" fill="#14100c"/>
        ${person(470, 1)}${person(540, .8)}${person(610, 1.05)}
        ${ghost(110, 470, .95)}
      </svg>`);
    chime();
    await say('今天是農曆七月十五，中元節。地府的鬼門大開，所有的鬼都可以回人間一趟。');
    await say('你飄回了家。門口擺著一張供桌，上面有你最愛吃的菜，香爐裡的香冒著細細的煙。');
    await say('家人雙手合十，對著供桌拜拜，嘴裡念著你的名字。他們看不見你，但你就站在他們旁邊。');
    if (worst) await say(`你忽然想起那件事——${worst.stage}時，你「${worst.choice}」。這些年，你從來沒跟任何人道過歉。`);
    const pick = await ask('天亮前就得回地府了。你要做什麼？', ['💭 托夢給家人，跟他們說對不起', '🍗 溜去偷吃隔壁人家的供品']);
    if (pick === 0) {
      await say('那天夜裡，你走進家人的夢裡，說出了那句生前一直說不出口的話。');
      await say('家人在夢裡抱住了你：「沒關係，我們都知道。」');
      return { sign: -1, note: '中元節回家，托夢跟家人道歉' };
    }
    await say('你偷吃了隔壁的供品，結果被人家的祖先追著打了三條街。');
    await say('回到地府，判官已經在帳簿上等著你了。');
    return { sign: 1, note: '中元節偷吃別人家的供品' };
  }

  const CELLMATES = [
    '他生前放高利貸，逼得好幾戶人家家破人亡。',
    '她生前總是在網路上匿名罵人，現在每天都要去拔舌地獄報到。',
    '他生前是個貪官，收了一輩子的紅包。',
    '她生前為了爭家產，跟親兄弟打了十年官司，到死都沒有和好。'
  ];

  async function eCellmate() {
    scene('牢房夜談', '民間信仰・陰司地府', 'linear-gradient(#06080a, #0c1210 60%, #050605)', 'dust',
      cellArt(`${ghost(300, 450, .9)}${ghost(560, 450, .85, '200,210,200')}`));
    await say('夜裡，隔壁牢房的罪魂隔著鐵欄杆跟你說話。');
    await say(CELLMATES[Math.floor(Math.random() * CELLMATES.length)]);
    await say('「我在這裡待了三百年了，」他說，「家人早就忘了我。沒有人燒錢給我，也沒有人替我念經。」');
    const pick = await ask('你要怎麼回答？', ['🤝 「我陪你聊聊吧。」', '🙈 翻過身假裝睡著']);
    if (pick === 0) {
      await say('你們聊了一整夜：聊人間的家，聊後悔的事，聊下輩子想當什麼樣的人。');
      await say('天快亮時，他說：「謝謝你。三百年來，我第一次覺得自己還像個人。」');
      return { sign: -1, note: '陪隔壁牢房的罪魂聊了一整夜' };
    }
    await say('你翻過身，背對著他。黑暗中，你聽見他一個人小聲地哭。');
    return { sign: 0, note: '假裝沒聽見隔壁罪魂的話' };
  }

  const HELL_EVENTS = [eMoney, eFood, eLabor, eSutra, eGhostFest, eCellmate];
  const NIGHT = [
    '你縮在牢房的稻草堆上。地府的夜很冷，四面八方都是罪魂的哭聲。',
    '你躺在稻草上，盯著窗外那顆綠色的月亮，想起了人間的家。',
    '今晚很安靜。你閉上眼睛，第一次在地府睡著了。'
  ];

  async function night(day, ev, change) {
    const layer = scene(`第 ${day} 天・夜晚`, '民間信仰・陰司地府', 'linear-gradient(#06080a, #0c1210 60%, #050605)', 'dust',
      cellArt(`${ghost(400, 450, .9)}
        <text class="nd" x="400" y="190" font-size="40" fill="#ffd0c0" text-anchor="middle" dominant-baseline="middle" font-weight="900" letter-spacing="4" filter="url(#jglow)">刑期 ${day} / ${hell.total - change} 天</text>`));
    const nd = layer.querySelector('.nd');
    await say(NIGHT[(day - 1) % NIGHT.length]);
    if (change) {
      nd.textContent = `刑期 ${day} / ${hell.total} 天`;
      nd.setAttribute('fill', change < 0 ? '#9aff9a' : '#ff6a5a');
      tone(change < 0 ? 660 : 140, .6, { gain: .04, type: change < 0 ? 'triangle' : 'sawtooth' });
      await say(change < 0
        ? `判官的帳簿上多了一行字：「${ev.note}」。你的刑期減少了 ${-change} 天。`
        : `判官的帳簿上多了一行字：「${ev.note}」。你的刑期增加了 ${change} 天。`);
    }
    if (hell.total <= day) {
      chime();
      await say('半夜，鬼差打開了牢門：「判官說了，你的刑期提前滿了。出來吧。」');
    }
  }

  async function sHellLife(d) {
    const groups = new Map();
    for (const h of badDeeds(d)) {
      const lv = sinLevel(h);
      if (!groups.has(lv)) groups.set(lv, []);
      groups.get(lv).push(h);
    }
    const order = [...groups.keys()].sort((a, b) => a - b);
    const events = shuffle(HELL_EVENTS);
    const seen = new Set();
    for (let day = 1; day <= HELL_LIVE_DAYS && day <= hell.total; day++) {
      hell.lived = day;
      dayCard(`第 ${day} 天`, `刑期 ${day} / ${hell.total} 天`, 'radial-gradient(ellipse at 50% 90%, #4a0c06, #120303 60%, #050101)', '#ff7a5a', 'embers');
      tone(110, 1.4, { gain: .06, slide: .9 });
      await wait(1500, true);
      await rollCall(d, day);
      if (order.length) {
        const lv = order[(day - 1) % order.length];
        await torture(lv, groups.get(lv), day, seen.has(lv));
        seen.add(lv);
      }
      const ev = await events[day - 1](d);
      const step = Math.max(1, Math.round(hell.total * 0.2));
      const before = hell.total;
      hell.total = Math.max(day, hell.total + ev.sign * step);
      diary.push(`第 ${day} 天：${ev.note}`);
      await night(day, ev, hell.total - before);
    }
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
    await say('你順著黃泉路走到了奈何橋。橋下是流著遺忘之水的忘川河，橋頭站著一位老婆婆——孟婆。');
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
    await say('孟婆嘆了口氣：「不肯喝湯的人，就得跳進忘川河，受上一千年的苦，才能帶著記憶去投胎。」');
    await say('你點點頭，縱身跳進了冰冷的河水。你寧願等一千年，也不想忘記這一生。');
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

    // 天堂是永遠的安息；地獄刑滿後要走奈何橋，選擇喝不喝孟婆湯
    const result = { choice: 'stay', hellDays: 0, depth: 0, diary: [] };
    diary = [];
    hell.total = hellDays(d.karma);
    hell.lived = 0;

    const scenes = [sDeath, sWuchang, sGate, sRoad, sHome, sMirror, sJudge];
    if (d.realm === 'HEAVEN') scenes.push(sGates, sMansion, sHeavenLife, sStars, sThousand, sRose);
    else scenes.push(sHell, sMap, sLedger, sFengdu, sHellLife, sRise, sJizo, sBridge);
    // 每次都一樣的場景可以跳過；會因玩家選擇而不同的場景一定會播
    const FIXED = new Set([sDeath, sWuchang, sGate, sRoad, sGates, sThousand, sRose, sJizo]);
    const run = s => s(d);

    try {
      for (let i = 0; i < scenes.length; i++) {
        inFixed = FIXED.has(scenes[i]);
        skipBtn.style.display = inFixed ? '' : 'none';
        try {
          const r = await run(scenes[i]);
          if (scenes[i] === sBridge) result.choice = r;
        } catch (e) {
          if (!(e instanceof SkipSignal) || !inFixed) throw e;
          skipping = false;
          typingDone = clickWaiter = null;
          while (i + 1 < scenes.length && FIXED.has(scenes[i + 1])) i++;
        }
      }
    } catch (e) {
      console.error(e);
    }
    inFixed = false;
    result.diary = diary.slice();
    if (d.realm === 'HELL') {
      result.depth = hellDepth(d.karma);
      result.hellDays = hell.total;
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
     * 回傳 { choice: 'reincarnate' | 'stay', hellDays, depth, diary }（choice 只有下地獄的人才會選；diary 是死後每天做了什麼）
     */
    play: ending => play({
      name: ending.soul.name, age: ending.soul.age, karma: ending.soul.karma,
      realm: ending.soul.realm, verdict: ending.verdict, history: ending.history
    }),
    sinLevel,
    /** 開發用：直接預覽某一層地獄或某個天界場景，例如 Journey.preview(9) 或 Journey.preview('sCity') */
    preview(what, d = { name: '測試者', age: 80, karma: 100, realm: 'HEAVEN', verdict: '', history: [{ stage: '童年', choice: '當志工', karma: 10 }, { stage: '少年', choice: '讓座', karma: 5 }, { stage: '中年', choice: '捐一筆錢', karma: 12 }] }) {
      if (!root) build();
      resize();
      root.classList.add('on');
      if (!raf) raf = requestAnimationFrame(frame);
      const fns = { sMirror, sGates, sMansion, sReunion, sCity, sChoir, sStars, sThousand, sRose, sMap, sLedger, sFengdu, sJizo, sBridge,
        hFeast, hGarden, hFly, hEarth, hElysium, eMoney, eFood, eLabor, eSutra, eGhostFest, eCellmate };
      if (typeof what === 'number') hellScene(what);
      else fns[what](d).catch(() => {});
    }
  };
})();
