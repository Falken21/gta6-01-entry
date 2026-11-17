// Costa Serena — WebAudio-synthesised sound only (no audio assets):
// engine hum by RPM, two-tone siren, collision thud, gunshot, UI clicks,
// city ambience. Created on the first user gesture; M mutes.
export function createAudio() {
  let ctx = null, master = null, muted = false;
  let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  let ambience = null, ambienceGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // engine: two detuned saws through a lowpass
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 30;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 400;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // siren: square wave wobbling between two tones
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'square'; sirenOsc.frequency.value = 800;
      sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 160;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
      // ambience: looped filtered noise (city + waves)
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; data[i] = last * 3; }
      ambience = ctx.createBufferSource(); ambience.buffer = buf; ambience.loop = true;
      const ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'bandpass'; ambFilter.frequency.value = 500; ambFilter.Q.value = 0.6;
      ambienceGain = ctx.createGain(); ambienceGain.gain.value = 0.05;
      ambience.connect(ambFilter); ambFilter.connect(ambienceGain); ambienceGain.connect(master);
      ambience.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  function blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  function noiseBurst(dur, vol, freq = 800) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  return {
    ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    engine(rpm, on) {
      if (!ctx) return;
      const target = on ? 0.05 + rpm * 0.12 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      const f = 55 + rpm * 160;
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
      engineOsc2.frequency.setTargetAtTime(f * 0.5, ctx.currentTime, 0.05);
      engineFilter.frequency.setTargetAtTime(300 + rpm * 900, ctx.currentTime, 0.1);
    },
    siren(on, dist) {
      if (!ctx) return;
      const vol = on ? Math.max(0, 0.06 * (1 - dist / 90)) : 0;
      sirenGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
    },
    thud(strength) { noiseBurst(0.18, Math.min(0.5, 0.15 + strength * 0.02), 300); },
    shot() { noiseBurst(0.12, 0.4, 2400); blip(180, 0.08, 'square', 0.15); },
    punch() { noiseBurst(0.08, 0.25, 500); },
    click() { blip(880, 0.07, 'sine', 0.15); },
    success() { blip(660, 0.12, 'sine', 0.2); setTimeout(() => blip(990, 0.18, 'sine', 0.2), 110); },
    fail() { blip(220, 0.25, 'sawtooth', 0.15); },
  };
}
