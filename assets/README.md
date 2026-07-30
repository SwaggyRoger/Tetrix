# assets/ — 自訂素材

Drop your own artwork here and the game picks it up. **No build step, no code
changes**: edit [`manifest.js`](manifest.js), save, reload the page.

把自己的圖片放進來就能換掉方塊外觀。改 `manifest.js`、存檔、重整瀏覽器即可，
**不用重跑 `node build.mjs`**（那個指令只在你改 `src/` 程式碼時才需要）。

## 快速開始 Quick start

1. 做一組圖，一個方塊一張，命名為 `I / J / L / O / S / T / Z`
2. 放進 `assets/skins/<你的skin名字>/`
3. 在 `manifest.js` 的 `skins` 加一段，然後把 `activeSkin` 指過去：

```js
window.TETRIX_ASSETS = {
  version: 1,
  activeSkin: 'my-skin',        // ← 改這裡就換皮
  skins: {
    'my-skin': {
      cells: {
        I: 'assets/skins/my-skin/I.png',
        J: 'assets/skins/my-skin/J.png',
        // ... L O S T Z
      },
    },
  },
};
```

想看效果，把 `activeSkin` 設成 `'example'`（本資料夾附的示範圖）就能立刻比較。
回到內建的印象派筆觸，把 `activeSkin` 設回 `null`。

## 圖片規格 Image specs

| 項目 | 建議 |
|---|---|
| 格式 | PNG（支援透明）、JPG、WebP、GIF、SVG — 瀏覽器讀得懂的都行 |
| 尺寸 | **正方形**，建議 64×64 到 128×128 |
| 縮放 | 會自動縮到目前格子大小（隨視窗高度變動，16–34 px），所以別用太小的圖 |
| 透明 | 支援。透明處會看到底下的畫布水洗色 |

Ghost（落點預覽）不用另外準備 — 系統會拿同一張圖降透明度加虛線框自動生成。

## 規則 Rules

- **少放沒關係**：`cells` 裡沒寫到的方塊，會維持內建的手繪筆觸。可以只換 I 和 O。
- **檔案壞掉或路徑打錯**：那個方塊自動退回手繪，遊戲照跑不會當掉，主控台 (F12 Console)
  會有一行 `[tetrix/assets]` 警告告訴你是哪個檔。
- **manifest 寫錯**（版本號不對、`activeSkin` 指到不存在的 skin、`cells` 不是物件）：
  主控台會出現 `[tetrix/assets]` 錯誤，明確指出是哪個欄位，並整組退回手繪。
- 路徑是**相對於 HTML 檔**（repo 根目錄），所以一律以 `assets/` 開頭。

## 為什麼 manifest 是 .js 不是 .json

`index.html` 是可以直接雙擊開啟的單一檔案，跑在 `file://` 協定下。瀏覽器在
`file://` 會擋掉 `fetch()`（origin 為 null），所以讀不到 `.json`；但 `<script>`、
`<img>`、`<audio>` 讀相對路徑是通的。因此清單做成 `.js` 直接掛在 `window` 上。

## 散佈 Distribution

要把遊戲給別人玩，present 整個資料夾：`index.html` **加上** `assets/`。
只複製 `index.html` 一個檔仍然能玩，只是會回到內建的手繪外觀。

## 目前支援範圍

方塊圖片。音效與背景圖還沒接 —— 音效需要另外的 `src/audio/` 模組
（見專案根目錄 README 的 roadmap），接上之後這份 manifest 會再加一個 `audio` 區塊。
