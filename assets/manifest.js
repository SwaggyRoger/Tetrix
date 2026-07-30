// Tetrix asset manifest — 素材清單
//
// EDIT THIS FILE to add your own artwork. No build step: save, reload the page.
// 直接改這個檔就能換素材，存檔後重整瀏覽器即可，不需要重跑 node build.mjs。
//
// Why .js and not .json: the double-clickable index.html runs from file://,
// where fetch() is blocked. A <script> tag is not. See assets/README.md.

window.TETRIX_ASSETS = {
  // Manifest format version. Do not change — the loader refuses versions it
  // does not understand rather than guessing.
  version: 1,

  // Which skin to use. null = the built-in impressionist painting (default).
  // Set to a key of `skins` below to use images instead.
  // 設成 null 用內建印象派筆觸；設成下面 skins 的名字就改用圖片。
  activeSkin: null,

  skins: {
    // A skin maps each tetromino type to an image. Paths are relative to the
    // HTML file (index.html / dev.html), so they start with "assets/".
    // Any type you leave out keeps its painted sprite — partial skins are fine.
    example: {
      cells: {
        I: 'assets/skins/example/I.png',
        J: 'assets/skins/example/J.png',
        L: 'assets/skins/example/L.png',
        O: 'assets/skins/example/O.png',
        S: 'assets/skins/example/S.png',
        T: 'assets/skins/example/T.png',
        Z: 'assets/skins/example/Z.png',
      },
    },
  },
};
