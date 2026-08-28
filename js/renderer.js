/* =========================================================================
 * renderer.js — 宇宙場所の土俵と力士の描画
 *
 * キャラクターごとの描画分岐は持たない。画像があればそれを、
 * 無ければ character.color を使った共通の仮図形を描く。
 * ========================================================================= */

function Renderer(canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.space = new SpaceField();
  this.scale = 1;
  this.originX = 0;
  this.originY = 0;
  this.ripples = [];
  this.sparks = [];
  this.rimPulse = 0;                 // 叩いた瞬間に土俵のふちが光る
  this.goldFlash = 0;                // 金の招き猫イベントの光
  this.backdrop = null;              // 差し替え背景（裏ボス戦など）
  this.backdropFade = 0;             // 0=通常の宇宙 1=差し替え背景
  this.darken = 0;                   // 画面全体の暗転 0..1
  this.rumble = 0;                   // 低い揺れ
  this.shake = { x: 0, y: 0, t: 0, dur: 0, dx: 0, dy: 0, power: 0 };
  this.resize();
}

/** 上下のUIが使っている高さを測る（土俵をできるだけ大きく取るため） */
Renderer.prototype.reservedHeight = function () {
  var sel = ['.brand', '.hud', '.hint', '.hint-sub'];
  var total = 44;                      // 余白ぶん
  for (var i = 0; i < sel.length; i++) {
    var el = document.querySelector(sel[i]);
    if (el && el.offsetParent !== null) total += el.offsetHeight;
  }
  return total;
};

Renderer.prototype.resize = function () {
  var host = this.canvas.parentNode;
  var availW = (host && host.clientWidth) || this.canvas.clientWidth || WORLD.width;
  // 縦にも収まるようにして、横スクロールも縦あふれも出さない
  var availH = Math.max(240, (window.innerHeight || 800) - this.reservedHeight());
  var ratio = WORLD.width / WORLD.height;
  var cssW = Math.max(280, Math.min(availW, availH * ratio));
  var cssH = cssW / ratio;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  this.canvas.style.width = cssW + 'px';
  this.canvas.style.height = cssH + 'px';
  this.canvas.width = Math.round(cssW * dpr);
  this.canvas.height = Math.round(cssH * dpr);
  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  this.cssW = cssW;
  this.cssH = cssH;
  this.scale = cssW / WORLD.width;
  this.originX = cssW / 2;
  this.originY = cssH * 0.64;
};

/** 画面座標 → ワールド座標（z=0 の平面上） */
Renderer.prototype.toWorld = function (px, py) {
  return {
    x: (px - this.originX) / this.scale,
    y: (py - this.originY) / (this.scale * WORLD.depth)
  };
};

/** ワールド座標 → 画面座標 */
Renderer.prototype.toScreen = function (x, y, z) {
  return {
    x: this.originX + x * this.scale,
    y: this.originY + y * WORLD.depth * this.scale - (z || 0) * this.scale
  };
};

Renderer.prototype.addRipple = function (x, y, power) {
  this.ripples.push({ x: x, y: y, t: 0, power: power });
  if (this.ripples.length > 12) this.ripples.shift();
  this.rimPulse = Math.min(1.3, this.rimPulse + 0.55 + power * 0.3);
};

/** 背景画像を差し替える（null で通常の宇宙場所に戻す） */
Renderer.prototype.setBackdrop = function (path) {
  this.backdrop = path ? Sprites.byPath(path) : null;
  if (!path) this.backdropFade = 0;
};

/** トントンしたところから飛び散る小さな光の粒 */
Renderer.prototype.addSparks = function (x, y, power) {
  var n = 5 + Math.round(power * 5);
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2;
    var sp = (40 + Math.random() * 110) * (0.6 + power * 0.6);
    this.sparks.push({
      x: x, y: y, z: 2 + Math.random() * 6,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * WORLD.depth,
      vz: 40 + Math.random() * 90,
      life: 0.45 + Math.random() * 0.35, t: 0
    });
  }
  if (this.sparks.length > 90) this.sparks.splice(0, this.sparks.length - 90);
};

Renderer.prototype.addShake = function (dx, dy, power) {
  var d = Math.sqrt(dx * dx + dy * dy) || 1;
  this.shake.dx = dx / d;
  this.shake.dy = dy / d;
  this.shake.power = Math.min(1.4, this.shake.power * 0.5 + power);
  this.shake.t = 0;
  this.shake.dur = 0.34;
};

Renderer.prototype.update = function (dt) {
  this.space.update(dt);
  if (this.backdrop) this.backdropFade = Math.min(1, this.backdropFade + dt * 1.4);
  this.rumble = Math.max(0, this.rumble - dt * 2.6);   // rumble() で毎フレーム入れ直せる
  this.rimPulse *= Math.max(0, 1 - dt * 3.2);
  this.goldFlash = Math.max(0, this.goldFlash - dt * 1.1);

  for (var i = this.ripples.length - 1; i >= 0; i--) {
    this.ripples[i].t += dt;
    if (this.ripples[i].t > 0.7) this.ripples.splice(i, 1);
  }
  for (var s = this.sparks.length - 1; s >= 0; s--) {
    var p = this.sparks[s];
    p.t += dt;
    p.vz -= 260 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vx *= 0.94; p.vy *= 0.94;
    if (p.t >= p.life) this.sparks.splice(s, 1);
  }

  var sh = this.shake;
  if (sh.t < sh.dur) {
    sh.t += dt;
    var k = 1 - sh.t / sh.dur;
    var osc = Math.sin(sh.t * 58) * k * k * sh.power * 7;
    sh.x = sh.dx * osc;
    sh.y = sh.dy * osc * WORLD.depth;
  } else {
    sh.x = 0; sh.y = 0; sh.power *= 0.6;
  }
};

Renderer.prototype.draw = function (fighters, energy) {
  var ctx = this.ctx;
  ctx.clearRect(0, 0, this.cssW, this.cssH);

  // 背景の宇宙は揺らさない（揺れるのは土俵）
  this.space.draw(ctx, this.cssW, this.cssH);

  // 差し替え背景があれば、その上にじわっと重ねる
  if (this.backdrop && this.backdrop.ready && this.backdropFade > 0) {
    var img = this.backdrop.image;
    var sc = Math.max(this.cssW / img.width, this.cssH / img.height);
    var dw = img.width * sc, dh = img.height * sc;
    ctx.save();
    ctx.globalAlpha = this.backdropFade;
    ctx.drawImage(img, (this.cssW - dw) / 2, (this.cssH - dh) / 2, dw, dh);
    ctx.restore();
  }

  ctx.save();
  var rx = this.rumble ? (Math.random() * 2 - 1) * 5 * this.rumble : 0;
  var ry2 = this.rumble ? (Math.random() * 2 - 1) * 5 * this.rumble : 0;
  ctx.translate(this.shake.x + rx, this.shake.y + ry2);

  this.drawDohyo(energy);
  this.drawRipples();

  // 奥のキャラから先に描く
  var order = fighters.slice().sort(function (a, b) { return a.y - b.y; });
  var i;
  for (i = 0; i < order.length; i++) this.drawShadow(order[i]);
  for (i = 0; i < order.length; i++) this.drawFighter(order[i]);

  this.drawSparks();
  ctx.restore();

  // 金の招き猫イベントの金色の光（薄く重ねるだけで、土俵は隠さない）
  if (this.goldFlash > 0) {
    var gf = this.goldFlash;
    var g2 = ctx.createRadialGradient(this.originX, this.originY, 0,
                                      this.originX, this.originY, this.cssW * 0.72);
    g2.addColorStop(0, 'rgba(255,225,150,' + (0.34 * gf) + ')');
    g2.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  }

  // 場外へ飛んでいくキャラのひとこと（揺れの影響を受けない）
  for (i = 0; i < fighters.length; i++) this.drawCry(fighters[i]);

  // 暗転（登場演出用）
  if (this.darken > 0) {
    ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, this.darken) + ')';
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  }
};

/* ---------------- 宇宙場所の土俵 ---------------- */

Renderer.prototype.drawDohyo = function (energy) {
  var ctx = this.ctx;
  var sc = this.scale;
  var R = WORLD.radius * sc;
  var ry = R * WORLD.depth;
  var cx = this.originX, cy = this.originY;
  var glow = Math.min(1, this.rimPulse + energy * 0.7);

  // --- 浮遊感：土俵の下にひろがる光 ---
  var lift = ctx.createRadialGradient(cx, cy + ry * 1.5, R * 0.1, cx, cy + ry * 1.5, R * 1.25);
  lift.addColorStop(0, 'rgba(120,220,255,' + (0.20 + glow * 0.18) + ')');
  lift.addColorStop(1, 'rgba(120,220,255,0)');
  ctx.fillStyle = lift;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 1.5, R * 1.25, ry * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  this.drawRigging(cx, cy, R, ry, sc, glow);

  // --- 土台（機械の塊） ---
  var baseY = cy + 11 * sc;
  ctx.fillStyle = '#232c4c';
  ctx.beginPath();
  ctx.ellipse(cx, baseY, R * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  this.drawSkirt(cx, cy, baseY, R, ry, sc);
  this.drawThrusters(cx, cy, R, ry, sc, glow);

  // --- 土俵の面（ここは普通の土俵のまま） ---
  var g = ctx.createRadialGradient(cx, cy - ry * 0.3, R * 0.1, cx, cy, R * 1.05);
  g.addColorStop(0, '#f0dbab');
  g.addColorStop(1, '#d8bb82');
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // --- ふちの発光 ---
  ctx.save();
  ctx.strokeStyle = 'rgba(140,232,255,' + (0.35 + glow * 0.5) + ')';
  ctx.lineWidth = (2 + glow * 3) * sc;
  ctx.shadowColor = 'rgba(120,220,255,0.9)';
  ctx.shadowBlur = (10 + glow * 22) * sc;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 1.02, ry * 1.02, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 俵 ---
  var n = 34;
  for (var i = 0; i < n; i++) {
    var a = (i / n) * Math.PI * 2;
    var px = cx + Math.cos(a) * R;
    var py = cy + Math.sin(a) * ry;
    ctx.beginPath();
    ctx.ellipse(px, py, 7 * sc, 5 * sc, a, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#b28a4e' : '#c9a468';
    ctx.fill();
  }

  this.drawAntenna(cx, cy, R, ry, sc, glow);

  // --- 内側の線と仕切り線 ---
  ctx.strokeStyle = 'rgba(120,88,44,.35)';
  ctx.lineWidth = 2 * sc;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.86, ry * 0.86, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 5 * sc;
  ctx.beginPath();
  ctx.moveTo(cx - 34 * sc, cy - 20 * sc * WORLD.depth);
  ctx.lineTo(cx - 34 * sc, cy + 20 * sc * WORLD.depth);
  ctx.moveTo(cx + 34 * sc, cy - 20 * sc * WORLD.depth);
  ctx.lineTo(cx + 34 * sc, cy + 20 * sc * WORLD.depth);
  ctx.stroke();

  // --- 揺れが溜まっているほど熱をおびる ---
  if (energy > 0.02) {
    ctx.globalAlpha = Math.min(0.55, energy * 0.55);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = energy > VIBE.overdrive ? '#ff6b5c' : '#ffd166';
    ctx.lineWidth = (3 + energy * 6) * sc;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
};

/** 紅白の幕（土俵の側面）。和風の要素はここで残す。 */
Renderer.prototype.drawSkirt = function (cx, cy, baseY, R, ry, sc) {
  var ctx = this.ctx;
  var seg = 30;
  for (var i = 0; i < seg; i++) {
    var a0 = Math.PI * (i / seg);
    var a1 = Math.PI * ((i + 1) / seg);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * ry);
    ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * ry);
    ctx.lineTo(cx + Math.cos(a1) * R * 1.05, baseY + Math.sin(a1) * ry * 1.05);
    ctx.lineTo(cx + Math.cos(a0) * R * 1.05, baseY + Math.sin(a0) * ry * 1.05);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#d94a3d' : '#f6efe0';
    ctx.fill();
  }
};

/** 太陽電池パネル・アンテナなど、宇宙の特設土俵らしい部分 */
Renderer.prototype.drawRigging = function (cx, cy, R, ry, sc, glow) {
  var ctx = this.ctx;
  var panelY = cy + 6 * sc;

  for (var s = -1; s <= 1; s += 2) {
    var strutX = cx + s * R;
    var panelX = cx + s * (R + 5 * sc);

    ctx.strokeStyle = '#4a5678';
    ctx.lineWidth = 3.5 * sc;
    ctx.beginPath();
    ctx.moveTo(strutX, panelY);
    ctx.lineTo(panelX, panelY);
    ctx.stroke();

    var w = 24 * sc, h = 17 * sc;
    var px = s < 0 ? panelX - w : panelX;
    ctx.fillStyle = '#25407a';
    ctx.fillRect(px, panelY - h / 2, w, h);
    ctx.strokeStyle = 'rgba(150,200,255,0.45)';
    ctx.lineWidth = 1;
    for (var k = 1; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(px + (w / 3) * k, panelY - h / 2);
      ctx.lineTo(px + (w / 3) * k, panelY + h / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(px, panelY); ctx.lineTo(px + w, panelY);
    ctx.stroke();
    ctx.strokeStyle = '#5d6c94';
    ctx.lineWidth = 2 * sc;
    ctx.strokeRect(px, panelY - h / 2, w, h);
  }

};

/** 土俵の奥のふちに立つ小さなアンテナ（砂の面より後に描く） */
Renderer.prototype.drawAntenna = function (cx, cy, R, ry, sc, glow) {
  var ctx = this.ctx;
  var ax = cx + R * 0.66, ayy = cy - ry * 0.96;
  ctx.strokeStyle = '#6c7ba6';
  ctx.lineWidth = 3 * sc;
  ctx.beginPath();
  ctx.moveTo(ax, ayy); ctx.lineTo(ax + 7 * sc, ayy - 22 * sc);
  ctx.stroke();
  ctx.fillStyle = '#9db0d8';
  ctx.beginPath();
  ctx.ellipse(ax + 8 * sc, ayy - 25 * sc, 8 * sc, 5 * sc, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,120,110,' + (0.55 + glow * 0.45) + ')';
  ctx.beginPath();
  ctx.arc(ax + 8 * sc, ayy - 25 * sc, 2.2 * sc, 0, Math.PI * 2);
  ctx.fill();
};

/** 土俵を浮かせているスラスター */
Renderer.prototype.drawThrusters = function (cx, cy, R, ry, sc, glow) {
  var ctx = this.ctx;
  var spots = [-0.55, 0, 0.55];
  for (var i = 0; i < spots.length; i++) {
    var x = cx + spots[i] * R * 0.9;
    var y = cy + ry * (1.02 + (spots[i] === 0 ? 0.16 : 0.08));
    ctx.fillStyle = '#39456c';
    ctx.beginPath();
    ctx.moveTo(x - 9 * sc, y);
    ctx.lineTo(x + 9 * sc, y);
    ctx.lineTo(x + 6 * sc, y + 10 * sc);
    ctx.lineTo(x - 6 * sc, y + 10 * sc);
    ctx.closePath();
    ctx.fill();

    var fl = ctx.createLinearGradient(x, y + 8 * sc, x, y + (24 + glow * 14) * sc);
    fl.addColorStop(0, 'rgba(150,235,255,' + (0.65 + glow * 0.3) + ')');
    fl.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.moveTo(x - 6 * sc, y + 9 * sc);
    ctx.lineTo(x + 6 * sc, y + 9 * sc);
    ctx.lineTo(x, y + (24 + glow * 14) * sc);
    ctx.closePath();
    ctx.fill();
  }
};

Renderer.prototype.drawRipples = function () {
  var ctx = this.ctx;
  for (var i = 0; i < this.ripples.length; i++) {
    var r = this.ripples[i];
    var k = r.t / 0.7;
    var rad = (14 + k * 150 * r.power) * this.scale;
    var p = this.toScreen(r.x, r.y, 0);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rad, rad * WORLD.depth, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(190,245,255,' + (0.8 * (1 - k)) + ')';
    ctx.lineWidth = (4 * (1 - k) + 1) * this.scale;
    ctx.stroke();
  }
};

Renderer.prototype.drawSparks = function () {
  var ctx = this.ctx;
  for (var i = 0; i < this.sparks.length; i++) {
    var p = this.sparks[i];
    var k = 1 - p.t / p.life;
    var s = this.toScreen(p.x, p.y, Math.max(0, p.z));
    ctx.globalAlpha = k;
    ctx.fillStyle = i % 3 === 0 ? '#ffe9a8' : '#c9f4ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, (1.2 + k * 1.6) * this.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

/* ---------------- 力士 ---------------- */

Renderer.prototype.drawShadow = function (f) {
  if (f.state === 'out') return;          // 場外＝人工重力の外なので影も落ちない
  var ctx = this.ctx;
  var p = this.toScreen(f.x, f.y, 0);
  var lift = 1 / (1 + f.z / 90);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, f.radius * 1.05 * this.scale * lift,
              f.radius * 0.5 * this.scale * lift, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60,40,15,' + (0.30 * lift) + ')';
  ctx.fill();
};

Renderer.prototype.drawFighter = function (f) {
  var ctx = this.ctx;
  var c = f.character;
  var p = this.toScreen(f.x, f.y, f.z);
  var w = c.size.w * this.scale;
  var h = c.size.h * this.scale;

  var drift = f.driftScale;               // 場外へ遠ざかるほど小さくなる
  var sx = (1 + f.squash * 0.22) * drift;
  var sy = (1 - f.squash * 0.22) * drift;

  // 専用モーションを持つキャラ（雷神）は、状態に応じた絵を使う
  var mo = f.motion, msp = null, off = null;
  if (mo) {
    msp = Sprites.byPath(mo.spritePath(f));
    off = mo.offset();
    if (msp.ready) {
      // 正面の絵の高さを基準にして、どのポーズも同じ縮尺で描く
      var base = Sprites.byPath(mo.path('front'));
      var unit = (base.ready ? base.image.naturalHeight : msp.image.naturalHeight);
      var k = (c.size.h * this.scale) / unit;
      w = msp.image.naturalWidth * k;
      h = msp.image.naturalHeight * k;
    }
  }

  ctx.save();
  ctx.globalAlpha = f.state === 'out' ? Math.max(0, Math.min(1, (drift - 0.18) / 0.5)) : 1;
  ctx.translate(p.x + (off ? off.x * this.scale : 0), p.y + (off ? off.y * this.scale : 0));
  // tilt は姿勢、spinVisual は転がりなどの見た目だけの回転
  ctx.rotate(f.tilt + f.spinVisual + (off ? off.rot : 0));
  // モーションの絵は向きが描き込まれているので左右反転しない
  ctx.scale(sx * (mo ? 1 : f.facing), sy);

  // 特殊挙動が出た瞬間の発光（どのキャラでも同じ仕組み）
  if (f.auraTime > 0) {
    ctx.shadowColor = c.color;
    ctx.shadowBlur = 26 * this.scale * Math.min(1, f.auraTime * 2);
  }

  if (msp && msp.ready) {
    ctx.drawImage(msp.image, -w / 2, -h, w, h);
  } else {
    var sprite = Sprites.get(c, f.facingBack);
    if (sprite.ready) {
      ctx.drawImage(sprite.image, -w / 2, -h, w, h);
    } else {
      this.drawFallbackBody(c, w, h);
    }
  }
  ctx.restore();

  if (mo) this.drawEffects(f, p);
};

/** モーション用のエフェクト（本体とは別レイヤー） */
Renderer.prototype.drawEffects = function (f, p) {
  var mo = f.motion;
  if (!mo || !mo.effects.length) return;
  var ctx = this.ctx;
  for (var i = 0; i < mo.effects.length; i++) {
    var e = mo.effects[i];
    var img = Sprites.byPath(e.path);
    if (!img.ready) continue;
    var k = e.t / e.life;
    var s = (0.7 + k * 0.5) * this.scale * 0.85;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
    ctx.drawImage(img.image,
      p.x + e.dx * this.scale - img.image.naturalWidth * s / 2,
      p.y + e.dy * this.scale - img.image.naturalHeight * s / 2 - k * 14 * this.scale,
      img.image.naturalWidth * s, img.image.naturalHeight * s);
    ctx.restore();
  }
};

/** 画像が用意できていないキャラクター共通の仮図形 */
Renderer.prototype.drawFallbackBody = function (c, w, h) {
  var ctx = this.ctx;
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.26, w * 0.42, h * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -h * 0.66, w * 0.31, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(-w * 0.42, -h * 0.20, w * 0.84, h * 0.09);
};

/** 場外へ飛ばされたキャラのひとこと（キャラクターデータの outCry） */
Renderer.prototype.drawCry = function (f) {
  if (f.state !== 'out' || !f.character.outCry) return;
  var k = Math.min(1, f.stateTime / 0.18);
  var fade = Math.max(0, 1 - Math.max(0, f.stateTime - 0.9) / 0.6);
  if (fade <= 0) return;

  var ctx = this.ctx;
  var p = this.toScreen(f.x, f.y, f.z + f.character.size.h * 0.9);
  var size = Math.max(11, 15 * this.scale * (0.6 + f.driftScale * 0.4));
  // 画面の外へ飛んでいっても、ひとことだけは読めるようにする
  var pad = 44 * this.scale;
  p.x = Math.max(pad, Math.min(this.cssW - pad, p.x));
  p.y = Math.max(pad * 0.5, Math.min(this.cssH - pad * 0.5, p.y));

  ctx.save();
  ctx.globalAlpha = fade * k;
  ctx.font = '700 ' + size + 'px "Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(12,16,36,0.85)';
  ctx.strokeText(f.character.outCry, p.x, p.y - 6 * (2 - k));
  ctx.fillStyle = '#fff3d0';
  ctx.fillText(f.character.outCry, p.x, p.y - 6 * (2 - k));
  ctx.restore();
};
