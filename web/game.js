/**
 * 人生模式的遊戲邏輯（JavaScript 版，在瀏覽器裡執行，不需要伺服器）
 * 對應 Java 的 Scenario、LifeGame、Judge。題目從 scenarios.txt 讀取。
 */
const Game = (() => {
  const STAGES = ['童年', '少年', '青年', '中年', '老年'];
  /** 每個階段抽幾題（順序對應 STAGES），一共 7 題 */
  const PER_STAGE = [1, 1, 2, 2, 1];
  /** 業力達到這個分數就能上天堂，不到就下地獄 */
  const HEAVEN_THRESHOLD = 0;

  let all = null;    // 題庫
  let life = null;   // 目前這段人生 { name, scenarios, picks }

  /**
   * 解析題庫檔：
   *   == 階段
   *   ? 情境
   *   - 選項 | 業力 | 結果
   */
  function parse(text) {
    const result = [];
    let stage = null, situation = null, choices = null;
    const error = (lineNo, msg) => new Error(`題庫第 ${lineNo} 行：${msg}`);
    const addIfComplete = lineNo => {
      if (situation === null) return;
      if (choices.length < 2) throw error(lineNo, `題目「${situation}」至少要有 2 個選項`);
      result.push({ stage, situation, choices });
    };

    const lines = text.split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = raw.trim();
      const lineNo = i + 1;
      if (line === '' || line.startsWith('#')) return;

      if (line.startsWith('==')) {
        addIfComplete(lineNo);
        situation = null;
        choices = null;
        stage = line.slice(2).trim();
        if (!STAGES.includes(stage)) throw error(lineNo, `未知的人生階段「${stage}」，只能是 ${STAGES.join('、')}`);
      } else if (line.startsWith('?')) {
        addIfComplete(lineNo);
        if (stage === null) throw error(lineNo, '題目前面要先寫 == 階段');
        situation = line.slice(1).trim();
        choices = [];
      } else if (line.startsWith('-')) {
        if (choices === null) throw error(lineNo, '選項前面要先寫 ? 題目');
        const body = line.slice(1);
        const a = body.indexOf('|'), b = body.indexOf('|', a + 1);
        if (a < 0 || b < 0) throw error(lineNo, '選項格式應為：- 選項 | 業力 | 結果');
        const karmaText = body.slice(a + 1, b).trim();
        if (!/^[+-]?\d+$/.test(karmaText)) throw error(lineNo, `業力必須是整數，卻寫了「${karmaText}」`);
        choices.push({ text: body.slice(0, a).trim(), karma: Number(karmaText), outcome: body.slice(b + 1).trim() });
      } else {
        throw error(lineNo, '看不懂這一行，開頭應該是 ==、? 或 -');
      }
    });
    addIfComplete(lines.length);

    STAGES.forEach((s, k) => {
      const n = result.filter(sc => sc.stage === s).length;
      if (n < PER_STAGE[k]) throw new Error(`題庫的「${s}」只有 ${n} 題，至少要 ${PER_STAGE[k]} 題`);
    });
    return result;
  }

  async function load() {
    if (all) return all;
    const res = await fetch('scenarios.txt');
    if (!res.ok) throw new Error('讀不到題庫檔 scenarios.txt');
    all = parse(await res.text());
    return all;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 每個人生階段依 PER_STAGE 抽題，選項順序也打亂 */
  function randomLife() {
    const picked = [];
    STAGES.forEach((stage, k) => {
      const pool = shuffle(all.filter(s => s.stage === stage)).slice(0, PER_STAGE[k]);
      for (const s of pool) picked.push({ ...s, choices: shuffle(s.choices) });
    });
    return picked;
  }

  function current() {
    const s = life.scenarios[life.picks.length];
    return {
      step: life.picks.length + 1, total: life.scenarios.length,
      stage: s.stage, situation: s.situation, choices: s.choices.map(c => c.text),
    };
  }

  /** 開始新的一生 */
  async function start(name) {
    await load();
    name = String(name || '').trim().slice(0, 12) || '無名氏';
    life = { name, scenarios: randomLife(), picks: [] };
    return { name, next: current() };
  }

  /** 做出選擇；人生結束時會附上審判結果 ending */
  function choose(option) {
    if (!life) throw new Error('找不到這段人生，請重新開始');
    const s = life.scenarios[life.picks.length];
    const picked = s && s.choices[option];
    if (!picked) throw new Error('沒有這個選項');
    life.picks.push(picked);
    if (life.picks.length < life.scenarios.length) {
      return { outcome: picked.outcome, next: current() };
    }

    // 人生結束：變成靈魂，接受審判
    const karma = life.picks.reduce((sum, c) => sum + c.karma, 0);
    const realm = karma >= HEAVEN_THRESHOLD ? 'HEAVEN' : 'HELL';
    const soul = { name: life.name, age: 60 + Math.floor(Math.random() * 36), karma, realm };
    const verdict = realm === 'HEAVEN' ? '行善積德，准入天堂！' : '罪孽深重，打入地獄！';
    const history = life.picks.map((c, i) => ({
      stage: life.scenarios[i].stage, situation: life.scenarios[i].situation, choice: c.text, karma: c.karma,
    }));
    life = null;
    return { outcome: picked.outcome, ending: { soul, verdict, history } };
  }

  return { start, choose };
})();
