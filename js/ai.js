/* =========================================================================
 * ai.js — 「寄り」（相手へ詰める動き）
 *
 * トントン相撲の力士は、土俵が揺れると自然に前へ出る。
 * その寄りを、プレイヤー側・CPU側の区別なく同じ関数で処理する。
 * どれだけ前に出るかはキャラクターデータの aggression だけで決まるので、
 * 同じキャラなら操作側でも相手側でも性能はまったく同じになる。
 * 自由に動き回るのではなく、土俵が揺れているときに
 * 「相手のほうへ重心を移す」程度の力をかける。
 * 強さはキャラクターデータの aggression で決まる。
 * ========================================================================= */

var AI = {
  stepImpulse: 108,    // 一歩踏み込むときの勢い
  interval: 0.40,      // 踏み込みの間隔（積極性が高いほど短くなる）
  hop: 26,             // 踏み込みの浮き
  holdLine: 0.58,      // 土俵半径のこの割合より外へ出されたら踏み込まない
  centerBias: 0.35,    // 土俵の外側にいるときは内側寄りに踏み込む
  jitter: 0.30         // 踏み込む向きのばらつき（スズメなどが不規則になる）
};

/**
 * 力士を1ステップ「寄らせる」。プレイヤー側にも同じものを適用する。
 * 常に押し続けるのではなく、一定間隔でトンと踏み込む。
 * こうするとトントンの押し出しを打ち消さず、それでいて自分から前へ出てくる。
 *
 * f     : 動かす力士
 * foe   : 相手
 * energy: 土俵の揺れ具合
 */
function stepAI(f, foe, energy, dt) {
  if (f.state !== 'fight' || !foe || foe.state !== 'fight') return;

  var ag = f.stats.aggression;
  if (ag === undefined) ag = 0.5;
  if (ag <= 0) return;

  if (f.aiTimer === undefined) f.aiTimer = AI.interval * (0.5 + Math.random());
  f.aiTimer -= dt;
  if (f.aiTimer > 0) return;
  f.aiTimer = AI.interval / Math.max(0.25, ag) * (0.7 + Math.random() * 0.6);

  if (!f.isGrounded()) return;                       // 浮いていたら踏み込めない

  // 押し出されて土俵際まで来ているときは、前へ踏み込む余裕はない。
  // （ここで踏み込ませると、トントンで押した分が毎回帳消しになって勝負がつかない）
  var here = Math.sqrt(f.x * f.x + f.y * f.y);
  if (here > WORLD.radius * AI.holdLine) return;

  var dx = foe.x - f.x, dy = foe.y - f.y;
  var d = Math.sqrt(dx * dx + dy * dy) || 1;
  // 境界のちょうど手前で止まると永久に触れないので、少し内側まで踏み込む
  if (d < (f.radius + foe.radius) * 0.90) return;    // もう十分組んでいる

  var nx = dx / d, ny = dy / d;

  // 土俵の外側にいるときは、少し内側へ向けて踏み込む（吸い寄せにはしない）
  var dist = Math.sqrt(f.x * f.x + f.y * f.y);
  if (dist > WORLD.radius * 0.5) {
    nx -= (f.x / dist) * AI.centerBias;
    ny -= (f.y / dist) * AI.centerBias;
    var n = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= n; ny /= n;
  }

  // 向きのばらつき（キャラの個性）
  var a = (Math.random() * 2 - 1) * AI.jitter * ag;
  var c = Math.cos(a), sn = Math.sin(a);
  var ux = nx * c - ny * sn, uy = nx * sn + ny * c;

  // 揺れているほど踏み込みやすい
  var drive = 0.55 + 0.45 * Math.min(1, energy * 1.6);
  var imp = AI.stepImpulse * ag * drive / f.stats.weight;
  f.vx += ux * imp;
  f.vy += uy * imp;
  f.vz += AI.hop * f.stats.bounce;
}
