// keyboard.js — 星河测评模拟钢琴键盘组件
// 小字组(C3-B3) / 小字1组(C4-B4) / 小字2组(C5-B5) 三个八度，物理音高准确。
// 钢琴音色用 WebAudio 多谐波+指数衰减包络近似，MIDI 音高精确。
// 用法：
//   Piano.init();                                  // 首次用户手势后初始化音频上下文
//   Piano.playMidi(60);                            // 发一个音（60=小字1组C/中央C）
//   const kb = Piano.mount(document.getElementById('kb'), { onNote: m=>{} });
//   kb.highlight([60,59,58,57,56,55]);             // 高亮一组 midi 音（音域引导用）
//   kb.clearHL();
const Piano = (() => {
  let ctx = null, master = null;
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
  const midiName = m => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
  const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    // 轻压限防削波
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
  }

  // 钢琴近似音色：基频+泛音，快起音+指数衰减
  function playMidi(m, dur = 1.2, vel = 1) {
    init();
    const f = midiToFreq(m), t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.6 * vel, t + 0.008);      // 起音
    out.gain.exponentialRampToValueAtTime(0.001, t + dur);        // 衰减
    out.connect(master);
    // 泛音结构（钢琴低频泛音丰富、高频少）
    const partials = [[1, 1], [2, 0.5], [3, 0.28], [4, 0.16], [5, 0.08], [6, 0.04]];
    // 音越高泛音相对越少、衰减越快
    const bright = Math.max(0.3, 1 - (m - 48) / 60);
    partials.forEach(([h, g]) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f * h;
      // 轻微失谐模拟琴弦
      o.detune.value = (Math.random() - 0.5) * 4;
      const og = ctx.createGain();
      og.gain.value = g * bright;
      const dg = ctx.createGain();
      dg.gain.setValueAtTime(1, t);
      dg.gain.exponentialRampToValueAtTime(0.001, t + dur * (1 - h * 0.08));
      o.connect(og); og.connect(dg); dg.connect(out);
      o.start(t); o.stop(t + dur + 0.1);
    });
  }

  // 渲染键盘。range: [起始midi, 结束midi] 闭区间，默认 C3(48)~B5(83)
  function mount(container, opts = {}) {
    init();
    const [lo, hi] = opts.range || [48, 83];
    const onNote = opts.onNote || (() => {});
    container.classList.add('pk');
    const whites = [], blacks = [];
    for (let m = lo; m <= hi; m++) (isBlack(m) ? blacks : whites).push(m);

    const whiteW = 100 / whites.length; // 白键宽百分比
    const wrap = document.createElement('div');
    wrap.className = 'pk-wrap';

    // 白键层
    whites.forEach((m, i) => {
      const k = document.createElement('div');
      k.className = 'pk-w';
      k.dataset.midi = m;
      k.style.left = (i * whiteW) + '%';
      k.style.width = whiteW + '%';
      if (m % 12 === 0) { // C 音标注
        const lb = document.createElement('span');
        lb.className = 'pk-clabel'; lb.textContent = midiName(m);
        k.appendChild(lb);
      }
      k.addEventListener('pointerdown', e => { e.preventDefault(); press(k, m); });
      wrap.appendChild(k);
    });
    // 黑键层（压在相邻白键缝上）
    let wIdx = -1;
    for (let m = lo; m <= hi; m++) {
      if (!isBlack(m)) { wIdx++; continue; }
      const k = document.createElement('div');
      k.className = 'pk-b';
      k.dataset.midi = m;
      k.style.left = ((wIdx + 1) * whiteW - whiteW * 0.32) + '%';
      k.style.width = (whiteW * 0.64) + '%';
      k.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(k, m); });
      wrap.appendChild(k);
    }

    // 卡通箭头（在键盘下方、朝上指向高亮区域）
    const arrow = document.createElement('div');
    arrow.className = 'pk-arrow'; arrow.textContent = '👆';
    arrow.style.display = 'none';
    container.appendChild(arrow);
    container.appendChild(wrap);

    function press(k, m) {
      playMidi(m);
      k.classList.add('pk-down');
      setTimeout(() => k.classList.remove('pk-down'), 160);
      onNote(m, midiName(m));
    }

    return {
      // 高亮一组 midi，并把箭头移到区域中心上方
      highlight(midis) {
        this.clearHL();
        let minL = 1e9, maxR = -1e9, any = false;
        wrap.querySelectorAll('[data-midi]').forEach(k => {
          const m = +k.dataset.midi;
          if (midis.includes(m)) {
            k.classList.add('pk-hl'); any = true;
            const l = k.offsetLeft, r = l + k.offsetWidth;
            if (l < minL) minL = l; if (r > maxR) maxR = r;
          }
        });
        if (any) {
          arrow.style.display = 'block';
          arrow.style.left = ((minL + maxR) / 2) + 'px';
        }
      },
      clearHL() {
        wrap.querySelectorAll('.pk-hl').forEach(k => k.classList.remove('pk-hl'));
        arrow.style.display = 'none';
      },
      play: playMidi,
    };
  }

  return { init, playMidi, mount, midiToFreq, midiName };
})();
