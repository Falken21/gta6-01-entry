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
      // radio: gain bus for the procedural stations (mute via master)
      radioGain = ctx.createGain(); radioGain.gain.value = 0.32;
      radioGain.connect(master);
      const hatLen = Math.floor(ctx.sampleRate * 0.05);
      hatBuf = ctx.createBuffer(1, hatLen, ctx.sampleRate);
      const hd = hatBuf.getChannelData(0);
      for (let i = 0; i < hatLen; i++) hd[i] = (Math.random() * 2 - 1) * (1 - i / hatLen);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---- car radio: 3 procedural stations, step-sequenced, no audio assets ----
  // Each track: 16-step bar, chord per bar, bass offsets from the bar root,
  // hats and a sparse lead. Scheduled with a 0.15s lookahead timer.
  const RADIO_TRACKS = [
    { name: 'Serena Lo-Fi', bpm: 92,
      roots: [45, 41, 48, 43], // A2 F2 C3 G2
      chords: [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]],
      bass: [0, null, null, null, null, null, 0, null, null, null, 0, null, 12, null, null, null],
      hat: [1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0],
      lead: [24, null, null, 27, null, null, 24, null, null, null, 31, null, 29, null, null, null] },
    { name: 'Marina Synthwave', bpm: 112,
      roots: [38, 34, 41, 36], // D2 Bb1 F2 C2
      chords: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]],
      bass: [0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 12, null],
      hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      lead: [24, null, 27, null, 31, null, 27, null, 24, null, 27, null, 36, null, 31, null] },
    { name: 'Pesisir Drive', bpm: 126,
      roots: [40, 36, 43, 38], // E2 C2 G2 D2
      chords: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]],
      bass: [0, null, 0, 12, 0, null, 0, null, 0, null, 0, 12, 0, null, 7, null],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      lead: [24, null, null, null, 28, null, null, 31, null, null, 28, null, null, null, 24, null] },
  ];
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let radioGain = null, hatBuf = null;
  const radio = { on: false, track: 0, step: 0, bar: 0, nextTime: 0, timer: null, paused: false, voices: new Set() };
  let radioTrackCallback = null;

  function radioTone(type, freq, t, dur, vol, attack = 0.01, filterFreq = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (filterFreq) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, Math.max(t + attack, t + dur - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(radioGain);
    o.start(t); o.stop(t + dur + 0.05);
    radio.voices.add(g);
    o.onended = () => radio.voices.delete(g);
  }
  function radioHat(t, vol) {
    const src = ctx.createBufferSource(); src.buffer = hatBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(radioGain);
    src.start(t);
  }
  function scheduleStep(track, step, bar, t) {
    const stepDur = 60 / track.bpm / 4;
    const barIdx = bar % track.roots.length;
    const root = track.roots[barIdx];
    const bassOff = track.bass[step];
    if (bassOff !== null && bassOff !== undefined) {
      radioTone('sawtooth', midi(root + bassOff), t, stepDur * 1.8, 0.16, 0.01, 320);
    }
    if (step === 0) {
      const chord = track.chords[barIdx];
      const barDur = stepDur * 16;
      for (const n of chord) radioTone('triangle', midi(n), t, barDur, 0.045, 0.4);
    }
    const hatV = track.hat[step];
    if (hatV) radioHat(t, 0.05 * hatV);
    const leadOff = track.lead[step];
    if (leadOff !== null && leadOff !== undefined) {
      radioTone('square', midi(root + leadOff), t, stepDur * 1.4, 0.035, 0.005, 2400);
    }
  }
  function radioTick() {
    if (!ctx || !radio.on || radio.paused) return;
    const track = RADIO_TRACKS[radio.track];
    const stepDur = 60 / track.bpm / 4;
    while (radio.nextTime < ctx.currentTime + 0.15) {
      scheduleStep(track, radio.step, radio.bar, Math.max(radio.nextTime, ctx.currentTime));
      radio.nextTime += stepDur;
      radio.step += 1;
      if (radio.step >= 16) {
        radio.step = 0; radio.bar += 1;
        if (radio.bar % 8 === 0) { // auto-advance station every 8 bars
          radio.track = (radio.track + 1) % RADIO_TRACKS.length;
          radioTrackCallback?.(RADIO_TRACKS[radio.track].name);
        }
      }
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
    // ---- car radio ----
    get radioOn() { return radio.on; },
    get radioTrack() { return RADIO_TRACKS[radio.track].name; },
    setRadioTrackCallback(fn) { radioTrackCallback = fn; },
    radioStart(track = 0) {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      radio.track = ((track % RADIO_TRACKS.length) + RADIO_TRACKS.length) % RADIO_TRACKS.length;
      radio.step = 0; radio.bar = 0;
      radio.nextTime = ctx.currentTime + 0.06;
      radio.on = true; radio.paused = false;
      if (radioGain) radioGain.gain.setTargetAtTime(0.32, ctx.currentTime, 0.1);
      if (!radio.timer) radio.timer = setInterval(radioTick, 40);
      return true;
    },
    radioStop() {
      radio.on = false;
      if (radio.timer) { clearInterval(radio.timer); radio.timer = null; }
      if (ctx) {
        for (const g of radio.voices) g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
        radio.voices.clear();
      }
    },
    radioNext() {
      if (!radio.on) return null;
      radio.track = (radio.track + 1) % RADIO_TRACKS.length;
      radio.bar = 0; radio.step = 0;
      return RADIO_TRACKS[radio.track].name;
    },
    radioPause(paused) {
      radio.paused = paused;
      if (radioGain && ctx) radioGain.gain.setTargetAtTime(paused ? 0 : 0.32, ctx.currentTime, 0.1);
    },
  };
}
