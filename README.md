# 雷神トントン相撲 — 宇宙場所

宇宙に浮かぶ土俵をトントンして戦う、ブラウザのトントン相撲。

**遊ぶ:** https://non-light.github.io/raizin-tonton-zumou/

## 遊びかた
土俵をクリック／タップするだけ。叩いた位置から振動が伝わって力士が動きます。
連打すると自分の力士まで不安定になるので、狙いとタイミングが勝負です。

## 中身

| ファイル | 役割 |
|---|---|
| `js/characters.js` | 全キャラクターのデータ（画像パス・性能・出現率）。**調整はここだけで完結** |
| `js/behaviors.js` | キャラごとの特殊挙動 |
| `js/config.js` | 物理と演出のタイミング |
| `js/physics.js` | 力士の物理 |
| `js/renderer.js` | 土俵と力士の描画 |
| `js/space.js` | 宇宙背景 |
| `js/progress.js` | 進行状況とCPU抽選 |
| `js/ui.js` | 画面の流れ |

## キャラクターの絵を差し替える
`assets/characters/` に画像を置き、`js/characters.js` の `frontImage` / `backImage` を
書き換えるだけです。背景を透明にしたPNGで、足元が画像の下端に来るように切ってください。
背面画像がない場合は `backImage: null` にすると正面画像が使われます。

## オフライン用の1枚版
`python3 tools/bundle.py` で `dist/index.html` を生成します。
画像もコードも全部埋め込んだ1ファイルなので、そのまま配れます。
