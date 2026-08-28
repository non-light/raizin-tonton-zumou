/* =========================================================================
 * progress.js — 進行状況とCPUの抽選
 *
 * ボス・隠しキャラクターは選択画面には並ばない。
 * 対戦相手は毎回この中の pickCpuCharacter() が重み付きで選ぶ。
 * 確率も出現条件も characters.js 側（cpuWeight / unlockCondition）にあるので、
 * ここには個別のキャラクター名も確率も書かない。
 * ========================================================================= */

var Progress = (function () {
  var KEY = 'raizin-tonton-zumou/progress';
  var data = {
    wins: 0,
    losses: 0,
    streak: 0,        // 連勝数
    matches: 0,
    usedWith: {},     // キャラid → そのキャラで戦った回数
    defeated: {},     // キャラid → 倒した回数
    met: {},          // キャラid → 出会った回数
    lastMet: {},      // キャラid → 最後に当たったときの試合数（レア枠の救済に使う）
    unlocked: {}      // キャラid → 正体が判明したか
  };

  function load() {
    try {
      var raw = window.localStorage && localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var k in saved) if (saved.hasOwnProperty(k)) data[k] = saved[k];
      }
    } catch (e) { /* 保存できない環境ではその場かぎりの進行になる */ }
  }

  function save() {
    try {
      if (window.localStorage) localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* 無視してよい */ }
  }

  function recordMatchStart(playerChar, opponentChar) {
    data.matches++;
    data.usedWith[playerChar.id] = (data.usedWith[playerChar.id] || 0) + 1;
    data.met[opponentChar.id] = (data.met[opponentChar.id] || 0) + 1;
    data.lastMet[opponentChar.id] = data.matches;
    save();
  }

  function recordResult(playerChar, opponentChar, won) {
    if (won) {
      data.wins++;
      data.streak++;
      data.defeated[opponentChar.id] = (data.defeated[opponentChar.id] || 0) + 1;
      if (opponentChar.hidden) data.unlocked[opponentChar.id] = true;
    } else {
      data.losses++;
      data.streak = 0;
    }
    save();
  }

  function bossesDefeated() {
    var n = 0;
    for (var i = 0; i < CHARACTERS.length; i++) {
      var c = CHARACTERS[i];
      if (c.boss && data.defeated[c.id]) n++;
    }
    return n;
  }

  return {
    data: data,
    load: load,
    save: save,
    recordMatchStart: recordMatchStart,
    recordResult: recordResult,
    bossesDefeated: bossesDefeated,
    isUnlocked: function (id) { return !!data.unlocked[id]; },
    reset: function () {
      data.wins = data.losses = data.streak = data.matches = 0;
      data.usedWith = {}; data.defeated = {}; data.met = {}; data.unlocked = {}; data.lastMet = {};
      save();
    }
  };
})();

/* -------------------------------------------------------------------------
 * CPU（対戦相手）の抽選
 *
 * 確率はキャラクターデータ側の cpuWeight で決める。ここには個別の
 * キャラクター名も確率も書かない。調整は characters.js だけで完結する。
 *
 *   cpuEnabled      CPUとして出せるか
 *   cpuWeight       重み。大きいほどよく出る。0 なら出ない。
 *   unlockCondition 省略可。true を返したときだけ抽選に入る。
 * ------------------------------------------------------------------------- */

/**
 * そのキャラのいまの重み。
 * cpuWeight には数値のほか、関数も書ける（進行状況で重みを変えたいとき用）。
 */
function cpuWeightOf(c) {
  var w = typeof c.cpuWeight === 'function' ? c.cpuWeight(Progress.data) : c.cpuWeight;
  return (typeof w === 'number' && w > 0) ? w : 0;
}

/** いま抽選対象になるCPU候補（プレイヤーと同じキャラは除く） */
function getCpuCandidates(playerChar) {
  var out = [];
  for (var i = 0; i < CHARACTERS.length; i++) {
    var c = CHARACTERS[i];
    if (!c.cpuEnabled) continue;
    if (cpuWeightOf(c) <= 0) continue;
    if (playerChar && c.id === playerChar.id && !RULES.allowMirrorMatch) continue;
    if (c.unlockCondition && !c.unlockCondition(Progress.data)) continue;
    out.push(c);
  }
  return out;
}

/** 最後にそのキャラと当たってから何試合たったか */
function matchesSinceMet(id) {
  var at = Progress.data.lastMet && Progress.data.lastMet[id];
  if (at === undefined) return Progress.data.matches;      // 一度も会っていない
  return Progress.data.matches - at;
}

/** 重み付きランダムで対戦相手を1体選ぶ */
function pickCpuCharacter(playerChar) {
  var list = getCpuCandidates(playerChar);
  if (!list.length) return null;
  var total = 0, i, w = [];
  for (i = 0; i < list.length; i++) { w[i] = cpuWeightOf(list[i]); total += w[i]; }
  var r = Math.random() * total;
  for (i = 0; i < list.length; i++) {
    r -= w[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

/** 「特別な登場」にするかどうか（ボスや隠しキャラ） */
function isRareOpponent(character) {
  return !!(character && (character.boss || character.hidden));
}
