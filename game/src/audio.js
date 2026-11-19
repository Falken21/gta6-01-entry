// Costa Serena — audio.js
// WebAudio-synthesised sound only (no assets): engine hum by RPM, siren,
// collisions, city ambience, UI clicks — plus a PROCEDURAL RADIO while driving
// (Gemini critique fix): a tiny synth sequencer (bass + lead + hats) that
// switches "station" with R.
import { clamp } from './config.js';

const STATIONS = [
  { name: 'Serena FM — Sunset Drive', bpm: 96, root: 110, scale: [0, 3, 5, 7, 10, 12], wave: 'sawtooth' },
  { name: 'Marina Chill 88.2', bpm: 72, root: 98, scale: [0, 2, 4, 7, 9, 12], wave: 'triangle' },
  { name: 'Costa Nights 101', bpm: 122, root: 130.8, scale: [0, 2, 3, 7, 8, 12], wave: 'square' },
];

export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null;
    this.radioOn = false; this.station = 0; this.step = 0; this.nextStep = 0;
    this.ambienceOn = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // engine: two detuned oscillators through a lowpass
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 60;
    const osc2 = this.ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 30;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700;
    this.engineOsc.connect(filt); osc2.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start(); osc2.start(); this.engineOsc2 = osc2;
    // city ambience: filtered noise, very quiet
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6;
    const ag = this.ctx.createGain(); ag.gain.value = 0.015;
    src.connect(bp); bp.connect(ag); ag.connect(this.ctx.destination); src.start();
  }
  setEngine(rpm01, driving) {
    if (!this.ctx || this.muted) return;
    const f = 55 + rpm01 * 160;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(f / 2, this.ctx.currentTime, 0.06);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + rpm01 * 0.05 : 0.02, this.ctx.currentTime, 0.1);
  }
  blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  click() { this.blip(880, 0.07, 'sine', 0.08); }
  shot() { this.blip(180, 0.12, 'square', 0.2); this.blip(90, 0.18, 'sawtooth', 0.15); }
  thud() { this.blip(70, 0.2, 'sine', 0.22); }
  crash() { this.blip(55, 0.35, 'sawtooth', 0.25); }
  sirenTick(on) { if (on) this.blip(720 + Math.random() * 120, 0.09, 'sine', 0.03); }
  cash() { this.blip(1320, 0.1); setTimeout(() => this.blip(1760, 0.16), 90); }
  // --- procedural radio: 16-step sequencer, scheduled per frame ---
  radioToggle(on) { this.radioOn = on; if (on) this.nextStep = this.ctx ? this.ctx.currentTime + 0.05 : 0; }
  radioNextStation() { this.station = (this.station + 1) % STATIONS.length; return STATIONS[this.station].name; }
  radioUpdate(driving) {
    if (!this.ctx || this.muted || !this.radioOn || !driving) return;
    const st = STATIONS[this.station];
    const stepDur = 60 / st.bpm / 4;
    while (this.nextStep < this.ctx.currentTime + 0.15) {
      const s = this.step % 16;
      const t = this.nextStep;
      // bass on beats
      if (s % 4 === 0) this.note(st.root / 2, t, stepDur * 3.5, 'triangle', 0.16);
      // lead riff from the scale
      if (s % 2 === 0) {
        const deg = st.scale[(s / 2 + Math.floor(this.step / 16)) % st.scale.length];
        this.note(st.root * Math.pow(2, deg / 12) * 2, t, stepDur * 1.6, st.wave, 0.05);
      }
      // hats
      if (s % 2 === 1) this.note(6000, t, 0.03, 'square', 0.015);
      this.step++; this.nextStep += stepDur;
    }
  }
  note(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  toggleMute() { this.muted = !this.muted; if (this.engineGain) this.engineGain.gain.value = this.muted ? 0 : 0.04; return this.muted; }
}
