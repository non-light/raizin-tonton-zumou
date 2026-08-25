/* =========================================================================
 * sound.js — トントンの効果音（WebAudio）
 * 音が使えない環境では何もしない。
 * ========================================================================= */

var Sound = (function () {
  var ctx = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  /** トン。強さ 0..1 で音程と余韻が変わる。 */
  function tap(power) {
    var ac = ensure();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();

    var t = ac.currentTime;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210 + power * 110, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.13);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.20 + power * 0.14, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** 相手が決まったときの短い音 */
  function reveal() {
    var ac = ensure(); if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    var t = ac.currentTime;
    [660, 880].forEach(function (f, i) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t + i * 0.09);
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.22);
      o.connect(g).connect(ac.destination);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.25);
    });
  }

  /** 金の招き猫の「シャキーン！」 */
  function shakin() {
    var ac = ensure(); if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    var t = ac.currentTime;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1180, t);
    o.frequency.exponentialRampToValueAtTime(2400, t + 0.10);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.42);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.20, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + 0.6);
  }

  /** 遠くから近づいてくる低いうなり */
  function omen(sec) {
    var ac = ensure(); if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    var t = ac.currentTime, dur = sec || 1.4;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(38, t);
    o.frequency.linearRampToValueAtTime(72, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    o.connect(f).connect(g).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** 「ズン」重低音 */
  function boom() {
    var ac = ensure(); if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    var t = ac.currentTime;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.34, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + 0.8);
  }

  /** ぶつかったときの「ドン！」 */
  function thud(power) {
    var ac = ensure(); if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    var t = ac.currentTime, p = Math.min(1, power || 0.5);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(190 - p * 50, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 + p * 0.18, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + 0.34);
  }

  return { tap: tap, reveal: reveal, shakin: shakin, omen: omen, boom: boom, thud: thud };
})();
