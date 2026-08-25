/* =========================================================================
 * ui.js — 画面の流れ
 *   キャラクター選択 → 対戦相手選択 → VSカード → 開始演出 → 対戦 → 結果
 * ページを再読み込みせずに、この流れを何度でも繰り返せる。
 * ========================================================================= */

var UI = (function () {
  var el = {};
  var game = null;
  var timers = [];
  var state = { playerChar: null, opponentChar: null, bossAnnounce: null };

  function $(id) { return document.getElementById(id); }

  function init() {
    el.screens = {
      player: $('screen-player'),
      battle: $('screen-battle')
    };
    el.playerGrid = $('player-grid');
    el.confirm = $('btn-confirm');
    el.hudPlayer = $('hud-player');
    el.hudOpponent = $('hud-opponent');
    el.gauge = $('gauge');
    el.gaugeFill = $('gauge-fill');
    el.gaugeLabel = $('gauge-label');
    el.overlay = $('overlay');
    el.stage = document.querySelector('.stage');
    el.modal = $('result-modal');
    el.resultTitle = $('result-title');
    el.resultReason = $('result-reason');
    el.resultLine = $('result-line');

    el.vsCard = buildVsCard();
    el.stage.appendChild(el.vsCard);

    Progress.load();
    Sprites.preloadAll();

    game = new Game($('dohyo'), { onEnergy: onEnergy, onFinish: onFinish });

    el.confirm.addEventListener('click', function () {
      if (state.playerChar) startEncounter();
    });
    // 対戦中でもキャラ選択へ戻れる（取組は中断される）
    $('btn-quit').addEventListener('click', showPlayerSelect);
    $('btn-rematch').addEventListener('click', rematch);
    $('btn-change').addEventListener('click', backToSelect);

    showPlayerSelect();
  }

  /* ---------------- タイマー管理 ---------------- */

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers.length = 0;
  }

  /* ---------------- 画面切り替え ---------------- */

  function show(name) {
    for (var k in el.screens) {
      if (el.screens.hasOwnProperty(k)) el.screens[k].hidden = (k !== name);
    }
  }

  /* ---------------- 1. 自分のキャラクターを選ぶ ---------------- */

  function showPlayerSelect() {
    clearTimers();
    game.stop();
    el.modal.hidden = true;
    el.overlay.hidden = true;
    el.vsCard.hidden = true;
    state.playerChar = null;
    state.opponentChar = null;
    game.setBackdrop(null);      // 専用背景を次の試合へ持ち越さない
    game.setDarken(0);
    setConfirm(null);

    buildCards(el.playerGrid, function (character, card) {
      state.playerChar = character;
      var all = el.playerGrid.querySelectorAll('.char-card');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('selected');
      card.classList.add('selected');
      setConfirm(character);
    });
    show('player');
  }

  function setConfirm(character) {
    el.confirm.disabled = !character;
    el.confirm.textContent = character
      ? character.name + ' で戦う！'
      : 'このキャラで戦う！';
  }

  /** キャラクターカードを並べる（並ぶのは playable のキャラだけ） */
  function buildCards(grid, onPick) {
    grid.innerHTML = '';
    var list = getPlayableCharacters();
    for (var i = 0; i < list.length; i++) {
      (function (c) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'char-card';
        card.style.setProperty('--tint', c.color);

        card.appendChild(Sprites.createThumb(c, 'thumb'));

        var name = document.createElement('span');
        name.className = 'name';
        name.textContent = displayName(c);
        card.appendChild(name);

        var tag = document.createElement('span');
        tag.className = 'tagline';
        tag.textContent = displayDescription(c);
        card.appendChild(tag);

        var type = document.createElement('span');
        type.className = 'type';
        type.textContent = c.type;
        card.appendChild(type);

        card.addEventListener('click', function () { onPick(c, card); });
        grid.appendChild(card);
      })(list[i]);
    }
  }

  /* ---------------- 2. 対戦相手をランダムに決める ---------------- */

  /**
   * CPUを抽選し、決まる瞬間を演出として見せる。
   * ボス・隠しキャラのときは「招き猫が招いた」特別イベントにする。
   */
  function startEncounter() {
    clearTimers();
    state.opponentChar = pickCpuCharacter(state.playerChar);
    if (!state.opponentChar) { showPlayerSelect(); return; }

    show('battle');
    el.modal.hidden = true;
    el.vsCard.hidden = true;
    buildHud();
    Progress.recordMatchStart(state.playerChar, state.opponentChar);
    game.setup(state.playerChar, state.opponentChar);
    game.run();
    game.freeze(true);                 // 演出のあいだは土俵を止めておく

    // 専用の登場演出をもつ相手（裏ボス）は、通常のCPU決定演出を使わない
    if (state.opponentChar.entrance) { playEntrance(state.opponentChar); return; }

    var rare = isRareOpponent(state.opponentChar);
    banner('今回の対戦相手は……', 'cpu');
    later(function () {
      if (rare) playManekiEvent(); else revealOpponent();
    }, FLOW.cpuThinking);
  }

  /**
   * 裏ボス専用の登場演出。
   *   1 暗転 → 2「……何か来る」→ 3 専用背景がフェードイン
   *   → 4「〜が現れた！」→ 5 はっけよーい／のこった
   * 文言も背景もキャラクターデータ（entrance / battleBackground）から取る。
   */
  function playEntrance(c) {
    var e = c.entrance;
    el.overlay.hidden = true;
    game.setBackdrop(null);                 // 暗転のあいだは背景を見せない

    var t0 = performance.now(), DARK = 800;
    (function fade() {                      // 1. ゆっくり暗転
      var k = Math.min(1, (performance.now() - t0) / DARK);
      game.setDarken(k);
      if (k < 1) requestAnimationFrame(fade); else step2();
    })();

    function step2() {                      // 2.「……何か来る」
      banner(e.omen, 'omen-dark');
      Sound.omen(1.4);
      game.rumble(0.5);
      later(step3, FLOW.omenHold);
    }

    function step3() {                      // 3. 専用背景がフェードイン
      el.overlay.hidden = true;
      game.setBackdrop(c.battleBackground || null);
      game.goldFlash();
      var t1 = performance.now(), LIFT = 700;
      (function lift() {
        var k = Math.min(1, (performance.now() - t1) / LIFT);
        game.setDarken(1 - k);
        if (k < 1) requestAnimationFrame(lift); else step4();
      })();
    }

    function step4() {                      // 4.「〜が現れた！」＋ ズン
      game.setDarken(0);
      banner(e.arrival, 'arrival');
      Sound.boom();
      game.rumble(1);
      game.renderer.addShake(0, 1, 1.2);
      later(function () {
        el.overlay.hidden = true;
        playIntro(true);                    // 5. はっけよーい → のこった
      }, FLOW.arrivalHold);
    }
  }

  /** ふつうの相手：名前を出してから対戦カードへ */
  function revealOpponent() {
    banner(displayName(state.opponentChar) + '！', 'cpu');
    Sound.reveal();
    later(showVsCard, FLOW.cpuReveal);
  }

  /** レア相手：金の招き猫が「招いた」ことを、はっきり見せる */
  function playManekiEvent() {
    banner('招き猫が、何かを招いている……！', 'omen');
    Sound.shakin();
    game.goldFlash();
    later(function () {
      var c = state.opponentChar;
      var text = c.id === 'maneki_gold'
        ? '金の招き猫が現れた！'
        : '金の招き猫が、' + displayName(c) + 'を招いた！';
      banner(text, 'boss');
      Sound.shakin();
      game.goldFlash();
      later(showVsCard, FLOW.bossReveal);
    }, FLOW.bossOmen);
  }

  /* ---------------- 3. 対戦カードと開始演出 ---------------- */

  function buildVsCard() {
    var box = document.createElement('div');
    box.className = 'vs-card';
    box.hidden = true;
    box.innerHTML =
      '<div class="side enter-l" data-side="left"></div>' +
      '<div class="vs">VS</div>' +
      '<div class="side enter-r" data-side="right"></div>';
    return box;
  }

  function fillVsSide(side, character, whoLabel, animClass) {
    side.innerHTML = '';
    side.className = 'side ' + animClass;
    side.style.setProperty('--tint', character.color);

    var thumb = Sprites.createThumb(character, 'vs-thumb');
    // vs-card 内は img/fallback をそのまま並べる
    while (thumb.firstChild) side.appendChild(thumb.firstChild);

    var who = document.createElement('div');
    who.className = 'who';
    who.textContent = whoLabel;
    var nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = displayName(character);
    side.appendChild(nm);
    side.appendChild(who);
  }

  function showVsCard() {
    el.overlay.hidden = true;
    var sides = el.vsCard.querySelectorAll('.side');
    fillVsSide(sides[0], state.playerChar, 'あなた', 'enter-l');
    fillVsSide(sides[1], state.opponentChar, 'あいて', 'enter-r');
    el.vsCard.classList.toggle('boss', !!state.opponentChar.boss);
    el.vsCard.hidden = false;
    later(function () {
      el.vsCard.hidden = true;
      playIntro();
    }, FLOW.vsCard);
  }

  /**
   * 宇宙場所 → はっけよーい…… → （ひと呼吸） → のこった！
   * 「のこった！」が出るまでトントンしても土俵は動かない。
   */
  function playIntro(skipBasho) {
    // 裏ボス戦は専用会場なので「宇宙場所」は挟まない
    if (skipBasho) { hakkeyoi(); return; }
    banner('宇宙場所', 'basho');
    later(hakkeyoi, FLOW.uchuBasho);

    function hakkeyoi() {
      banner('はっけよーい……');
      later(function () {
        el.overlay.hidden = true;              // ひと呼吸おく
        later(function () {
          banner('のこった！');
          game.freeze(false);                  // ここから操作できる
          later(function () { el.overlay.hidden = true; }, FLOW.nokotta);
        }, FLOW.beforeNokotta);
      }, FLOW.hakkeyoi);
    }
  }

  function banner(text, kind) {
    // 毎回作り直すことで表示アニメーションを付け直す
    el.overlay.innerHTML = '';
    var span = document.createElement('span');
    if (kind) span.className = kind;
    span.textContent = text;
    el.overlay.appendChild(span);
    el.overlay.hidden = false;
  }

  function buildHud() {
    renderHudSide(el.hudPlayer, state.playerChar, 'あなた');
    renderHudSide(el.hudOpponent, state.opponentChar, 'あいて');
    onEnergy(0, false);
  }

  function renderHudSide(host, character, whoLabel) {
    host.innerHTML = '';
    host.style.setProperty('--tint', character.color);
    host.appendChild(Sprites.createThumb(character, 'face'));
    var meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = '<div class="who"></div><div class="nm"></div>';
    meta.querySelector('.who').textContent = whoLabel;
    meta.querySelector('.nm').textContent = displayName(character);
    if (character.bossLabel) {
      var tag = document.createElement('span');
      tag.className = 'boss-tag';
      tag.textContent = character.bossLabel;
      meta.querySelector('.who').appendChild(tag);
    }
    host.appendChild(meta);
  }

  /* ---------------- 振動ゲージ ---------------- */

  function onEnergy(ratio, hot) {
    el.gaugeFill.style.width = Math.round(ratio * 100) + '%';
    el.gauge.classList.toggle('hot', hot);
    el.gaugeLabel.classList.toggle('hot', hot);
    el.gaugeLabel.textContent = hot ? 'あばれすぎ！' : 'しんどう';
  }

  /* ---------------- 4. 結果 ---------------- */

  function onFinish(result) {
    clearTimers();   // 開始演出の後始末が残っていても勝利表示を消させない
    // 1. 勝負あり！ → 2. 決まり手 → 3. 結果画面 の順に、少し間を置いて見せる
    banner(result.draw ? '引き分け！' : '勝負あり！', 'win');
    var k = result.kimarite;
    later(function () {
      if (!k) { el.overlay.hidden = true; showResult(result); return; }
      if (k.special) game.pressure();          // 「圧」は静かに特別扱い
      banner('決まり手：' + k.name, k.special ? 'kimarite atsu' : 'kimarite');
      later(function () {
        el.overlay.hidden = true;
        showResult(result);
      }, k.special ? FLOW.kimariteSpecial : FLOW.kimarite);
    }, FLOW.winBanner);
  }

  function showResult(result) {
    if (!result.draw) {
      var playerWon = result.winner.role === 'player';
      Progress.recordResult(state.playerChar, state.opponentChar, playerWon);
    }
    if (result.draw) {
      el.resultReason.textContent = 'どちらも土俵にのこれず';
      el.resultTitle.textContent = '引き分け';
      el.resultLine.textContent = '';
      el.resultLine.hidden = true;
    } else {
      var why = result.reason === 'out'
        ? displayName(result.loser.character) + ' は宇宙の彼方へ！'
        : displayName(result.loser.character) + ' がたおれた！';
      if (result.kimarite) why = '決まり手：' + result.kimarite.name + '　　' + why;
      el.resultReason.textContent = why;
      el.resultTitle.textContent = displayName(result.winner.character) + ' の勝ち！';

      // 自分のキャラのひとこと（勝ったか負けたかで変わる）。
      // 決まり手ごとの専用セリフがあればそちらを優先する。
      var mine = result.winner.role === 'player' ? result.winner : result.loser;
      var won = mine === result.winner;
      var line = getKimariteLine(result, mine.character, won) ||
                 getReaction(mine.character, won) ||
                 getReaction(result.winner.character, true);
      el.resultLine.textContent = line ? '「' + line + '」' : '';
      el.resultLine.hidden = !line;
    }
    el.modal.hidden = false;
  }

  /** もう一度：自分のキャラはそのまま、CPUだけ引き直す（再読み込みはしない） */
  function rematch() {
    clearTimers();
    el.modal.hidden = true;
    startEncounter();
  }

  function backToSelect() {
    showPlayerSelect();
  }

  return { init: init };
})();
