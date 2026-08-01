// Tetrix audio manifest — 音效清單
//
// The game synthesises every sound at runtime, so this file is OPTIONAL: leave
// activeSet as null and you get the full impressionist soundtrack with no files
// at all. Point it at a set below to replace cues with your own recordings.
// 遊戲的聲音是程式即時合成的，這個檔案是選用的。activeSet 保持 null 就會用內建
// 合成音；想換成自己的音檔再指過去。
//
// This is a SEPARATE manifest from assets/manifest.js (which handles artwork).
// They share no state — breaking one never affects the other.
// 這份清單跟 assets/manifest.js（圖片）完全獨立，互不影響。

window.TETRIX_AUDIO = {
  // Manifest format version. Do not change — the loader refuses versions it
  // does not understand rather than guessing.
  version: 1,

  // null = synthesise everything (default). Set to a key of `sets` to override.
  activeSet: null,

  sets: {
    // Cue names — every one is optional, anything you leave out stays
    // synthesised, so you can replace just the sounds you care about:
    //
    //   lock       piece lands softly
    //   hardDrop   the urgent slam
    //   clear1..4  line clear, by how many rows went at once
    //   levelUp    level rise
    //   gameOver   the end
    //
    // Paths are relative to the HTML file, so they start with "assets/".
    example: {
      cues: {
        // hardDrop: 'assets/audio/samples/hard-drop.mp3',
        // clear4:   'assets/audio/samples/tetris.mp3',
      },
    },
  },
};
