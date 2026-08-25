/* =========================================================================
 * motions.js — キャラクター専用のモーション切り替え
 *
 * キャラクターデータに motionSet: 'raijin' と書いたキャラだけが対象。
 * 書いていないキャラはこれまで通り frontImage / backImage の1枚絵で動く。
 *
 * 物理の状態から毎フレーム無理やり絵を差し替えるのではなく、
 *   いまの状態を判定 → 変わったときだけ切り替える
 * という作りにしてある。優先順位は PRIORITY の並び順（上が強い）。
 * ========================================================================= */

var MOTION_SETS = {
  raijin: {
    dir: 'assets/characters/raijin/',
    sprites: {
      front: 'front.png', back: 'back.png', idle: 'idle.png',
      jump: 'jump.png', attack: 'attack.png',
      tiltLeft: 'tiltLeft.png', tiltRight: 'tiltRight.png',
      edgeHold: 'edgeHold.png', down: 'down.png', fall: 'fall.png'
    },
    // エフェクトは本体とは別レイヤー。増やすときはここに足すだけ。
    effects: {
      impact: 'fx-impact.png', burst: 'fx-burst.png', smoke: 'fx-smoke.png',
      swirl: 'fx-swirl.png', speed: 'fx-speed.png', sweat: 'fx-sweat.png'
    }
  }
};

/* 上にあるものほど強い。上位が出ているあいだは下位へ落ちない。 */
var MOTION_PRIORITY = ['fall', 'down', 'edgeHold', 'jump', 'tiltLeft', 'tiltRight', 'attack', 'idle', 'base'];

var MOTION_CFG = {
  tiltEnter: 0.13,      // これを超えたら「傾く」絵へ
  tiltExit: 0.075,      // これを下回ったら戻す（ちらつき防止）
  jumpZ: 8,             // これ以上浮いたらジャンプ
  jumpVz: 95,
  edgeRatio: 0.78,      // 土俵半径のこの割合より外
  edgeOutSpeed: 12,     // 外向きに出ている速さ
  edgeGripBoost: 2.6,   // ふんばり中の追加摩擦
  edgeGripMax: 1.1,     // ふんばれる最大の秒数（必ず助かるわけではない）
  attackHold: 0.26,     // トントンに反応している時間
  idleAfter: 2.4,       // これだけ操作がないと待機ポーズ
  minHold: 0.12         // 切り替え後、最低これだけは保つ
};

function Motion(character) {
  this.set = MOTION_SETS[character.motionSet];
  this.state = 'base';
  this.time = 0;
  this.held = 0;
  this.attack = 0;
  this.sinceTap = 99;
  this.edgeTime = 0;
  this.effects = [];
  this.sway = 0;
}

Motion.prototype.path = function (name) {
  var f = this.set.sprites[name];
  return f ? this.set.dir + f : null;
};

/** エフェクトを別レイヤーに1つ足す */
Motion.prototype.addEffect = function (name, dx, dy, life) {
  if (!this.set.effects[name]) return;
  this.effects.push({
    path: this.set.dir + this.set.effects[name],
    dx: dx || 0, dy: dy || 0, t: 0, life: life || 0.55
  });
  if (this.effects.length > 6) this.effects.shift();
};

/** トントンされた瞬間に呼ばれる */
Motion.prototype.onVibration = function (f, power) {
  this.sinceTap = 0;
  this.attack = MOTION_CFG.attackHold;
  if (power > 0.55) this.addEffect('burst', (Math.random() * 2 - 1) * 18, -f.character.size.h * 0.55, 0.4);
};

/** ぶつかった・強く押されたときなど */
Motion.prototype.onImpact = function (f, strength) {
  this.addEffect(strength > 1 ? 'impact' : 'burst', 0, -f.character.size.h * 0.6, 0.45);
};

Motion.prototype.onLand = function (f, speed) {
  if (speed > 150) this.addEffect('smoke', (Math.random() * 2 - 1) * 14, -6, 0.5);
};

/** いまあるべき状態を決める（優先順位つき） */
Motion.prototype.resolve = function (f, dt) {
  var cfg = MOTION_CFG;

  if (f.state === 'out') return 'fall';
  if (f.state === 'down') return 'down';

  var grounded = f.isGrounded();
  var dist = Math.sqrt(f.x * f.x + f.y * f.y);
  var outward = dist > 0.001 ? (f.vx * f.x + f.vy * f.y) / dist : 0;

  // 土俵の端でふんばる（ただし耐えきれる時間には上限がある）
  if (grounded && dist > WORLD.radius * cfg.edgeRatio && outward > cfg.edgeOutSpeed
      && this.edgeTime < cfg.edgeGripMax) {
    this.edgeTime += dt;
    return 'edgeHold';
  }
  if (dist < WORLD.radius * (cfg.edgeRatio - 0.06)) this.edgeTime = 0;

  if (!grounded && (f.z > cfg.jumpZ || f.vz > cfg.jumpVz)) return 'jump';

  // 傾きはヒステリシス付き（小さな揺れでは切り替えない）
  var lean = f.tilt;
  var leaning = (this.state === 'tiltLeft' || this.state === 'tiltRight')
              ? Math.abs(lean) > cfg.tiltExit
              : Math.abs(lean) > cfg.tiltEnter;
  if (leaning) return lean < 0 ? 'tiltLeft' : 'tiltRight';

  if (this.attack > 0) return 'attack';
  if (this.sinceTap > cfg.idleAfter) return 'idle';
  return 'base';
};

Motion.prototype.update = function (f, dt) {
  this.time += dt;
  this.held += dt;
  this.sinceTap += dt;
  this.attack = Math.max(0, this.attack - dt);
  this.sway += dt;

  var next = this.resolve(f, dt);
  if (next !== this.state) {
    var pNext = MOTION_PRIORITY.indexOf(next);
    var pNow = MOTION_PRIORITY.indexOf(this.state);
    // 上位状態が出ているあいだは、最低保持時間を過ぎるまで下位へ落とさない
    if (pNext < pNow || this.held >= MOTION_CFG.minHold) {
      this.state = next;
      this.held = 0;
      if (next === 'down') this.addEffect('swirl', 0, -f.character.size.h * 0.75, 1.6);
      if (next === 'fall') this.addEffect('speed', 0, -f.character.size.h * 0.4, 1.2);
    }
  }

  if (this.state === 'edgeHold' && Math.random() < dt * 5) {
    this.addEffect('sweat', (Math.random() * 2 - 1) * 22, -f.character.size.h * 0.7, 0.45);
  }

  for (var i = this.effects.length - 1; i >= 0; i--) {
    this.effects[i].t += dt;
    if (this.effects[i].t >= this.effects[i].life) this.effects.splice(i, 1);
  }
};

/** いま描くべき画像のパス。base のときだけ向きで正面／背面を使い分ける。 */
Motion.prototype.spritePath = function (f) {
  if (this.state === 'base') return this.path(f.facingBack ? 'back' : 'front');
  return this.path(this.state) || this.path('front');
};

/** 待機のゆらゆらなど、絵に足す小さな動き */
Motion.prototype.offset = function () {
  if (this.state === 'idle') {
    return { x: Math.sin(this.sway * 2.1) * 2.2, y: Math.abs(Math.sin(this.sway * 2.1)) * -1.8,
             rot: Math.sin(this.sway * 2.1) * 0.028 };
  }
  if (this.state === 'edgeHold') {           // 耐えて小刻みに震える
    return { x: (Math.random() * 2 - 1) * 1.8, y: 0, rot: (Math.random() * 2 - 1) * 0.012 };
  }
  if (this.state === 'attack') {
    return { x: 0, y: -1.5, rot: 0 };
  }
  return { x: 0, y: 0, rot: 0 };
};

/** 雷神だけ持つ「ふんばり」。摩擦を一時的に上げる（耐えきれるとは限らない） */
Motion.prototype.gripBoost = function () {
  return this.state === 'edgeHold' ? MOTION_CFG.edgeGripBoost : 0;
};
