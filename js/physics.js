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
  this.driftScale = 1;              // 宇宙の彼方へ遠ざかるほど小さく見える
  this.bstate = {};                 // 特殊挙動が使う一時的な状態
  if (this.motion) this.motion = new Motion(this.character);
  this.state = 'fight';             // 'fight' | 'out' | 'down'
  this.stateTime = 0;
  this.loseReason = null;
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

  // 叩いた場所から遠いほど弱くなる（＝どこを叩いたかで挙動が変わる）
  var falloff = 1 / (1 + (d / PHYS.tapFalloff) * (d / PHYS.tapFalloff));
  // 真下を叩かれたときは横には押されず、まっすぐ跳ね上がるだけになる
  var sideways = falloff * Math.min(1, d / PHYS.tapDeadZone);
  // 浮いているキャラには土俵の振動が伝わりにくい
  var contact = this.isGrounded() ? 1 : PHYS.airContact * this.mods.airContact;

  var s = this.stats;
  // 受け取る量 ＝ 反応 × 移動性 ÷（重さ × 押されにくさ）
  var take = (s.vibrationResponse * s.movementSpeed) /
             (s.weight * s.knockbackResistance) * sideways * scale * contact;

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
  // 雷神の「ふんばり」。耐えている短いあいだだけ摩擦が上がる。
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

  this.x += this.vx * dt;
  this.y += this.vy * dt;
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
  this.vx += (this.x / d) * PHYS.driftKick;
  this.vy += (this.y / d) * PHYS.driftKick;
  this.vz = PHYS.driftRise;
  this.spin = (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 1.5);
};

/** 力士同士の衝突 */
function resolveCollision(a, b) {
  if (a.state !== 'fight' || b.state !== 'fight') return false;

  var dx = b.x - a.x, dy = b.y - a.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var minD = a.radius + b.radius;
  if (dist >= minD || dist === 0) return false;

  var nx = dx / dist, ny = dy / dist;
  var wa = a.stats.weight, wb = b.stats.weight;
  var total = wa + wb;

  // 重なりを解消（軽いほうが多く押される）
  var overlap = minD - dist;
  a.x -= nx * overlap * (wb / total);
  a.y -= ny * overlap * (wb / total);
  b.x += nx * overlap * (wa / total);
  b.y += ny * overlap * (wa / total);

  // 近づいているときだけ弾く
  var rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rvn > 0) return false;

  var e = PHYS.hitRestitution * (1 + (a.stats.bounce + b.stats.bounce) * 0.5) * 0.5 + 0.2;
  var j = -(1 + e) * rvn / (1 / wa + 1 / wb);

  a.vx -= nx * j / wa; a.vy -= ny * j / wa;
  b.vx += nx * j / wb; b.vy += ny * j / wb;

  // ぶつかった衝撃で姿勢も崩れる
  var t = Math.abs(j) * PHYS.hitTilt;
  a.tiltVel -= nx * t / a.stats.stability;
  b.tiltVel += nx * t / b.stats.stability;

  // 少し浮く
  if (a.motion) a.motion.onImpact(a, Math.abs(j) / 260);
  if (b.motion) b.motion.onImpact(b, Math.abs(j) / 260);

  var hop = Math.abs(j) * PHYS.hitHop;
  if (a.isGrounded()) a.vz += hop * a.stats.bounce / wa;
  if (b.isGrounded()) b.vz += hop * b.stats.bounce / wb;
  return true;
}
