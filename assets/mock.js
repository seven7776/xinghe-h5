// mock.js — 星河 H5 MVP 的本地假后端。
// 真后端接上后，把 fetch('/api/xxx') 直连即可，页面代码不用改。
const XH = {
  // ---- 调用后端（现在走 mock）----
  async api(path, body) {
    await new Promise(r => setTimeout(r, 600)); // 模拟网络延迟
    return this.mock(path, body);
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

// 测评问卷题目（占位 6 题，正式题目走 05 提示词工程重写版）
const QUESTIONS = [
  { k: 'age',    t: '孩子现在读几年级？', opts: ['幼儿园中班/大班', '一二年级', '三四年级', '五六年级', '初中'] },
  { k: 'exp',    t: '学过声乐或乐器吗？', opts: ['零基础', '学过半年内', '学过1-2年', '学过2年以上'] },
  { k: 'goal',   t: '学唱歌主要想达成？', opts: ['培养兴趣', '考级', '比赛/演出', '艺考方向'] },
  { k: 'song',   t: '孩子会唱的最熟一首歌？', input: true },
  { k: 'freq',   t: '每周能保证练习几次？', opts: ['1次及以下', '2-3次', '4次以上'] },
  { k: 'concern',t: '家长最关心什么？', opts: ['音准跑调', '节奏不稳', '胆量台风', '科学发声', '都想提升'] },
];
