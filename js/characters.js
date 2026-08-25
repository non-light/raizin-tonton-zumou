/* =========================================================================
 * characters.js — キャラクター定義（一元管理）
 *
 * すべてのキャラクターは同じデータ構造で持つ。ここに1件足すだけで
 * 選択画面・対戦相手判定・描画・物理のすべてに反映される。
 * キャラクター個別の描画処理や画像パスは、どこにもハードコードしない。
 *
 * ---- 画像 ----------------------------------------------------------------
 * frontImage     正面向きの画像。差し替えるときはこの文字列を変えるだけ。
 * backImage      背面向きの画像。相手が奥にいるとき（背を向けているとき）に使う。
 *                無い場合は null にしておけば自動的に frontImage を使う。
 * thumbnailImage カードやHUDに出す画像。null なら frontImage を使う。
 * どれも読み込めなかった場合は color を使った共通の仮図形で描画される。
 *
 * ---- 分類 ----------------------------------------------------------------
 * category  'normal' | 'boss' | 'hidden' | 'special'
 * playable  true なら「だれで戦う？」の一覧に出る
 * hidden    true なら名前も画像も伏せて「？？？」として扱う
 * boss      true ならボス扱い（選択画面には並ばず、出現条件から登場する）
 *
 * ---- 性能 ----------------------------------------------------------------
 * weight              重量。大きいほど揺れで動きにくい
 * friction            摩擦。大きいほど土俵の上で早く止まる
 * bounce              跳ねやすさ。大きいほどぴょこぴょこ跳ぶ
 * stability           安定性。大きいほど姿勢が戻りやすく転びにくい
 * vibrationResponse   振動への反応。大きいほど土俵の揺れをよく拾う
 * movementSpeed       移動性。大きいほど一度の振動で速く動く
 * knockbackResistance 押されにくさ。大きいほど吹っ飛びにくい
 * specialBehavior     特殊挙動。behaviors.js のキー名。null なら癖なし
 * motionSet           専用モーション（motions.js のキー名）。省略時は1枚絵
 * kimariteLines       特定の決まり手のときだけ出す一言。省略可
 * bossLabel           対戦中にHUDへ出す小さな札（'裏ボス' など）。省略可
 * battleBackground    その相手のときだけ使う背景画像。省略時は通常の宇宙場所
 * entrance            専用の登場演出。{ darken, omen, arrival } 省略可
 *
 * 横に押される強さのめやす =
 *   vibrationResponse × movementSpeed ÷ (weight × knockbackResistance)
 * 雷神を 1.00 とする。
 * ========================================================================= */

var CHARACTERS = [

  /* ============ 基本の4体（ここだけで「重さ・反応・安定性・速さ」の違いが分かる） ============ */
  {
    id: 'raijin',
    name: '雷神',
    description: '癖が少なくて扱いやすい万能型。',
    type: 'バランス型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/raijin/front.png',
    backImage:  'assets/characters/raijin/back.png',
    thumbnailImage: null,
    color: '#6d5bd0', size: { w: 106, h: 108 }, radius: 42,
    pushPower: 1.10, pushResist: 1.00, bounceBack: 0.55, aggression: 0.55,
    weight: 1.00, friction: 1.00, bounce: 1.00, stability: 1.05,
    vibrationResponse: 1.00, movementSpeed: 1.00, knockbackResistance: 1.00,
    specialBehavior: 'balanced',
    /* 雷神だけ専用モーション（motions.js）。他キャラは1枚絵のまま。 */
    motionSet: 'raijin',
    cpuEnabled: true, cpuWeight: 10,
    outCry: 'うおおお〜！',
    reactions: {
      win:  ['雷神、つよい！', '宇宙でも勝った！', 'まだまだいける！'],
      lose: ['とんでった……', '宇宙、こわい……', 'もう一回！']
    }
  },
  {
    id: 'kuroneko',
    name: '黒猫',
    description: '軽くてすばしっこい。でも吹っ飛びやすい！',
    type: '軽量・俊敏型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/kuroneko_front.png',
    backImage:  'assets/characters/kuroneko_back.png',
    thumbnailImage: null,
    color: '#31313b', size: { w: 70, h: 104 }, radius: 28,
    pushPower: 0.55, pushResist: 0.55, bounceBack: 1.55, aggression: 0.95,
    weight: 0.75, friction: 0.78, bounce: 1.75, stability: 0.85,
    vibrationResponse: 1.30, movementSpeed: 1.15, knockbackResistance: 1.00,
    specialBehavior: 'featherweight',
    cpuEnabled: true, cpuWeight: 10,
    outCry: 'にゃーーー！',
    reactions: { win: ['にゃっ、かるいかるい', 'すばやさ、かち'],
                 lose: ['にゃーーー……', 'つぎはとばされない'] }
  },
  {
    id: 'robot',
    name: 'ロボット',
    description: '重くて倒れにくい。押し合いに強い！',
    type: '重量・安定型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/robot_front.png',
    backImage:  'assets/characters/robot_back.png',
    thumbnailImage: null,
    color: '#8a94a3', size: { w: 74, h: 112 }, radius: 30,
    pushPower: 1.70, pushResist: 1.50, bounceBack: 0.30, aggression: 0.40,
    weight: 1.40, friction: 0.85, bounce: 0.35, stability: 1.45,
    vibrationResponse: 0.68, movementSpeed: 0.92, knockbackResistance: 1.18,
    specialBehavior: 'heavyweight',
    cpuEnabled: true, cpuWeight: 10,
    outCry: 'ピーーー……',
    reactions: { win: ['ショウリ ヲ カクニン', 'オモタイ ハ ツヨイ'],
                 lose: ['ピーーー…… サヨナラ', 'ジュウリョク ドコ'] }
  },
  {
    id: 'tanuki',
    name: 'たぬき',
    description: 'バランス型。初心者にもやさしい。',
    type: 'バランス型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/tanuki_front.png',
    backImage:  'assets/characters/tanuki_back.png',
    thumbnailImage: null,
    color: '#8a6242', size: { w: 67, h: 106 }, radius: 27,
    pushPower: 1.05, pushResist: 1.20, bounceBack: 0.55, aggression: 0.60,
    weight: 1.15, friction: 1.15, bounce: 0.85, stability: 1.20,
    vibrationResponse: 0.92, movementSpeed: 0.92, knockbackResistance: 1.05,
    specialBehavior: 'roundish',
    cpuEnabled: true, cpuWeight: 10,
    outCry: 'ぽんっ！',
    reactions: { win: ['ぽんぽこ、かち！'], lose: ['ぽんっ……'] }
  },

  /* ============ 追加の通常キャラクター ============ */
  {
    id: 'suzume',
    name: 'スズメ',
    description: 'めちゃ軽い。動きが読めない！',
    type: '予測不能・ジャンプ型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/suzume_front.png',
    backImage:  'assets/characters/suzume_back.png', thumbnailImage: null,
    color: '#8a6a45', size: { w: 63, h: 94 }, radius: 25,
    pushPower: 0.45, pushResist: 0.50, bounceBack: 1.45, aggression: 1.00,
    weight: 0.62, friction: 0.72, bounce: 1.60, stability: 0.95,
    vibrationResponse: 1.25, movementSpeed: 1.10, knockbackResistance: 1.00,
    specialBehavior: 'skittish',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'ちゅん〜！',
    reactions: { win: ['ちゅん！'], lose: ['ちゅん……'] }
  },
  {
    id: 'kaeru',
    name: 'カエル',
    description: '普段は安定。でも突然跳ねる！',
    type: '事故要員・ジャンプ型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/kaeru_front.png',
    backImage:  'assets/characters/kaeru_back.png', thumbnailImage: null,
    color: '#6fbe5a', size: { w: 61, h: 100 }, radius: 24,
    pushPower: 0.85, pushResist: 0.85, bounceBack: 1.10, aggression: 0.70,
    weight: 0.95, friction: 1.00, bounce: 1.50, stability: 1.05,
    vibrationResponse: 0.95, movementSpeed: 1.00, knockbackResistance: 1.00,
    specialBehavior: 'suddenJump',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'げこーー！',
    reactions: { win: ['げこっ、かち'], lose: ['げこ…… とんだ'] }
  },
  {
    id: 'kani',
    name: 'カニ',
    description: '横移動がめちゃくちゃ速い！',
    type: '横移動特化型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/kani_front.png',
    backImage:  'assets/characters/kani_back.png', thumbnailImage: null,
    color: '#d94a3d', size: { w: 85, h: 94 }, radius: 34,
    pushPower: 1.20, pushResist: 1.10, bounceBack: 0.60, aggression: 0.75,
    weight: 1.05, friction: 1.05, bounce: 0.65, stability: 1.20,
    vibrationResponse: 1.05, movementSpeed: 1.05, knockbackResistance: 1.00,
    specialBehavior: 'sideways',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'シャキーン！',
    reactions: { win: ['よこ、さいきょう'], lose: ['よこに にげられず'] }
  },
  {
    id: 'kame',
    name: 'カメ',
    description: '超低重心。とにかく遅いが、めちゃ強い！',
    type: '超安定・低重心型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/kame_front.png',
    backImage:  'assets/characters/kame_back.png', thumbnailImage: null,
    color: '#4a8f3f', size: { w: 70, h: 100 }, radius: 28,
    pushPower: 1.00, pushResist: 1.60, bounceBack: 0.30, aggression: 0.18,
    weight: 1.55, friction: 1.25, bounce: 0.25, stability: 1.65,
    vibrationResponse: 0.70, movementSpeed: 0.85, knockbackResistance: 1.05,
    specialBehavior: 'lowCenter',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'こうらーー！',
    reactions: { win: ['ゆっくり かった'], lose: ['ひっくりかえった'] }
  },
  {
    id: 'usagi',
    name: 'うさぎ',
    description: 'ジャンプ特化型。突然の大ジャンプに注意！',
    type: 'ジャンプ特化型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/usagi_front.png',
    backImage:  'assets/characters/usagi_back.png', thumbnailImage: null,
    color: '#f0ece4', size: { w: 63, h: 110 }, radius: 25,
    pushPower: 0.70, pushResist: 0.70, bounceBack: 1.20, aggression: 0.80,
    weight: 0.75, friction: 0.95, bounce: 1.60, stability: 0.90,
    vibrationResponse: 1.05, movementSpeed: 0.95, knockbackResistance: 1.00,
    specialBehavior: 'bigJump',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'ぴょーん！',
    reactions: { win: ['とんで かった！'], lose: ['とびすぎた……'] }
  },
  {
    id: 'tako',
    name: 'タコ',
    description: '足が多くてバランス抜群。倒れにくい！',
    type: '柔軟・粘り型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/tako_front.png',
    backImage:  'assets/characters/tako_back.png', thumbnailImage: null,
    color: '#d0483c', size: { w: 90, h: 110 }, radius: 36,
    pushPower: 0.95, pushResist: 1.35, bounceBack: 0.45, aggression: 0.60,
    weight: 0.95, friction: 1.30, bounce: 0.60, stability: 0.70,
    vibrationResponse: 1.05, movementSpeed: 0.90, knockbackResistance: 1.05,
    specialBehavior: 'squishy',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'ぬるん……',
    reactions: { win: ['ぐにゃり、かち'], lose: ['ぬるっと でた'] }
  },
  {
    id: 'daruma',
    name: 'だるま',
    description: '超低重心でゴロゴロ転がる。',
    type: '転がり型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/daruma_front.png',
    backImage:  'assets/characters/daruma_back.png', thumbnailImage: null,
    color: '#cf3b2f', size: { w: 76, h: 104 }, radius: 30,
    pushPower: 1.15, pushResist: 0.90, bounceBack: 0.95, aggression: 0.85,
    weight: 1.25, friction: 0.55, bounce: 0.80, stability: 1.35,
    vibrationResponse: 0.95, movementSpeed: 1.20, knockbackResistance: 0.95,
    specialBehavior: 'roll',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'ころころ〜',
    reactions: { win: ['ころがって かち'], lose: ['ころがって いった'] }
  },
  {
    id: 'harinezumi',
    name: 'ハリネズミ',
    description: '押されると丸くなる。丸まって転がるぞ！',
    type: '変形・転がり型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/harinezumi_front.png',
    backImage:  'assets/characters/harinezumi_back.png', thumbnailImage: null,
    color: '#c9a06a', size: { w: 72, h: 100 }, radius: 29,
    pushPower: 1.00, pushResist: 1.00, bounceBack: 0.85, aggression: 0.65,
    weight: 1.05, friction: 1.00, bounce: 0.90, stability: 1.10,
    vibrationResponse: 1.00, movementSpeed: 1.00, knockbackResistance: 1.00,
    specialBehavior: 'curlUp',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'まるまる〜！',
    reactions: { win: ['まるまって かち'], lose: ['ころがって でた'] }
  },
  {
    id: 'obake',
    name: 'おばけ',
    description: '軽すぎてふわふわ浮く。流されやすいぞ！',
    type: '超軽量・浮遊型',
    category: 'normal', playable: true, hidden: false, boss: false,
    frontImage: 'assets/characters/obake_front.png',
    backImage:  'assets/characters/obake_back.png', thumbnailImage: null,
    color: '#e8e6e0', size: { w: 75, h: 104 }, radius: 30,
    pushPower: 0.45, pushResist: 0.50, bounceBack: 0.90, aggression: 0.85,
    weight: 0.70, friction: 0.80, bounce: 1.10, stability: 0.95,
    vibrationResponse: 1.20, movementSpeed: 1.05, knockbackResistance: 1.00,
    specialBehavior: 'floaty',
    cpuEnabled: true, cpuWeight: 8,
    outCry: 'ひゅ〜〜',
    reactions: { win: ['ふわ〜り かち'], lose: ['ながされた〜'] }
  },

  /* ============ ボス・隠しキャラクター ============
   * playable: false なので「だれで戦う？」には並ばない。
   * 出現条件は encounters.js 側にまとめてある。 */
  {
    id: 'maneki_gold',
    name: '金の招き猫',
    description: 'めちゃくちゃ重い！めったに出会えないぞ。',
    type: 'レアボス',
    category: 'boss', playable: false, hidden: false, boss: true,
    frontImage: 'assets/characters/maneki_gold_front.png',
    backImage:  'assets/characters/maneki_gold_back.png', thumbnailImage: null,
    color: '#e8b93a', size: { w: 63, h: 116 }, radius: 25,
    pushPower: 2.00, pushResist: 2.20, bounceBack: 0.30, aggression: 0.22,
    weight: 1.85, friction: 1.30, bounce: 0.35, stability: 1.70,
    vibrationResponse: 0.62, movementSpeed: 0.85, knockbackResistance: 1.25,
    specialBehavior: 'luckyPaw',
    cpuEnabled: true, cpuWeight: 1.2,
    outCry: 'まねきそこねた……',
    reactions: { win: ['ふくを まねいたにゃ'], lose: ['まねきそこねた……'] }
  },
  {
    id: 'raijin_awakened',
    name: '雷神・覚醒モード',
    description: '雷神の真の力！たまに雷をまとって反撃するぞ！',
    type: '隠しボス',
    category: 'boss', playable: false, hidden: false, boss: true,
    frontImage: 'assets/characters/raijin_awakened_front.png',
    backImage:  'assets/characters/raijin_awakened_back.png', thumbnailImage: null,
    color: '#e8b93a', size: { w: 102, h: 118 }, radius: 41,
    pushPower: 1.80, pushResist: 1.80, bounceBack: 0.55, aggression: 0.55,
    weight: 1.65, friction: 1.10, bounce: 0.80, stability: 1.60,
    vibrationResponse: 0.72, movementSpeed: 1.00, knockbackResistance: 1.20,
    specialBehavior: 'thunderBurst',
    cpuEnabled: true, cpuWeight: 0.6,
    unlockCondition: function (p) { return p.wins >= 2; },
    outCry: 'ぐ……おのれ……',
    reactions: { win: ['これが 真の雷神だ'], lose: ['ぐ……おぼえていろ'] }
  },
  {
    id: 'moriken',
    name: 'もりけんさん',
    description: '動かない…だが、突然本気を出す…!?',
    type: 'スーパーレアボス',
    category: 'boss', playable: false, hidden: false, boss: true,
    /* 画像は後日差し替え予定。ここのパスを変えるだけで差し替わる。 */
    frontImage: 'assets/characters/tonton-moriken-omote-cutout.png',
    backImage:  'assets/characters/tonton-moriken-ura-cutout.png', thumbnailImage: null,
    color: '#2b303a', size: { w: 73, h: 126 }, radius: 29,
    pushPower: 2.60, pushResist: 2.80, bounceBack: 0.20, aggression: 0.08,
    weight: 2.50, friction: 1.60, bounce: 0.25, stability: 1.95,
    vibrationResponse: 0.35, movementSpeed: 0.70, knockbackResistance: 1.60,
    specialBehavior: 'moriken',
    /* --- 裏ボス専用の見せかた（すべてここで差し替えられる） --- */
    bossLabel: '裏ボス',
    battleBackground: 'assets/backgrounds-moriken.png',
    entrance: {
      darken: true,                       // 先に画面を暗転させる
      omen: '……何か来る',
      arrival: 'もりけんさんが現れた！'
    },
    cpuEnabled: true, cpuWeight: 0.25,
    outCry: 'あ、いま本気出そうと……',
    reactions: { win: ['まだ本気じゃないよ'], lose: ['あ、いま本気出そうと……'] },
    /* 決まり手「圧」で勝ったときだけの一言（通常の勝利セリフとは別枠） */
    kimariteLines: {
      atsu: { win: ['まだまだだね', 'いい勝負だった', '……ん？', 'もう終わり？'],
              lose: ['なにもしてないのに……', '圧がすごい……', 'う、動かない……！'] }
    }
  },
  {
    id: 'secret',
    name: 'シークレット',
    description: 'まだ見ぬ強敵がいるらしい…。',
    type: '？？？',
    category: 'hidden', playable: false, hidden: true, boss: true,
    frontImage: 'assets/characters/secret_front.png',
    backImage:  'assets/characters/secret_back.png', thumbnailImage: null,
    color: '#14161f', size: { w: 78, h: 110 }, radius: 31,
    pushPower: 1.30, pushResist: 1.30, bounceBack: 0.70, aggression: 0.70,
    /* 性能は仮。中身が決まったらここを書き換えるだけでよい。 */
    weight: 1.40, friction: 1.00, bounce: 1.10, stability: 1.35,
    vibrationResponse: 1.05, movementSpeed: 1.10, knockbackResistance: 1.10,
    specialBehavior: 'secretPower',
    /* 条件を満たすまでCPUにも出てこない。unlockCondition が true を返すと抽選に入る。 */
    cpuEnabled: true, cpuWeight: 0.4,
    unlockCondition: function (p) { return Progress.bossesDefeated() >= 2; },
    outCry: '…………',
    reactions: { win: ['…………'], lose: ['…………'] }
  }

  /* ---- キャラクターを足すときは、この形式で1件並べるだけでよい ---- */
];

/* ========================= 参照用のヘルパー ========================= */

/** id からキャラクター定義を引く */
function getCharacter(id) {
  for (var i = 0; i < CHARACTERS.length; i++) {
    if (CHARACTERS[i].id === id) return CHARACTERS[i];
  }
  return null;
}

/** 「だれで戦う？」に並べるキャラクター */
function getPlayableCharacters() {
  return CHARACTERS.filter(function (c) { return c.playable; });
}

/** category で絞り込む（'normal' / 'boss' / 'hidden' / 'special'） */
function getCharactersByCategory(category) {
  return CHARACTERS.filter(function (c) { return c.category === category; });
}

/** 伏せキャラは正体が分かるまで「？？？」で表示する */
function displayName(character) {
  if (character.hidden && !Progress.isUnlocked(character.id)) return '？？？';
  return character.name;
}

function displayDescription(character) {
  if (character.hidden && !Progress.isUnlocked(character.id)) return 'キミの目で確かめてくれ！';
  return character.description;
}

/** 向きに応じた画像パス。背面画像が無ければ正面画像を使う。 */
function characterImage(character, back) {
  if (back && character.backImage) return character.backImage;
  return character.frontImage;
}

/** カードやHUDに出す画像パス */
function characterThumbnail(character) {
  return character.thumbnailImage || character.frontImage;
}

/** 勝敗が決まったときのひとこと。用意されていなければ空文字。 */
function getReaction(character, won) {
  var r = character && character.reactions;
  var list = r && (won ? r.win : r.lose);
  if (!list || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}
