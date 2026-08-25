/* =========================================================================
 * game.js — 対戦の進行
 *
 * 操作は「土俵をトントンする」だけ。
 * タップ位置 → 土俵の振動 → 各力士へ伝播、という順に力が流れる。
 * ========================================================================= */

function Game(canvas, hooks) {
  this.renderer = new Renderer(canvas);
  this.hooks = hooks || {};
  this.fighters = [];
  this.player = null;
  this.opponent = null;

  this.energy = 0;          // 溜まっている振動 0..VIBE.max
  this.frozen = false;      // 開始演出のあいだは土俵を止めておく
  this.hitCool = 0;         // 衝突演出の連発防止
  this.phase = 'idle';      // 'idle' | 'intro' | 'live' | 'outro'
  this.result = null;
  this.nudgeTimer = 0;
  this.outroTimer = 0;
  this.raf = null;
  this.lastTime = 0;

  var self = this;
  this._onResize = function () { self.renderer.resize(); };
  window.addEventListener('resize', this._onResize);

  canvas.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    var rect = canvas.getBoundingClientRect();
    self.tap(ev.clientX - rect.left, ev.clientY - rect.top);
  });
}

/** キャラクターを決めて取組の準備をする（ページ再読み込みは不要） */
Game.prototype.setup = function (playerChar, opponentChar) {
  // 前の試合の背景・暗転を持ち越さない
  this.renderer.setBackdrop(opponentChar.battleBackground || null);
  this.renderer.darken = 0;
  this.renderer.rumble = 0;
  this.player = new Fighter(playerChar, 'player');
  this.opponent = new Fighter(opponentChar, 'opponent');
  this.fighters = [this.player, this.opponent];
  this.reset();
};

/** 同じ組み合わせのまま状態だけ初期化する */
Game.prototype.reset = function () {
  var jitter = function (n) { return (Math.random() * 2 - 1) * n; };
  // 立ち合い。相撲と同じで、最初から中央で向かい合わせる。
  // 半径の合計をわずかに超える間隔にしておくと、すぐに組み合いになる。
  var reach = this.player.radius + this.opponent.radius;
  var gap = reach * 0.47;                 // 中心からの距離（間隔は約 reach×0.94＝軽く組んだ状態）
  this.player.reset(-gap + jitter(5), 7 + jitter(5), 1);
  this.opponent.reset(gap + jitter(5), -7 + jitter(5), -1);
  this.energy = 0;
  this.result = null;
  this.nudgeTimer = 0.8;
  this.outroTimer = 0;
  this.phase = 'intro';
  this.frozen = false;
  this.renderer.ripples.length = 0;
  this.renderer.resize();
  this.emitEnergy();
};

/** 開始演出が終わってから呼ぶ。ここで初めて入力を受け付ける。 */
Game.prototype.begin = function () {
  if (this.phase === 'intro') this.phase = 'live';
};

/**
 * 演出のあいだ土俵を止める。
 * true のあいだはトントンしても振動が起きず、力士も動かない。
 */
Game.prototype.freeze = function (on) {
  this.frozen = !!on;
  if (on) this.phase = 'intro';
  else this.begin();
};

/** 画面の暗転 0..1（登場演出用） */
Game.prototype.setDarken = function (v) { this.renderer.darken = v; };

/** 背景を差し替える。null で通常の宇宙場所へ戻す。 */
Game.prototype.setBackdrop = function (path) { this.renderer.setBackdrop(path); };

/** 地響き（土俵が小さく揺れる） */
Game.prototype.rumble = function (v) { this.renderer.rumble = Math.max(this.renderer.rumble, v); };

/** 決まり手「圧」の静かな演出（派手にしない） */
Game.prototype.pressure = function () {
  var r = this.renderer;
  r.darken = 0.45;
  r.rumble = 0.8;
  Sound.boom();
  var self = this;
  var t0 = performance.now();
  (function ease() {
    var k = Math.min(1, (performance.now() - t0) / 900);
    r.darken = 0.45 * (1 - k);
    if (k < 1) requestAnimationFrame(ease);
  })();
};

/** 金の招き猫イベント用の光 */
Game.prototype.goldFlash = function () {
  this.renderer.goldFlash = 1;
  this.renderer.space.sparkle = 1;
  this.renderer.space.addMeteor(true);
};

Game.prototype.run = function () {
  if (this.raf) return;
  var self = this;
  this.lastTime = performance.now();
  var frame = function (now) {
    // dt に上限をつけておくと、タブを離れて戻ってきても一気に飛ばない
    var dt = Math.min(0.05, (now - self.lastTime) / 1000);
    self.lastTime = now;
    try {
      self.update(dt);
      self.renderer.update(dt);
      self.renderer.draw(self.fighters, self.energy);
    } catch (err) {
      // 1フレームの失敗でループごと止めない
      if (window.console) console.error(err);
    }
    self.raf = requestAnimationFrame(frame);
  };
  this.raf = requestAnimationFrame(frame);
};

Game.prototype.stop = function () {
  if (this.raf) cancelAnimationFrame(this.raf);
  this.raf = null;
};

/* ---------------- トントン ---------------- */

Game.prototype.tap = function (px, py) {
  if (this.phase !== 'live') return;

  var w = this.renderer.toWorld(px, py);

  // 振動の溜まり具合。上限があるので連打だけでは無限に強くならない。
  var before = this.energy;
  this.energy = Math.min(VIBE.max, this.energy + VIBE.perTap);
  var scale = VIBE.minScale + (VIBE.maxScale - VIBE.minScale) * this.energy;

  // すでに強く揺れている最中に叩くと、自分のキャラまで不安定になる
  var over = 0;
  if (before > VIBE.overdrive) {
    over = (before - VIBE.overdrive) / (VIBE.max - VIBE.overdrive);
  }

  for (var i = 0; i < this.fighters.length; i++) {
    var f = this.fighters[i];
    f.applyVibration(w.x, w.y, scale, f === this.player ? over : 0, this.energy);
  }

  // 宇宙らしい小さな演出。物理挙動が見えなくならない程度に留める。
  // 相手と組んでいるときのトントンは、押し込みの後押しになる
  // （クリックが直接相手を殴るのではなく、振動→自分の踏み込み→相手へ伝わる）
  shoveOnContact(this.player, this.opponent, 0.5 + this.energy * 0.7);

  this.renderer.addRipple(w.x, w.y, 0.6 + this.energy * 0.7);
  this.renderer.addShake(-w.x, -w.y, 0.5 + this.energy * 0.6);
  this.renderer.addSparks(w.x, w.y, this.energy);
  this.renderer.space.shake(0.35 + this.energy * 0.5);
  if (this.energy > VIBE.overdrive && Math.random() < 0.5) {
    this.renderer.space.addMeteor(true);   // 強く揺れたときだけ隕石が横切る
  }
  Sound.tap(this.energy);
  this.emitEnergy();
};

Game.prototype.emitEnergy = function () {
  if (this.hooks.onEnergy) {
    this.hooks.onEnergy(this.energy / VIBE.max, this.energy > VIBE.overdrive);
  }
};

/* ---------------- 毎フレームの更新 ---------------- */

Game.prototype.update = function (dt) {
  if (this.phase === 'idle') return;
  if (this.frozen) return;      // 「のこった！」までは土俵も力士も動かさない
  this.hitCool = Math.max(0, this.hitCool - dt);

  // 振動は時間とともに収まる
  if (this.energy > 0) {
    this.energy *= Math.pow(0.5, dt / VIBE.decay);
    if (this.energy < 0.004) this.energy = 0;
    this.emitEnergy();
  }

  // 細かいゆらぎ。毎回まったく同じ展開にならないようにする。
  this.nudgeTimer -= dt;
  if (this.nudgeTimer <= 0 && this.phase === 'live') {
    this.nudgeTimer = 1.1 + Math.random() * 1.6;
    for (var n = 0; n < this.fighters.length; n++) {
      var g = this.fighters[n];
      var a = Math.random() * Math.PI * 2;
      var p = 12 + Math.random() * 16;
      g.push(Math.cos(a) * p * g.stats.vibrationResponse,
             Math.sin(a) * p * g.stats.vibrationResponse,
             (Math.random() * 2 - 1) * 0.12);
    }
  }

  var steps = Math.max(1, Math.min(6, Math.ceil(dt / (1 / 120))));
  var h = dt / steps;

  var envP = { energy: this.energy, opponent: this.opponent };
  var envO = { energy: this.energy, opponent: this.player };
  for (var s = 0; s < steps; s++) {
    // 「寄り」は両者に同じものを適用する（差が出るのはキャラの aggression だけ）
    if (this.phase === 'live') {
      stepAI(this.player, this.opponent, this.energy, h);
      stepAI(this.opponent, this.player, this.energy, h);
    }
    this.player.step(h, envP);
    this.opponent.step(h, envO);
    var hit = resolveCollision(this.player, this.opponent, h);
    if (hit > PUSH.effectSpeed) this.onBigHit(hit);
  }

  this.updateFacing();

  if (this.phase === 'live') this.checkResult();
  else if (this.phase === 'outro') {
    this.outroTimer -= dt;
    if (this.outroTimer <= 0) {
      // 転んだ側も、人工重力から外れて宇宙へ流れていく（土俵に残るのは勝者だけ）
      if (this.result && this.result.loser && this.result.loser.state === 'down') {
        this.result.loser.launchIntoSpace();
      }
      this.phase = 'idle';
      if (this.hooks.onFinish) this.hooks.onFinish(this.result);
    }
  }
};

/** 強くぶつかったときだけ演出を出す */
Game.prototype.onBigHit = function (speed) {
  if (this.hitCool > 0) return;
  this.hitCool = 0.22;
  var k = Math.min(1, speed / 380);
  var mx = (this.player.x + this.opponent.x) / 2;
  var my = (this.player.y + this.opponent.y) / 2;
  this.renderer.addSparks(mx, my, 0.5 + k);
  this.renderer.addShake(this.opponent.x - this.player.x, this.opponent.y - this.player.y, 0.5 + k * 0.7);
  this.renderer.space.shake(0.25 + k * 0.35);
  Sound.thud(k);
};

/** 相手のほうを向く（見た目だけ。挙動には影響しない） */
Game.prototype.updateFacing = function () {
  var d = this.opponent.x - this.player.x;
  if (Math.abs(d) >= 12) {
    this.player.facing = d > 0 ? 1 : -1;
    this.opponent.facing = -this.player.facing;
  }
  // 相手が奥にいるほうは背中を見せる（背面画像があるキャラだけ効く）
  this.setBack(this.player, this.opponent);
  this.setBack(this.opponent, this.player);
};

/** ちらつかないように、少し離れてから向きを変える */
Game.prototype.setBack = function (f, other) {
  var gap = other.y - f.y;
  if (gap < -14) f.facingBack = true;
  else if (gap > 4) f.facingBack = false;
};

Game.prototype.checkResult = function () {
  var pl = this.player.checkLose();
  var op = this.opponent.checkLose();
  if (!pl && !op) return;

  var reason = pl || op;
  this.phase = 'outro';
  this.outroTimer = (reason === 'out' ? FLOW.outroFall : FLOW.outroDown) / 1000;

  // 決まった瞬間、背景がすこしキラキラして流れ星がひとつ
  this.renderer.space.sparkle = 1;
  this.renderer.space.addMeteor(false);

  if (pl && op) {
    this.result = { draw: true, reason: reason };
  } else if (op) {
    this.result = { winner: this.player, loser: this.opponent, reason: op };
  } else {
    this.result = { winner: this.opponent, loser: this.player, reason: pl };
  }
  this.result.kimarite = judgeKimarite(this.result);
};
