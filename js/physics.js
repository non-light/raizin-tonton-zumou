/* =========================================================================
 * physics.js — 力士の物理
 *
 * ワールドは真上から見た平面 (x, y)。z は土俵からの浮き上がり。
 * tilt は「傾き」で、これが限界を超えると転倒する。
 *
 * 大事な点：クリックの力を直接キャラクターへ加えることはしない。
 *   叩いた位置 → 土俵の振動 → キャラクターへ伝わる
 * という順番で applyVibration() を通してのみ力が入る。
 *
 * キャラクターごとの違いは、すべてキャラクターデータの数値と
 * specialBehavior（behaviors.js）で表現する。ここに個別分岐は書かない。
 * ========================================================================= */

function Fighter(character, role) {
  this.character = character;
  this.role = role;                 // 'player' | 'opponent'
  this.stats = character;           // 性能値はキャラクターデータに直接入っている
  this.radius = character.radius;
  this.beh = getBehavior(character);
  // 専用モーションを持つキャラだけ（雷神など）。持たないキャラは null のまま。
  this.motion = (character.motionSet && MOTION_SETS[character.motionSet]) ? new Motion(character) : null;
  this.mods = { friction: 1, fallAngle: 1, gravity: 1, airContact: 1, damping: 0 };
  this.reset(0, 0, 1);
}

Fighter.prototype.reset = function (x, y, facing) {
  this.x = x; this.y = y; this.z = 0;
  this.vx = 0; this.vy = 0; this.vz = 0;
  this.tilt = 0; this.tiltVel = 0;
  this.facing = facing;
  this.facingBack = false;          // 相手が奥にいるときは背中を見せる
  this.squash = 0;                  // 着地のつぶれ具合（見た目だけ）
  this.spin = 0;                    // 場外で回りながら飛んでいく速さ
  this.spinVisual = 0;              // 転がり表現などの追加回転（見た目だけ）
  this.auraTime = 0;                // 特殊挙動が出た瞬間の発光（見た目だけ）
  this.ring = 0;                    // 大技のときに広がる衝撃の輪（見た目だけ）
  this.driftScale = 1;              // 宇宙の彼方へ遠ざかるほど小さく見える
  this.bstate = {};                 // 特殊挙動が使う一時的な状態
  if (this.motion) this.motion = new Motion(this.character);
  this.state = 'fight';             // 'fight' | 'out' | 'down'
  this.stateTime = 0;
  this.loseReason = null;

  // --- 決まり手の判定に使う記録 ---
  this.contact = false;             // いま相手と接触しているか
  this.contactTotal = 0;            // 接触していた合計秒数
  this.contactRecent = 0;           // 接触が途切れてからの秒数
  this.pushedTotal = 0;             // 押し込まれた合計量
  this.lastHitSpeed = 0;            // 直近の衝突の相対速度
  this.travel = 0;                  // 動いた距離の合計
  this.exitSpeed = 0;               // 場外に出た瞬間の速さ
  this.exitAirborne = false;        // 場外に出た瞬間、浮いていたか
  this.edgeTimer = 0;               // 土俵際でふんばっている秒数
  this.edging = false;
};

/** 押し合いでの実効的な重さ（押されにくさ） */
Fighter.prototype.holdMass = function () {
  return this.stats.weight * (this.stats.pushResist || 1);
};

/** 押し込む力 */
Fighter.prototype.shovePower = function () {
  return this.stats.weight * (this.stats.pushPower || 1) * (this.isGrounded() ? 1 : 0.35);
};

Fighter.prototype.isGrounded = function () { return this.z <= 0.001; };

/** 転倒とみなす角度。安定性が高いほど粘る。特殊挙動で広がることもある。 */
Fighter.prototype.fallAngle = function () {
  return PHYS.fallAngle * (0.75 + 0.25 * this.stats.stability) * this.mods.fallAngle;
};

/** 姿勢の崩れ具合 0..1 */
Fighter.prototype.wobble = function () {
  return Math.min(1, Math.abs(this.tilt) / this.fallAngle());
};

/** 毎ステップの係数を組み直す（特殊挙動がここで書き換える） */
Fighter.prototype.refreshMods = function () {
  var m = this.mods;
  m.friction = 1; m.fallAngle = 1; m.gravity = 1; m.airContact = 1; m.damping = 0;
  if (this.beh && this.beh.modify) this.beh.modify(this, m);
};

/**
 * 土俵の振動を受け取る。
 * tapX, tapY : 叩かれた位置（ワールド座標）
 * scale      : 振動の溜まり具合による倍率
 * selfShake  : 「暴れすぎ」ペナルティ（自分のキャラにだけ入る）
 */
Fighter.prototype.applyVibration = function (tapX, tapY, scale, selfShake, energy) {
  if (this.state !== 'fight') return;

  var dx = this.x - tapX;
  var dy = this.y - tapY;
  var d = Math.sqrt(dx * dx + dy * dy);
  var nx = 0, ny = 0;
  if (d > 0.0001) { nx = dx / d; ny = dy / d; }

  // --- 狙い補助 ---
  // 力士のすぐ近くを叩いたときは、「その力士を土俵の外へ押す」向きに寄せる。
  // 叩いた位置から素直に押すだけだと、相手の真上を叩いても外へ出ず、
  // 「どこを叩けばいいのか分からない」ゲームになってしまうため。
  var self = Math.sqrt(this.x * this.x + this.y * this.y);
  var aim = 1 - Math.min(1, d / PHYS.aimRange);
  if (aim > 0 && self > 1) {
    var mix = aim * PHYS.aimAssist;
    var ox = this.x / self, oy = this.y / self;   // 土俵の中心から外へ向かう向き
    nx = nx * (1 - mix) + ox * mix;
    ny = ny * (1 - mix) + oy * mix;
    var n = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= n; ny /= n;
  }

  // 叩いた場所から遠いほど弱くなる（＝どこを叩いたかで挙動が変わる）
  var falloff = 1 / (1 + (d / PHYS.tapFalloff) * (d / PHYS.tapFalloff));
  // 真下を叩かれたときは横には押されず、まっすぐ跳ね上がるだけになる
  var sideways = falloff * Math.max(Math.min(1, d / PHYS.tapDeadZone), aim * 0.9);
  // 浮いているキャラには土俵の振動が伝わりにくい
  var contact = this.isGrounded() ? 1 : PHYS.airContact * this.mods.airContact;

  var s = this.stats;
  // 受け取る量 ＝ 反応 × 移動性 ÷（重さ × 押されにくさ）
  var take = (s.vibrationResponse * s.movementSpeed) /
             (s.weight * s.knockbackResistance) * sideways * scale * contact;
  // 狙って叩かれたぶんの上乗せ
  take *= 1 + aim * PHYS.aimBonus;
  // 土俵際でふんばっているところへの追撃は効きやすい
  if (this.edging) take *= EDGE.tapVuln;

  var ix = nx * PHYS.tapImpulse * take;
  var iy = ny * PHYS.tapImpulse * take;
  this.vx += ix;
  this.vy += iy;

  // 跳ね上がり（真下を叩かれたときがいちばん高く跳ねる）
  this.vz += PHYS.tapHop * (s.bounce / Math.sqrt(s.weight)) * falloff * scale * contact;

  // 姿勢の崩れ。重さでは薄まらない（重いキャラも揺さぶられれば傾く）。
  // すでに傾いている向きに力が来ると効きが大きい（追い打ち）。
  var shake = PHYS.tapImpulse * sideways * scale * contact;
  var torque = nx * shake * PHYS.tiltTorque *
               (0.5 + 0.5 * s.vibrationResponse) / s.stability;
  if (this.tilt * torque > 0) torque *= PHYS.tiltCombo;
  this.tiltVel += torque;

  // 暴れすぎたときのペナルティ：土俵の外側へ向かって自分の姿勢が崩れる
  if (selfShake > 0) {
    var out = this.x >= 0 ? 1 : -1;
    this.tiltVel += out * VIBE.selfPenaltyTilt * selfShake / s.stability;
    this.vx += out * VIBE.selfPenaltyPush * selfShake *
               (s.vibrationResponse / s.weight);
    this.vy += (Math.random() * 2 - 1) * VIBE.selfPenaltyPush * 0.5 * selfShake;
  }

  if (this.motion) this.motion.onVibration(this, scale);

  if (this.beh && this.beh.vibration) {
    this.beh.vibration(this, {
      nx: nx, ny: ny, ix: ix, iy: iy, scale: scale, energy: energy || 0
    });
  }
};

/** 外からの単発の押し（キャラ同士の接触や特殊挙動用） */
Fighter.prototype.push = function (ix, iy, tiltAmount) {
  if (this.state !== 'fight') return;
  var s = this.stats;
  this.vx += ix / (s.weight * s.knockbackResistance);
  this.vy += iy / (s.weight * s.knockbackResistance);
  if (tiltAmount) this.tiltVel += tiltAmount / s.stability;
};

Fighter.prototype.step = function (dt, env) {
  this.stateTime += dt;
  var energy = env ? env.energy : 0;

  if (this.motion) this.motion.update(this, dt);

  if (this.state === 'out') {
    // 土俵の外は人工重力の外。落ちずに、回りながら宇宙へ流れていく。
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    var k0 = Math.exp(-PHYS.driftDamp * dt);
    this.vx *= k0; this.vy *= k0; this.vz *= k0;
    this.tilt += this.spin * dt;
    this.driftScale = Math.max(0.16, this.driftScale - PHYS.driftShrink * dt);
    return;
  }
  if (this.state === 'down') {       // 転んだあとは倒れた姿勢で止まる
    var target = this.tilt >= 0 ? Math.PI / 2 : -Math.PI / 2;
    this.tilt += (target - this.tilt) * Math.min(1, dt * 12);
    this.vx *= 0.85; this.vy *= 0.85;
    this.x += this.vx * dt; this.y += this.vy * dt;
    return;
  }

  this.refreshMods();
  var s = this.stats;
  var m = this.mods;

  this.auraTime = Math.max(0, this.auraTime - dt);
  this.ring = Math.max(0, this.ring - dt * 1.5);

  // --- 上下 ---
  if (this.vz > PHYS.maxRise) this.vz = PHYS.maxRise;   // 跳ねすぎて画面外へ行かない
  this.vz -= PHYS.gravity * m.gravity * dt;
  this.z += this.vz * dt;
  if (this.z <= 0) {
    this.z = 0;
    if (this.vz < -40) {
      this.squash = Math.min(1, -this.vz / 260);
      if (this.motion) this.motion.onLand(this, -this.vz);
      // 着地の衝撃でも姿勢は乱れる
      this.tiltVel += this.vx * PHYS.landTilt / s.stability;
      this.vz = -this.vz * PHYS.bounceLoss * s.bounce;
      if (this.vz < 45) this.vz = 0;
    } else {
      this.vz = 0;
    }
  }
  var grounded = this.isGrounded();
  this.squash *= Math.max(0, 1 - dt * 7);

  // --- 傾いているとその向きへずるずる動く ---
  this.vx += this.tilt * PHYS.leanPush * (grounded ? 1 : 0.35) * dt;

  // --- 踏ん張り：外側ほど足を踏ん張って止まりやすくなる ---
  // 中央へ引き戻すのではなく「止まりやすくなる」だけなので、押し続ければ必ず出せる。
  var dist = Math.sqrt(this.x * this.x + this.y * this.y);
  var extraDamp = m.damping;
  if (grounded && dist > WORLD.radius * PHYS.gripStart) {
    var grip = (1 - this.wobble()) *
               (dist / WORLD.radius - PHYS.gripStart) / (1 - PHYS.gripStart);
    extraDamp += PHYS.edgeGrip * (0.6 + 0.4 * s.stability) * Math.min(1, grip);
  }
  // --- 土俵際のふんばり（全キャラ共通）---
  // すぐには落ちず、短いあいだ粘る。ただし時間切れになれば落ちる。
  var outward = dist > 0.001 ? (this.vx * this.x + this.vy * this.y) / dist : 0;
  this.edging = false;
  if (grounded && dist > WORLD.radius * EDGE.start && outward > 4) {
    if (this.edgeTimer < EDGE.maxTime) {
      this.edging = true;
      this.edgeTimer += dt;
      var left = 1 - this.edgeTimer / EDGE.maxTime;      // 粘りは尽きていく
      extraDamp += EDGE.grip * left * (0.6 + 0.4 * s.stability);
      this.vx -= (this.x / dist) * EDGE.rebound * left * dt;
      this.vy -= (this.y / dist) * EDGE.rebound * left * dt;
      this.vx += (Math.random() * 2 - 1) * EDGE.shiver * dt;
      this.vy += (Math.random() * 2 - 1) * EDGE.shiver * dt;
    }
  } else if (dist < WORLD.radius * (EDGE.start - 0.06)) {
    this.edgeTimer = 0;
  }
  if (this.motion) extraDamp += this.motion.gripBoost();

  // --- 振動が続いているあいだの細かいガタつき ---
  if (energy > 0.02) {
    var jig = PHYS.ambient * energy * (s.vibrationResponse / s.weight) * dt;
    this.vx += (Math.random() * 2 - 1) * jig;
    this.vy += (Math.random() * 2 - 1) * jig;
    this.tiltVel += (Math.random() * 2 - 1) * 1.8 * energy *
                    (s.vibrationResponse / s.weight) * dt;
  }

  // --- 特殊挙動 ---
  if (this.beh && this.beh.step) this.beh.step(this, dt, env || { energy: 0 });

  // --- 減衰。重いほど止まりにくく、摩擦が大きいほど早く止まる ---
  var damp = PHYS.damping * (s.friction * m.friction / s.weight) *
             (grounded ? 1 : PHYS.airDamping) + extraDamp;
  var k = Math.exp(-damp * dt);
  this.vx *= k;
  this.vy *= k;

  // --- 姿勢のバネ ---
  var acc = -PHYS.tiltSpring * s.stability * this.tilt
          - PHYS.tiltDamp * Math.sqrt(s.stability) * this.tiltVel;
  this.tiltVel += acc * dt;
  this.tilt += this.tiltVel * dt;

  var mx = this.vx * dt, my = this.vy * dt;
  this.x += mx;
  this.y += my;
  this.travel += Math.sqrt(mx * mx + my * my);
  this.contactRecent += dt;
};

/** 転倒／場外の判定。負けたら理由を返す。 */
Fighter.prototype.checkLose = function () {
  if (this.state !== 'fight') return null;

  if (Math.abs(this.tilt) > this.fallAngle()) {
    this.state = 'down';
    this.stateTime = 0;
    this.loseReason = 'down';
    return 'down';
  }
  var dist = Math.sqrt(this.x * this.x + this.y * this.y);
  if (dist > WORLD.radius) {
    this.launchIntoSpace(dist);
    this.loseReason = 'out';
    return 'out';
  }
  return null;
};

/** 人工重力の外へ放り出す（場外・転倒どちらの決着でも使う） */
Fighter.prototype.launchIntoSpace = function (dist) {
  var d = dist || Math.sqrt(this.x * this.x + this.y * this.y) || 1;
  this.state = 'out';
  this.stateTime = 0;
  this.driftScale = 1;
  this.exitSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  this.exitAirborne = this.z > 30;     // はっきり跳んで出たときだけ「自滅」扱いにする
  this.vx += (this.x / d) * PHYS.driftKick;
  this.vy += (this.y / d) * PHYS.driftKick;
  this.vz = PHYS.driftRise;
  this.spin = (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 1.5);
};

/**
 * 力士同士のぶつかり合い。
 * すり抜けさせず、接触が続いているあいだは「押し合い」を続ける。
 * 毎フレーム爆発的な力を加えないよう、重なりの解消も反発も上限をつけてある。
 */
function resolveCollision(a, b, dt) {
  if (a.state !== 'fight' || b.state !== 'fight') { a.contact = b.contact = false; return 0; }

  var dx = b.x - a.x, dy = b.y - a.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var minD = a.radius + b.radius;
  if (dist >= minD) { a.contact = b.contact = false; return 0; }

  if (dist < 0.0001) { dx = 1; dy = 0; dist = 0.0001; }
  var nx = dx / dist, ny = dy / dist;

  var ma = a.holdMass(), mb = b.holdMass();
  var total = ma + mb;

  // --- 1. 重なりの解消。重い側はあまり動かない。速度は決められた上限まで。 ---
  var overlap = minD - dist;
  var sep = Math.min(overlap, PUSH.separate * dt);
  a.x -= nx * sep * (mb / total);
  a.y -= ny * sep * (mb / total);
  b.x += nx * sep * (ma / total);
  b.y += ny * sep * (ma / total);

  a.contact = b.contact = true;
  a.contactTotal += dt; b.contactTotal += dt;
  a.contactRecent = b.contactRecent = 0;

  // --- 2. 押し合い。押す力の差で、じりじりと押し込まれる。 ---
  var net = (a.shovePower() - b.shovePower()) * PUSH.grind;
  b.vx += nx * net * dt / mb;
  b.vy += ny * net * dt / mb;
  a.vx -= nx * net * dt / ma;
  a.vy -= ny * net * dt / ma;
  if (net > 0) b.pushedTotal += net * dt / mb; else a.pushedTotal += -net * dt / ma;

  // 押し合っているあいだの小刻みな揺れ
  var jt = PUSH.grindJitter * dt;
  a.vx += (Math.random() * 2 - 1) * jt; a.vy += (Math.random() * 2 - 1) * jt;
  b.vx += (Math.random() * 2 - 1) * jt; b.vy += (Math.random() * 2 - 1) * jt;

  // --- 3. 近づいているときだけ弾く ---
  var rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rvn >= 0) return 0;

  var e = PUSH.restitution * ((a.stats.bounceBack + b.stats.bounceBack) * 0.5);
  var j = -(1 + e) * rvn / (1 / ma + 1 / mb);
  j = Math.min(j, PUSH.maxImpulse);

  a.vx -= nx * j / ma; a.vy -= ny * j / ma;
  b.vx += nx * j / mb; b.vy += ny * j / mb;

  var speed = -rvn;
  a.lastHitSpeed = b.lastHitSpeed = speed;

  // ぶつかった衝撃で姿勢も崩れる
  var t = j * PUSH.tilt;
  a.tiltVel -= nx * t / a.stats.stability;
  b.tiltVel += nx * t / b.stats.stability;

  var hop = j * PUSH.hop;
  if (a.isGrounded()) a.vz += hop * a.stats.bounce / ma;
  if (b.isGrounded()) b.vz += hop * b.stats.bounce / mb;

  if (a.motion) a.motion.onImpact(a, speed / 260);
  if (b.motion) b.motion.onImpact(b, speed / 260);
  return speed;
}

/** 接触中にトントンが入ったとき、相手を押し込む（直接攻撃ではなく押し合いの後押し） */
function shoveOnContact(me, other, power) {
  if (!me.contact || me.state !== 'fight' || other.state !== 'fight') return 0;
  var dx = other.x - me.x, dy = other.y - me.y;
  var d = Math.sqrt(dx * dx + dy * dy) || 1;
  var f = PUSH.tapShove * power * (me.stats.pushPower || 1);
  other.vx += (dx / d) * f / other.holdMass();
  other.vy += (dy / d) * f / other.holdMass();
  other.tiltVel += (dx / d) * f * 0.0035 / other.stats.stability;
  me.vx -= (dx / d) * f * 0.25 / me.holdMass();
  me.vy -= (dy / d) * f * 0.25 / me.holdMass();
  other.pushedTotal += f / other.holdMass();
  return f;
}
