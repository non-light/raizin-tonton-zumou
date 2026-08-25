/* =========================================================================
 * space.js — 背景の宇宙（星・惑星・地球・月・隕石）
 *
 * 座標はキャンバスに対する 0..1 の割合で持つので、画面サイズが変わっても
 * そのまま使える。主役は土俵とキャラクターなので、色は暗め・動きは遅め。
 * ========================================================================= */

function SpaceField() {
  this.t = 0;
  this.stars = [];
  this.meteors = [];
  this.jiggle = 0;        // トントンしたときに星が一瞬ぷるっとする
  this.sparkle = 0;       // 決着したときのキラキラ
  this.meteorTimer = 6 + Math.random() * 6;

  for (var i = 0; i < 96; i++) {
    this.stars.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.3,
      a: 0.25 + Math.random() * 0.6,
      sp: 0.4 + Math.random() * 1.6,
      ph: Math.random() * Math.PI * 2,
      drift: (0.0015 + Math.random() * 0.004)
    });
  }

  // 土俵は画面中央〜下を占めるので、飾りは上側と隅にだけ置く
  this.planets = [
    { x: 0.70, y: 0.11, r: 0.030, color: '#8f7ce0', ring: true,  a: 0.85 },
    { x: 0.40, y: 0.06, r: 0.014, color: '#e2a1c4', ring: false, a: 0.7 },
    { x: 0.05, y: 0.46, r: 0.020, color: '#6fc7b4', ring: false, a: 0.6 },
    { x: 0.95, y: 0.52, r: 0.016, color: '#d8b06a', ring: false, a: 0.6 }
  ];
  this.earth = { x: 0.15, y: 0.15, r: 0.062 };
  this.moon  = { x: 0.88, y: 0.30, r: 0.024 };
}

/** トントンしたときに星をゆらす */
SpaceField.prototype.shake = function (power) {
  this.jiggle = Math.min(1.2, this.jiggle * 0.4 + power);
};

/** 隕石を1つ流す */
SpaceField.prototype.addMeteor = function (fast) {
  if (this.meteors.length > 3) return;
  var fromLeft = Math.random() < 0.5;
  var speed = (fast ? 0.55 : 0.30) + Math.random() * 0.2;
  this.meteors.push({
    x: fromLeft ? -0.06 : 1.06,
    y: 0.02 + Math.random() * 0.34,
    vx: (fromLeft ? 1 : -1) * speed,
    vy: speed * (0.28 + Math.random() * 0.24),
    life: 1
  });
};

SpaceField.prototype.update = function (dt) {
  this.t += dt;
  this.jiggle *= Math.max(0, 1 - dt * 7);
  this.sparkle *= Math.max(0, 1 - dt * 0.9);

  for (var i = 0; i < this.stars.length; i++) {
    var s = this.stars[i];
    s.x += s.drift * dt * 0.06;
    if (s.x > 1.02) s.x = -0.02;
  }

  this.meteorTimer -= dt;
  if (this.meteorTimer <= 0) {
    this.meteorTimer = 7 + Math.random() * 8;
    this.addMeteor(false);
  }
  for (var m = this.meteors.length - 1; m >= 0; m--) {
    var me = this.meteors[m];
    me.x += me.vx * dt;
    me.y += me.vy * dt;
    if (me.x < -0.15 || me.x > 1.15 || me.y > 1.1) this.meteors.splice(m, 1);
  }
};

SpaceField.prototype.draw = function (ctx, w, h) {
  // 宇宙の地
  var g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a0f24');
  g.addColorStop(0.55, '#121a38');
  g.addColorStop(1, '#1a1330');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // うっすら星雲（色味を出すためだけの、ごく薄いにじみ）
  this.nebula(ctx, w * 0.22, h * 0.30, w * 0.42, 'rgba(120,90,220,0.16)');
  this.nebula(ctx, w * 0.82, h * 0.72, w * 0.38, 'rgba(60,140,190,0.13)');

  // 星
  var jx = Math.sin(this.t * 42) * this.jiggle * 2.4;
  var jy = Math.cos(this.t * 37) * this.jiggle * 1.6;
  for (var i = 0; i < this.stars.length; i++) {
    var s = this.stars[i];
    var tw = 0.65 + 0.35 * Math.sin(this.t * s.sp + s.ph);
    var a = s.a * tw * (1 + this.sparkle * 0.9);
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x * w + jx, s.y * h + jy, s.r * (1 + this.sparkle * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  this.drawEarth(ctx, w, h);
  this.drawMoon(ctx, w, h);
  for (var p = 0; p < this.planets.length; p++) this.drawPlanet(ctx, w, h, this.planets[p]);
  this.drawMeteors(ctx, w, h);
};

SpaceField.prototype.nebula = function (ctx, x, y, r, color) {
  var g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

SpaceField.prototype.drawEarth = function (ctx, w, h) {
  var e = this.earth;
  var x = e.x * w, y = e.y * h, r = e.r * Math.min(w, h * 1.6);

  // 大気のふち
  var atm = ctx.createRadialGradient(x, y, r * 0.85, x, y, r * 1.35);
  atm.addColorStop(0, 'rgba(120,190,255,0.28)');
  atm.addColorStop(1, 'rgba(120,190,255,0)');
  ctx.fillStyle = atm;
  ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, Math.PI * 2); ctx.fill();

  var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#5ea8e8');
  g.addColorStop(1, '#1c4f8c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

  // 大陸っぽいもの
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = 'rgba(110,190,130,0.9)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.1, r * 0.42, r * 0.3, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.35, r * 0.3, r * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.ellipse(x + r * 0.1, y - r * 0.5, r * 0.5, r * 0.16, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};

SpaceField.prototype.drawMoon = function (ctx, w, h) {
  var m = this.moon;
  var x = m.x * w, y = m.y * h, r = m.r * Math.min(w, h * 1.6);
  var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#e8e6df');
  g.addColorStop(1, '#a6a49c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.beginPath(); ctx.arc(x - r * 0.25, y + r * 0.2, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.25, r * 0.17, 0, Math.PI * 2); ctx.fill();
};

SpaceField.prototype.drawPlanet = function (ctx, w, h, p) {
  var x = p.x * w, y = p.y * h, r = p.r * Math.min(w, h * 1.6);
  ctx.globalAlpha = p.a;
  if (p.ring) {
    ctx.strokeStyle = 'rgba(230,210,255,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.75, r * 0.5, -0.45, 0, Math.PI * 2);
    ctx.stroke();
  }
  var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, p.color);
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
};

SpaceField.prototype.drawMeteors = function (ctx, w, h) {
  for (var i = 0; i < this.meteors.length; i++) {
    var m = this.meteors[i];
    var x = m.x * w, y = m.y * h;
    var tx = x - m.vx * w * 0.10, ty = y - m.vy * h * 0.10;
    var g = ctx.createLinearGradient(x, y, tx, ty);
    g.addColorStop(0, 'rgba(255,246,214,0.95)');
    g.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
  }
};
