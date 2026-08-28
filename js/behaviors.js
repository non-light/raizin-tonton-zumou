/* =========================================================================
 * behaviors.js — キャラクターの特殊挙動
 *
 * キャラクターデータの specialBehavior に、ここのキー名を書くだけで効く。
 * キャラクター個別の分岐は物理側にも描画側にも書かない。
 *
 * 各挙動は次の3つを好きなだけ持てる（全部省略可）。
 *   modify(f, m)        毎ステップ、係数を書き換える
 *                       m = { friction, fallAngle, gravity, airContact, damping }
 *   vibration(f, info)  土俵の振動を受けた瞬間
 *                       info = { nx, ny, ix, iy, scale, energy }
 *                       ix, iy は実際に加わった横向きの力。ここを足し引きすれば
 *                       「反応曲線」をキャラごとに変えられる。
 *   step(f, dt, env)    毎ステップ  env = { energy, opponent }
 *
 * 一時的な状態は f.bstate に入れる（対戦開始時に空になる）。
 * 見た目は f.spinVisual（回転）と f.auraTime（発光）で表現する。
 * ========================================================================= */

var BEHAVIORS = {

  /* ---------------- 基本の4体 ---------------- */

  /* 雷神：基準。よろけは小さく、連打していると少しずつ不安定になる */
  balanced: {
    vibration: function (f, info) {
      if (info.energy > 0.5) {
        f.tiltVel += (Math.random() * 2 - 1) * 0.6 * info.energy;
      }
    }
  },

  /* 黒猫：軽い。1回で大きく動き、小刻みに跳ね、向きがよく変わる */
  featherweight: {
    vibration: function (f, info) {
      // 受けた向きからずれて滑る＝方向転換が多く見える
      var a = (Math.random() * 2 - 1) * 0.55;
      var c = Math.cos(a), s = Math.sin(a);
      f.vx += info.ix * (c - 1) - info.iy * s;
      f.vy += info.ix * s + info.iy * (c - 1);
      if (f.isGrounded()) f.vz += 60 + Math.random() * 55;    // 小刻みに跳ねる
      if (info.energy > 0.55) {                               // 強い振動で一気に吹っ飛ぶ
        f.vx += info.ix * 1.15; f.vy += info.iy * 1.15;
        f.vz += 75;
        f.auraTime = 0.25;
      }
    },
    modify: function (f, m) {
      if (!f.isGrounded()) m.friction *= 0.5;                 // 浮くとよく滑る
    },
    step: function (f, dt, env) {
      if (!f.isGrounded() || env.energy < 0.05) return;
      var j = 135 * env.energy * dt;
      f.vx += (Math.random() * 2 - 1) * j;
      f.vy += (Math.random() * 2 - 1) * j;
    }
  },

  /* ロボット：弱いトントンではほとんど動かない。動き出すと止まりにくい */
  heavyweight: {
    vibration: function (f, info) {
      // 反応曲線：弱い振動はほとんど通さず、強い振動が続いたときだけ効く
      var pass = Math.min(1, 0.35 + info.energy * 1.3);
      f.vx -= info.ix * (1 - pass);
      f.vy -= info.iy * (1 - pass);
      f.vz *= 0.35;                       // 跳ねずにドスンと沈む
      f.tiltVel *= 0.45;                  // 揺れも小さい
    },
    modify: function (f, m) {
      var sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
      if (sp > 45) m.friction *= 0.30;    // 一度動き出すと慣性が強い
      else m.damping += 1.2;              // 止まっているときは踏ん張る
    }
  },

  /* たぬき：癖がなく、雷神より少しゆったり */
  roundish: {
    modify: function (f, m) { m.damping += 0.55; },
    vibration: function (f, info) { f.tiltVel *= 0.72; }
  },

  /* ---------------- 通常キャラの個性 ---------------- */

  /* スズメ：動きが読めない。ときどき突然大きく跳ねる */
  skittish: {
    modify: function (f, m) { if (f.bstate.flap > 0) m.gravity *= 0.68; },
    vibration: function (f, info) {
      if (!f.isGrounded()) return;
      if (Math.random() < 0.34) {
        var a = Math.random() * Math.PI * 2;
        f.vx += Math.cos(a) * 150 * info.scale;
        f.vy += Math.sin(a) * 150 * info.scale;
        f.vz += 120 * info.scale;
        f.bstate.flap = 0.45;
        f.auraTime = 0.2;
      }
    },
    step: function (f, dt) { if (f.bstate.flap > 0) f.bstate.flap -= dt; }
  },

  /* カエル：ときどき大ジャンプ。相手を飛び越えたり、自分から場外へ飛んだりする */
  suddenJump: {
    vibration: function (f, info) {
      if (!f.isGrounded()) return;
      if (Math.random() < 0.10 + info.energy * 0.26) {
        var a = Math.random() * Math.PI * 2;
        f.vz += 320;
        f.vx += Math.cos(a) * 195;
        f.vy += Math.sin(a) * 195;
        f.auraTime = 0.35;
      }
    }
  },

  /* カニ：左右にはめっぽう速く、前後にはほとんど動かない */
  sideways: {
    vibration: function (f, info) {
      f.vx += info.ix * 1.45;          // 横は約2.5倍
      f.vy -= info.iy * 0.80;          // 前後は約0.2倍
    },
    step: function (f, dt) { f.vy *= Math.exp(-2.6 * dt); }
  },

  /* カメ：ほとんど跳ねず、ほとんど倒れない */
  lowCenter: {
    modify: function (f, m) {
      m.fallAngle *= 1.8;
      if (f.isGrounded()) m.damping += 1.0;
    },
    vibration: function (f, info) { f.vz *= 0.25; f.tiltVel *= 0.6; }
  },

  /* うさぎ：横より縦。ときどきとんでもなく高く跳ぶ */
  bigJump: {
    vibration: function (f, info) {
      if (!f.isGrounded()) return;
      f.vx -= info.ix * 0.45;                    // 横にはあまり行かない
      f.vy -= info.iy * 0.45;
      f.vz += 70;
      if (Math.random() < 0.12 + info.energy * 0.42) {
        f.vz += 215 + info.energy * 150;
        f.auraTime = 0.3;
      }
    }
  },

  /* タコ：ぐにゃぐにゃ揺れるが倒れない。動く向きが少し読めない */
  squishy: {
    modify: function (f, m) { m.fallAngle *= 2.3; },
    vibration: function (f, info) {
      var a = (Math.random() * 2 - 1) * 0.65;
      var c = Math.cos(a), s = Math.sin(a);
      f.vx += info.ix * (c - 1) - info.iy * s;
      f.vy += info.ix * s + info.iy * (c - 1);
      f.tiltVel += (Math.random() * 2 - 1) * 1.4 * info.scale;
    }
  },

  /* だるま：歩かずに、傾いて転がる */
  roll: {
    modify: function (f, m) {
      if (f.bstate.rolling) { m.friction *= 0.12; m.fallAngle *= 5; }
    },
    vibration: function (f, info) {
      f.tiltVel += (info.ix >= 0 ? 1 : -1) * 0.95 * info.scale;   // すぐ傾く
    },
    step: function (f, dt) {
      var sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
      var b = f.bstate;
      if (!b.rolling && (Math.abs(f.tilt) > f.fallAngle() * 0.25 || sp > 40)) b.rolling = true;
      if (b.rolling) {
        f.spinVisual += (f.vx >= 0 ? 1 : -1) * Math.min(16, sp * 0.09) * dt;
        f.tilt *= Math.max(0, 1 - dt * 6);
        if (sp < 18) b.rolling = false;
      }
    }
  },

  /* ハリネズミ：強く押されると丸くなり、そのまま転がっていく */
  curlUp: {
    modify: function (f, m) {
      if (f.bstate.curl > 0) { m.friction *= 0.45; m.fallAngle *= 2.6; }
    },
    vibration: function (f, info) {
      if (Math.sqrt(info.ix * info.ix + info.iy * info.iy) > 12) {
        f.bstate.curl = 1.1;
        f.auraTime = 0.2;
      }
    },
    step: function (f, dt) {
      if (f.bstate.curl > 0) {
        f.bstate.curl -= dt;
        var sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
        f.spinVisual += (f.vx >= 0 ? 1 : -1) * Math.min(12, sp * 0.07) * dt;
        f.tilt *= Math.max(0, 1 - dt * 5);
      }
    }
  },

  /* おばけ：少し浮いていて、振動に流されやすい */
  floaty: {
    modify: function (f, m) { m.gravity *= 0.78; m.airContact *= 1.7; },
    step: function (f, dt, env) {
      var b = f.bstate;
      b.t = (b.t || 0) + dt;
      f.vx += Math.sin(b.t * 0.8) * 26 * dt;
      f.vy += Math.cos(b.t * 0.6) * 18 * dt;
      if (f.isGrounded() && Math.random() < dt * 1.3) f.vz += 45;
    }
  },

  /* ---------------- ボス ---------------- */

  /* 金の招き猫：ときどき手招きして相手をはたき出す */
  luckyPaw: {
    step: function (f, dt, env) {
      var b = f.bstate;
      b.t = (b.t === undefined ? 3 : b.t) - dt;
      if (b.t > 0) return;
      b.t = 3.2 + Math.random() * 2.6;
      var o = env.opponent;
      if (!o || o.state !== 'fight') return;
      var dx = o.x - f.x, dy = o.y - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > 200) return;
      o.push(dx / d * 150, dy / d * 150, dx / d * 0.9);
      o.vz += 85;
      f.auraTime = 0.45; f.ring = 1; f.shoutTime = 1.0;
    }
  },

  /* 雷神・覚醒モード：ときどき雷をまとって強い反発力を出す */
  thunderBurst: {
    step: function (f, dt, env) {
      var b = f.bstate;
      b.t = (b.t === undefined ? 4 : b.t) - dt;
      if (b.t > 0) return;
      b.t = 4.5 + Math.random() * 3;
      var o = env.opponent;
      if (!o || o.state !== 'fight') return;
      var dx = o.x - f.x, dy = o.y - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var p = 205 / (1 + d / 110);
      o.push(dx / d * p, dy / d * p, dx / d * 1.4);
      o.vz += 100;
      f.auraTime = 0.65; f.ring = 1; f.shoutTime = 1.0;
    }
  },

  /* もりけんさん：ほとんど動かない。ただし突然大きく動くか、強烈に押し返す */
  moriken: {
    step: function (f, dt, env) {
      var b = f.bstate;
      b.t = (b.t === undefined ? 4.5 : b.t) - dt;
      if (b.t > 0) return;
      b.t = 3.6 + Math.random() * 3.4;
      if (Math.random() < 0.45) {
        var a = Math.random() * Math.PI * 2;
        f.vx += Math.cos(a) * 205;
        f.vy += Math.sin(a) * 205;
        f.vz += 60;
        f.auraTime = 0.5; f.ring = 0.8; f.shoutTime = 0.9;
      } else {
        var o = env.opponent;
        if (!o || o.state !== 'fight') return;
        var dx = o.x - f.x, dy = o.y - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        // 押し返しは軽いキャラほど効きすぎるので、上限をつけておく
        // 押し返しは軽いキャラほど効きすぎるので、相手の重さで加減し上限もつける
        var p = Math.min(320, 320 / (1 + d / 110) * (0.6 + 0.4 * o.stats.weight));
        o.push(dx / d * p, dy / d * p, dx / d * 1.3);
        o.vz += 130;
        f.auraTime = 0.6; f.ring = 1; f.shoutTime = 1.1;
      }
    }
  },

  /* シークレット：中身は未定。ここを書き換えれば性格がつく。 */
  secretPower: {
    vibration: function (f, info) { f.tiltVel *= 0.7; }
  }
};

function getBehavior(character) {
  return (character && character.specialBehavior && BEHAVIORS[character.specialBehavior]) || null;
}
