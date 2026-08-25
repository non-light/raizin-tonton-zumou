/* =========================================================================
 * kimarite.js — 決まり手
 *
 * 上から順に条件を見て、最初に当てはまったものを決まり手にする。
 * 増やすときはこの表に1件足すだけでよい。
 * ========================================================================= */

var KIMARITE = [
  {
    id: 'atsu',
    name: '圧',
    note: '静かなのに、なぜか押し負ける',
    special: true,                       // 専用の見せかたをする
    only: 'moriken',                     // このキャラが勝ったときだけ
    when: function (c) {
      // 「相手はほとんど動いていないのに、自分だけ動かされて出た」形かどうか。
      // 接触の長さで見ると、押し合いが続かない試合では一度も出なくなるため、
      // 動いた距離の差で判定する。
      return c.winnerTravel < c.loserTravel * 0.60   // 勝った側の移動が明らかに少ない
          && c.loserExitSpeed < 320;                 // 派手に吹っ飛んだわけではない
    }
  },
  {
    id: 'huttobi',
    name: '吹っ飛び',
    when: function (c) { return c.loserExitSpeed > 330 || Math.abs(c.loserSpin) > 2.4; }
  },
  {
    id: 'tsukidashi',
    name: '突き出し',
    when: function (c) { return c.lastHitSpeed > 190 && c.sinceContact < 1.1; }
  },
  {
    id: 'oshidashi',
    name: '押し出し',
    when: function (c) { return c.loserContact > 0.22 && c.sinceContact < 1.6; }
  },
  {
    id: 'jimetsu',
    name: '自滅',
    when: function () { return true; }   // どれにも当てはまらなければ自滅
  }
];

/** 決まり手を1つ選ぶ。result は Game が作る勝敗情報。 */
function judgeKimarite(result) {
  if (!result || result.draw || !result.winner || !result.loser) return null;
  var w = result.winner, l = result.loser;
  var ctx = {
    winner: w, loser: l,
    winnerTravel: w.travel,
    loserTravel: l.travel,
    loserContact: l.contactTotal,
    sinceContact: l.contactRecent,
    lastHitSpeed: l.lastHitSpeed,
    loserExitSpeed: l.exitSpeed,
    loserSpin: l.spin,
    reason: result.reason
  };
  // 転倒での決着は、押し合いがあったかどうかで分ける
  for (var i = 0; i < KIMARITE.length; i++) {
    var k = KIMARITE[i];
    if (k.only && w.character.id !== k.only) continue;
    if (k.when(ctx)) return k;
  }
  return null;
}

/** 決まり手ごとの専用セリフ。無ければ空文字。 */
function getKimariteLine(result, character, won) {
  var k = result && result.kimarite;
  if (!k || !character || !character.kimariteLines) return '';
  var set = character.kimariteLines[k.id];
  var list = set && (won ? set.win : set.lose);
  if (!list || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}
