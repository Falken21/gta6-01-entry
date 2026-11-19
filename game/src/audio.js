// Costa Serena — audio.js
// Semua suara disintesis WebAudio (tanpa aset): deru mesin per RPM, sirene
// dua nada, tabrakan, tembakan, ambience kota, klik UI — plus RADIO SYNTH
// prosedural (progresi akor + bass + hat) yang berbunyi saat menyetir.
import { CFG } from './config.js';

export function createAudio(W) {
  let ctx = null, master = null, muted = false;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenOn = false;
  let radioNodes = null, radioOn = CFG.radioDefault;
  let ambienceNodes = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    // mesin: dua osilator saw + lowpass, pitch ikut RPM
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
    const engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square';
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc.frequency.value = 55; engineOsc2.frequency.value = 28;
    engineOsc.start(); engineOsc2.start();
    // sirene
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.frequency.value = 700; sirenOsc.start();
    // ambience kota: noise terfilter pelan
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.035;
    noise.connect(bp); bp.connect(ng); ng.connect(master);
    noise.start();
    ambienceNodes = { noise };
    // radio synth: progresi Am–F–C–G, bass + arpeggio + hat
    startRadio();
  }
  function startRadio() {
    const chords = [
      [220.0, 261.6, 329.6], [174.6, 220.0, 261.6],
      [261.6, 329.6, 392.0], [196.0, 246.9, 293.7],
    ];
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    const bass = ctx.createOscillator(); bass.type = 'triangle';
    const arp = ctx.createOscillator(); arp.type = 'square';
    const arpGain = ctx.createGain(); arpGain.gain.value = 0.05;
    const hatBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const hd = hatBuf.getChannelData(0);
    for (let i = 0; i < hd.length; i++) hd[i] = (Math.random() * 2 - 1) * (1 - i / hd.length);
    const hat = ctx.createBufferSource(); hat.buffer = hatBuf; hat.loop = true;
    const hatGain = ctx.createGain(); hatGain.gain.value = 0.0;
    const hatFilter = ctx.createBiquadFilter(); hatFilter.type = 'highpass'; hatFilter.frequency.value = 6000;
    bass.connect(g); arp.connect(arpGain); arpGain.connect(g);
    hat.connect(hatFilter); hatFilter.connect(hatGain); hatGain.connect(g);
    bass.start(); arp.start(); hat.start();
    radioNodes = { g, bass, arp, arpGain, hatGain, chords, step: 0, nextT: ctx.currentTime };
  }
  function updateRadio(dt) {
    if (!ctx || !radioNodes) return;
    const driving = !!W.player.car;
    const target = (radioOn && driving && !muted) ? 0.16 : 0;
    radioNodes.g.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
    if (target === 0) return;
    const r = radioNodes;
    const beat = 0.42; // ~143 bpm
    while (r.nextT < ctx.currentTime + 0.1) {
      const chord = r.chords[Math.floor(r.step / 4) % 4];
      const note = chord[r.step % 3] * (r.step % 8 === 6 ? 2 : 1);
      r.arp.frequency.setValueAtTime(note, r.nextT);
      r.arpGain.gain.setValueAtTime(0.05, r.nextT);
      r.arpGain.gain.exponentialRampToValueAtTime(0.001, r.nextT + beat * 0.9);
      r.bass.frequency.setValueAtTime(chord[0] / 2, r.nextT);
      r.hatGain.gain.setValueAtTime(r.step % 2 ? 0.05 : 0.02, r.nextT);
      r.step++;
      r.nextT += beat;
    }
  }
  function update(dt) {
    if (!ctx) return;
    // mesin ikut RPM mobil pemain
    const car = W.player.car;
    const rpm = car ? Math.min(1, Math.abs(car.speed) / car.def.top) : 0;
    const target = car ? 0.05 + rpm * 0.10 : 0;
    engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(52 + rpm * 165, ctx.currentTime, 0.08);
    engineFilter.frequency.setTargetAtTime(320 + rpm * 1400, ctx.currentTime, 0.1);
    // sirene: dua nada bergantian, redup dengan jarak
    let sirenTarget = 0;
    if (sirenOn && W.police.cops.length) {
      let d = Infinity;
      for (const c of W.police.cops) d = Math.min(d, Math.hypot(c.pos.x - W.player.pos.x, c.pos.z - W.player.pos.z));
      sirenTarget = Math.max(0, 0.12 * (1 - d / 140));
      sirenOsc.frequency.setTargetAtTime((Math.floor(ctx.currentTime * 2.4) % 2 ? 950 : 700), ctx.currentTime, 0.05);
    }
    sirenGain.gain.setTargetAtTime(muted ? 0 : sirenTarget, ctx.currentTime, 0.2);
    updateRadio(dt);
  }
  function blip(freq, dur, type = 'sine', vol = 0.15) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  return {
    ensure,
    update,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; },
    toggleRadio() { radioOn = !radioOn; return radioOn; },
    get radioOn() { return radioOn; },
    setSiren(on) { sirenOn = on; },
    click() { blip(880, 0.07, 'sine', 0.12); },
    gunshot() {
      if (!ctx || muted) return;
      const len = ctx.sampleRate * 0.12;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
      const g = ctx.createGain(); g.gain.value = 0.5;
      s.connect(f); f.connect(g); g.connect(master); s.start();
    },
    crash(s = 1) { blip(90, 0.25, 'triangle', 0.3 * s); blip(60, 0.3, 'sine', 0.25 * s); },
    checkpoint() { blip(660, 0.1); setTimeout(() => blip(990, 0.14), 90); },
    missionStart() { blip(523, 0.12); setTimeout(() => blip(659, 0.12), 110); setTimeout(() => blip(784, 0.2), 220); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18), i * 110)); },
  };
}
