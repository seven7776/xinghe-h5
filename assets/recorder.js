// recorder.js — H5 真录音模块（麦克风 -> 16kHz 单声道 WAV）
// 兼容: 微信安卓 / iOS 14.3+（需 HTTPS 或 localhost）；产出 wav 可直喂评分 API
const Recorder = (() => {
  let ctx = null, stream = null, proc = null, chunks = [], t0 = 0, timer = null, _dur = 0;

  async function start() {
    if (ctx) throw new Error('已在录音中');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const src = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(4096, 1, 1);
    chunks = [];
    proc.onaudioprocess = e => {
      const d = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(d));
    };
    src.connect(proc); proc.connect(ctx.destination);
    t0 = Date.now();
    timer = setInterval(() => { _dur = (Date.now() - t0) / 1000; if (Recorder.onTick) Recorder.onTick(_dur); }, 200);
    return true;
  }

  function stop() {
    return new Promise(resolve => {
      if (!ctx) return resolve(null);
      clearInterval(timer);
      const sr = ctx.sampleRate;
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const pcm = new Float32Array(total);
      let off = 0; chunks.forEach(c => { pcm.set(c, off); off += c.length; });
      // 16bit PCM wav
      const buf = new ArrayBuffer(44 + total * 2);
      const v = new DataView(buf);
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); ws(8, 'WAVE');
      ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      ws(36, 'data'); v.setUint32(40, total * 2, true);
      for (let i = 0; i < total; i++) { const s = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
      const blob = new Blob([buf], { type: 'audio/wav' });
      _dur = (Date.now() - t0) / 1000;
      const out = { blob, duration: _dur, url: URL.createObjectURL(blob), size: blob.size, sampleRate: sr };
      try { proc.disconnect(); stream.getTracks().forEach(t => t.stop()); ctx.close(); } catch (e) {}
      ctx = stream = proc = null;
      resolve(out);
    });
  }

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
  }

  return { start, stop, isSupported, get recording() { return !!ctx; } };
})();
