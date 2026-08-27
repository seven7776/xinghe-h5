// mock.js — 星河 H5 MVP 的本地假后端。
// 真后端接上后，把 fetch('/api/xxx') 直连即可，页面代码不用改。
const XH = {
  // ---- 后端地址：本地联调走真后端，线上 Pages 暂走 mock ----
  base: (location.protocol === 'https:' && location.hostname.includes('github.io')) ? null : 'http://' + location.hostname + ':8890',

  async api(path, body) {
    if (!this.base) { // 线上演示 -> mock
      await new Promise(r => setTimeout(r, 600));
      return this.mock(path, body);
    }
    try {
      const r = await fetch(this.base + path, {
        method: 'POST',
        headers: path === '/api/lead' ? { 'Content-Type': 'application/json' } : undefined,
        body: path === '/api/lead' ? JSON.stringify(body) : (() => {
          const fd = new FormData();
          Object.entries(body || {}).forEach(([k, v]) => v instanceof Blob ? fd.append('file', v, 'rec.wav') : fd.append(k, v));
          return fd;
        })()
      });
      return await r.json();
    } catch (e) {
      console.warn('backend down, fallback mock', e.message);
      await new Promise(r => setTimeout(r, 600));
      return this.mock(path, body);
    }
  },

  mock(path, body) {
    if (path === '/api/lead') return { ok: true, leadId: 'L' + Date.now() };
    if (path === '/api/score') {
      // 五维假分：音准/节奏/乐感/音域/音色 —— 参数层校准前的占位
      const r = (a, b) => Math.round(a + Math.random() * (b - a));
      return { ok: true, dims: { pitch: r(62, 95), rhythm: r(60, 94), feel: r(58, 92), range: r(55, 90), tone: r(60, 93) } };
    }
    return { ok: false };
  },

  // ---- 五维 -> 总分与班型（占位逻辑，权重待大张校准）----
  total(d) { return Math.round((d.pitch*0.3 + d.rhythm*0.2 + d.feel*0.2 + d.range*0.15 + d.tone*0.15)); },
  plan(t) {
    if (t >= 90) return { band: '跳级推荐', cls: '升段挑战课' };
    if (t >= 75) return { band: '标准班', cls: '同龄段标准班' };
    if (t >= 60) return { band: '基础班', cls: '同龄段基础班' };
    return { band: '一对一', cls: '一对一定向培养' };
  },

  // ---- 页面跳转 ----
  go(page) { location.href = page; }
};

// ---- 录音成功 · 星星激励弹窗（全局）----
// showStarToast('太棒了！', '宝贝的声音真好听', function(){ ... 弹窗关掉后执行 ... })
const STAR_PRAISE = ['太棒了！', '非常棒！', '唱得真好！', '好厉害！', '太出色了！', '宝贝真棒！'];
function showStarToast(text, sub, done) {
  text = text || STAR_PRAISE[Math.floor(Math.random() * STAR_PRAISE.length)];
  const el = document.createElement('div');
  el.className = 'star-toast';
  el.innerHTML =
    '<div class="toast-card">' +
      '<div class="toast-stars">' +
        '<span class="st main">⭐</span>' +
        '<span class="st s1">✨</span><span class="st s2">⭐</span>' +
        '<span class="st s3">✨</span><span class="st s4">⭐</span><span class="st s5">✨</span>' +
      '</div>' +
      '<div class="toast-text">' + text + '</div>' +
      (sub ? '<div class="toast-sub">' + sub + '</div>' : '') +
    '</div>';
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.remove(); if (done) done(); }, 280);
  }, 1500);
}

// 测评问卷题目（占位 6 题，正式题目走 05 提示词工程重写版）
const QUESTIONS = [
  { k: 'age',    t: '孩子现在读几年级？', opts: ['幼儿园中班/大班', '一二年级', '三四年级', '五六年级', '初中'] },
  { k: 'exp',    t: '学过声乐或乐器吗？', opts: ['零基础', '学过半年内', '学过1-2年', '学过2年以上'] },
  { k: 'goal',   t: '学唱歌主要想达成？', opts: ['培养兴趣', '考级', '比赛/演出', '艺考方向'] },
  { k: 'song',   t: '孩子会唱的最熟一首歌？', input: true },
  { k: 'freq',   t: '每周能保证练习几次？', opts: ['1次及以下', '2-3次', '4次以上'] },
  { k: 'concern',t: '家长最关心什么？', opts: ['音准跑调', '节奏不稳', '胆量台风', '科学发声', '都想提升'] },
];
