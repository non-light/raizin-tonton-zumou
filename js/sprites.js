/* =========================================================================
 * sprites.js — キャラクター画像の読み込み
 *
 * 画像パスはキャラクターデータ側にしか書かれていない。
 * 読み込めなかったキャラクターは color を使った共通の仮図形で描画する
 * （キャラクターごとの描画処理は持たない）。
 * ========================================================================= */

var Sprites = (function () {
  var cache = {};

  /** パス単位でキャッシュする（正面・背面・サムネイルを同じ仕組みで扱う） */
  function byPath(path) {
    if (!path) return { image: null, ready: false, failed: true };
    var entry = cache[path];
    if (entry) return entry;

    entry = { image: null, ready: false, failed: false };
    var img = new Image();
    img.onload = function () { entry.ready = true; };
    img.onerror = function () { entry.failed = true; };
    img.src = path;
    entry.image = img;
    cache[path] = entry;
    return entry;
  }

  /** 向きに応じた画像。背面画像が無い／まだ読めていなければ正面を使う。 */
  function get(character, back) {
    if (back && character.backImage) {
      var b = byPath(character.backImage);
      if (b.ready) return b;
    }
    return byPath(character.frontImage);
  }

  function preloadAll() {
    for (var i = 0; i < CHARACTERS.length; i++) {
      var c = CHARACTERS[i];
      byPath(c.frontImage);
      if (c.backImage) byPath(c.backImage);
      if (c.thumbnailImage) byPath(c.thumbnailImage);
      if (c.battleBackground) byPath(c.battleBackground);
      var set = c.motionSet && MOTION_SETS[c.motionSet];
      if (set) {
        var k;
        for (k in set.sprites) if (set.sprites.hasOwnProperty(k)) byPath(set.dir + set.sprites[k]);
        for (k in set.effects) if (set.effects.hasOwnProperty(k)) byPath(set.dir + set.effects[k]);
      }
    }
  }

  /** カードやHUD用のサムネイル要素。画像が無ければ色つきの図形にする。 */
  function createThumb(character, className) {
    var box = document.createElement('div');
    box.className = className;
    box.style.setProperty('--tint', character.color);

    var path = characterThumbnail(character);
    if (!path) {
      box.appendChild(makeFallback());
      return box;
    }
    var img = document.createElement('img');
    img.alt = displayName(character);
    img.src = path;
    img.onerror = function () {
      // 別の場所へ移し替えられたあとでも差し替えられるようにする
      var parent = img.parentNode || box;
      parent.replaceChild(makeFallback(), img);
    };
    box.appendChild(img);
    return box;
  }

  function makeFallback() {
    var el = document.createElement('div');
    el.className = 'fallback';
    return el;
  }

  return { get: get, byPath: byPath, preloadAll: preloadAll, createThumb: createThumb };
})();
