// Costa Serena — audio.js
// One job: all sound is synthesised in WebAudio — no audio assets. Engine
// hum follows RPM, sirens wail, collisions thud, and a procedural RADIO
// plays while driving: a little step-sequencer (bass + hats + plucky lead
// over an Am–F–C–G loop) that sounds like a coastal station, not a loop.
import { clamp, lerp } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc1 = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;
  let radioOn = true;
  let radioTimer = 0, radioStep = 0;
  let ambience = null;

  const CHORDS = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [48, 52, 55], // C (low)
    [55, 59, 62], // G
  ];
  const BASS = [45, 41, 48, 43];
  const LEAD = [69, 72, 76, 72, 74, 71, 69, 67, 69, 76, 74, 72, 71, 69, 67, 64];

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // engine: two detuned saws through a lowpass
    engineOsc1 = ctx.createOscillator(); engineOsc1.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square';
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc1.connect(engineFilter); engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc1.start(); engineOsc2.start();
    // siren
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
    // city ambience: looped filtered noise, very quiet
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 320;
    ambience = ctx.createGain(); ambience.gain.value = 0.03;
    noise.connect(ambFilter); ambFilter.connect(ambience); ambience.connect(master);
    noise.start();
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
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

  function radioNote(freq, dur, vol, type = 'triangle') {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function update(dt, s) {
    // s: { inCar, speed, topSpeed, wanted, driving, hour }
    if (!ctx) return;
    const rpm = s.inCar ? clamp(Math.abs(s.speed) / (s.topSpeed || 34), 0, 1) : 0;
    if (engineGain) {
      const target = s.inCar ? 0.05 + rpm * 0.06 : 0;
      engineGain.gain.value = lerp(engineGain.gain.value, muted ? 0 : target, dt * 6);
      const f = 55 + rpm * 165;
      engineOsc1.frequency.value = f;
      engineOsc2.frequency.value = f * 1.5 + 3;
      engineFilter.frequency.value = 320 + rpm * 900;
    }
    // siren wails while wanted
    if (sirenGain) {
      sirenTimer -= dt;
      if (s.wanted > 0) {
        if (sirenTimer <= 0) {
          sirenHigh = !sirenHigh;
          sirenTimer = 0.42;
          sirenOsc.frequency.value = sirenHigh ? 920 : 680;
        }
        sirenGain.gain.value = lerp(sirenGain.gain.value, muted ? 0 : 0.045, dt * 4);
      } else {
        sirenGain.gain.value = lerp(sirenGain.gain.value, 0, dt * 4);
      }
    }
    // procedural radio, only while driving
    if (radioOn && s.inCar && Math.abs(s.speed) > 1) {
      radioTimer -= dt;
      if (radioTimer <= 0) {
        radioTimer = 0.21; // 8th notes at ~140 bpm
        const bar = Math.floor(radioStep / 16) % 4;
        const step = radioStep % 16;
        if (step % 4 === 0) radioNote(midi(BASS[bar] - 12), 0.5, 0.16, 'sine');
        if (step % 2 === 0) noiseBurst(0.03, 0.05, 6000);
        const lead = LEAD[radioStep % LEAD.length];
        if (step % 4 === 2) radioNote(midi(lead), 0.22, 0.07, 'triangle');
        if (step === 0) {
          for (const n of CHORDS[bar]) radioNote(midi(n), 1.6, 0.025, 'sine');
        }
        radioStep++;
      }
    }
  }

  return {
    unlock,
    click() { blip(660, 0.08, 'sine', 0.15); },
    gunshot() { noiseBurst(0.16, 0.5, 2400); blip(140, 0.1, 'square', 0.2); },
    crash(strength) { noiseBurst(0.25, clamp(strength, 0.1, 0.6), 500); blip(70, 0.2, 'sine', 0.3); },
    pickup() { blip(880, 0.12, 'sine', 0.2); setTimeout(() => blip(1320, 0.16, 'sine', 0.2), 90); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.22), i * 110)); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    toggleRadio() { radioOn = !radioOn; return radioOn; },
    get muted() { return muted; },
    get radioOn() { return radioOn; },
    update,
  };
}
