// Costa Serena — audio.js
// Semua suara disintesis WebAudio (tanpa aset): deru mesin mengikuti RPM,
// sirene dua nada, klakson, tembakan, tabrakan, denting cash, ambience kota,
// dan RADIO SYNTH prosedural saat menyetir — sekuenser melodi + bass +
// hi-hat yang digenerate di tempat, tanpa file musik.
import { CFG, clamp } from './config.js';

export function createAudio(S) {
  const A = {
    ctx: null, master: null, muted: false,
    engineOsc: null, engineGain: null, engineFilter: null,
    sirenOsc: null, sirenGain: null, sirenTimer: 0,
    radioTimer: 0, radioStep: 0, radioOn: false,
    ambience: null,
    ensure() {
      if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        A.ctx = new Ctx();
        A.master = A.ctx.createGain();
        A.master.gain.value = A.muted ? 0 : 0.5;
        A.master.connect(A.ctx.destination);
        // mesin: sawtooth + lowpass
        A.engineOsc = A.ctx.createOscillator();
        A.engineOsc.type = 'sawtooth';
        A.engineOsc.frequency.value = 60;
        A.engineFilter = A.ctx.createBiquadFilter();
        A.engineFilter.type = 'lowpass'; A.engineFilter.frequency.value = 500;
        A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0;
        A.engineOsc.connect(A.engineFilter).connect(A.engineGain).connect(A.master);
        A.engineOsc.start();
        // sirene: dua nada bergantian
        A.sirenOsc = A.ctx.createOscillator();
        A.sirenOsc.type = 'triangle';
        A.sirenOsc.frequency.value = 700;
        A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0;
        A.sirenOsc.connect(A.sirenGain).connect(A.master);
        A.sirenOsc.start();
        // ambience kota: noise terfilter, sangat pelan
        const len = A.ctx.sampleRate * 2;
        const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = A.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const bp = A.ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
        const ag = A.ctx.createGain(); ag.gain.value = 0.035;
        src.connect(bp).connect(ag).connect(A.master);
        src.start();
        return true;
      } catch (e) { return false; }
    },
    setMuted(m) {
      A.muted = m;
      if (A.master) A.master.gain.value = m ? 0 : 0.5;
    },
    blip(freq, dur, type, vol) {
      if (!A.ctx || A.muted) return;
      const o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.2, A.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + dur);
      o.connect(g).connect(A.master);
      o.start(); o.stop(A.ctx.currentTime + dur);
    },
    noiseBurst(dur, vol, freq) {
      if (!A.ctx || A.muted) return;
      const len = Math.floor(A.ctx.sampleRate * dur);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource(); src.buffer = buf;
      const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = A.ctx.createGain(); g.gain.value = vol || 0.4;
      src.connect(f).connect(g).connect(A.master);
      src.start();
    },
    gunshot() { A.noiseBurst(0.14, 0.5, 2600); A.blip(160, 0.09, 'square', 0.22); },
    honk() { A.blip(370, 0.22, 'square', 0.16); setTimeout(() => A.blip(370, 0.18, 'square', 0.14), 240); },
    cash() { A.blip(880, 0.12, 'sine', 0.22); setTimeout(() => A.blip(1320, 0.2, 'sine', 0.22), 110); },
    click() { A.blip(660, 0.06, 'sine', 0.15); },
    collision(strength) { A.noiseBurst(0.22, clamp(strength / 30, 0.1, 0.6), 300); A.blip(70, 0.2, 'sine', 0.3); },
    setSiren(level) {
      if (!A.ctx) return;
      A.sirenGain.gain.value = A.muted ? 0 : level * 0.06;
    },
    // radio prosedural: progresi Am–F–C–G, melodi pentatonik + bass + hat.
    updateRadio(dt, driving) {
      if (!A.ctx) return;
      A.radioOn = driving;
      if (!driving) return;
      A.radioTimer += dt;
      const stepDur = 0.21;
      if (A.radioTimer < stepDur) return;
      A.radioTimer -= stepDur;
      const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
      const bar = Math.floor(A.radioStep / 8) % 4;
      const chord = chords[bar];
      const step = A.radioStep % 8;
      // bass di ketukan 0 dan 4
      if (step === 0 || step === 4) A.blip(chord[0] / 2, 0.3, 'triangle', 0.2);
      // melodi pentatonik deterministik dari step
      const melody = [0, 2, 1, 2, 0, 1, 2, 1];
      if (step % 2 === 0) A.blip(chord[melody[step]] * 2, 0.16, 'sine', 0.09);
      // hi-hat tiap ketukan ganjil
      if (step % 2 === 1) A.noiseBurst(0.03, 0.05, 6000);
      A.radioStep++;
    },
    updateEngine(dt, speed, driving) {
      if (!A.ctx) return;
      const rpm = clamp(Math.abs(speed) / CFG.carMaxSpeed, 0, 1);
      const target = driving ? 0.05 + rpm * 0.11 : 0;
      A.engineGain.gain.value += (target - A.engineGain.gain.value) * Math.min(1, dt * 6);
      A.engineOsc.frequency.value = 55 + rpm * 165 + (driving ? 8 : 0);
      A.engineFilter.frequency.value = 380 + rpm * 1400;
      // sirene naik-turun dua nada
      if (A.sirenGain.gain.value > 0.002) {
        A.sirenTimer += dt;
        A.sirenOsc.frequency.value = Math.sin(A.sirenTimer * 5.2) > 0 ? 715 : 950;
      }
    },
  };
  S.audio = A;
  return A;
}
