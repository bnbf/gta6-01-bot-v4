// LUMEN BAY: WebAudio synthesized SFX (no audio files) + 2 procedural
// synthwave radio stations for the car radio (keys 1/2, R to toggle).
(function () {
  'use strict';

  function AudioSys() {
    this.ctx = null; this.muted = false;
    this.radioOn = false; this.station = 0; this.radioTimer = null;
    this.engineOsc = null; this.engineGain = null;
  }

  AudioSys.prototype.ensure = function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  };

  AudioSys.prototype.tone = function (freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  };

  AudioSys.prototype.noise = function (dur, vol, low) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * dur);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource(); src.buffer = buf;
    var f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
    var g = this.ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  };

  AudioSys.prototype.play = function (name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shot': this.noise(0.12, 0.3, 3000); this.tone(160, 0.1, 'square', 0.15, 50); break;
      case 'dry': this.tone(900, 0.05, 'square', 0.08); break;
      case 'crash': this.noise(0.25, 0.35, 700); break;
      case 'pickup': this.tone(660, 0.09, 'sine', 0.15); this.tone(990, 0.14, 'sine', 0.15); break;
      case 'steal': this.tone(300, 0.08, 'square', 0.12, 600); break;
      case 'mission': this.tone(523, 0.12, 'sine', 0.15); this.tone(784, 0.2, 'sine', 0.15); break;
      case 'complete': [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { }, 0); }); this.tone(523, 0.12, 'sine', 0.15); this.tone(784, 0.12, 'sine', 0.15); this.tone(1046, 0.25, 'sine', 0.15); break;
      case 'fail': this.tone(220, 0.3, 'sawtooth', 0.12, 110); break;
      case 'alarm': this.tone(880, 0.15, 'square', 0.12, 880); this.tone(660, 0.15, 'square', 0.12, 660); break;
      case 'nos': this.noise(0.6, 0.2, 5000); break;
      case 'siren': this.tone(700, 0.4, 'sine', 0.05, 950); break;
      case 'heal': this.tone(440, 0.15, 'sine', 0.12); this.tone(660, 0.2, 'sine', 0.12); break;
      default: break;
    }
  };

  // Radio: two procedural synthwave stations, scheduled note loops.
  // Station 0 "NEON FM" — A-minor arpeggio, 112 BPM. Station 1 "SUNSET DRIVE"
  // — C-major pads, 96 BPM. All synthesized live; no audio files.
  AudioSys.prototype.radioTick = function () {
    if (!this.ctx || !this.radioOn || this.muted) return;
    var bpm = this.station === 0 ? 112 : 96;
    var beat = 60 / bpm / 2; // eighth notes
    var scales = [
      [110, 130.81, 164.81, 196, 220, 261.63, 329.63, 440],
      [130.81, 164.81, 196, 261.63, 329.63, 392, 523.25, 659.25]
    ];
    var scale = scales[this.station];
    var step = (this.radioStep = (this.radioStep || 0) + 1);
    var note = scale[step % scale.length];
    this.tone(note, beat * 0.9, this.station === 0 ? 'sawtooth' : 'triangle', 0.05);
    if (step % 4 === 0) this.tone(note / 2, beat * 3, 'sine', 0.09);
    if (step % 8 === 6) this.noise(0.05, 0.04, 6000); // hat tick
  };

  AudioSys.prototype.setRadio = function (on, station) {
    this.ensure();
    if (station !== undefined) this.station = station;
    this.radioOn = on;
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
    if (on && this.ctx) {
      var self = this;
      this.radioTimer = setInterval(function () { self.radioTick(); }, 250);
    }
  };

  AudioSys.prototype.engine = function (speed01) {
    if (!this.ctx || this.muted) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 60 + speed01 * 160;
    this.engineGain.gain.value = 0.02 + speed01 * 0.03;
  };

  AudioSys.prototype.stopEngine = function () {
    if (this.engineGain) this.engineGain.gain.value = 0;
  };

  window.LB.AudioSys = AudioSys;
})();
