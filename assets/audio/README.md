# assets/audio/ — 音效

**內建音效不需要任何檔案。** 遊戲用 Web Audio 即時合成，這個資料夾預設是空的。
只有當你想用自己的錄音蓋掉某幾個音效時才需要動它。

The game synthesises all of its sound at runtime — **no files required**. This
folder only exists so you can override cues with your own recordings later.

> 這份清單跟上一層的 [`assets/manifest.js`](../manifest.js)（圖片素材）**完全獨立**：
> 不同的檔案、不同的 loader、不同的全域變數。改音效不會影響換皮，反之亦然。

## 為什麼是合成的

issue #2 要求三件事，它們正好是音檔做不好、合成做得好的：

| 要求 | 合成怎麼達成 |
|---|---|
| 落下時的急促感 | 快速下滑的滑音 + 低通濾過的撞擊噪音，起音 2 毫秒 |
| 消除行數越多越莊嚴 | 消 1 行是高音區兩個音、1 秒收掉；消 4 行是低一個八度、六個聲部、3.2 秒慢慢化開 |
| combo 越高音越高 | 整個和弦**真正移調**（每階 2 個半音，全音階），不是把音檔加速播放 |

全部參數都在 [`src/config.js`](../../src/config.js) 的 `AUDIO` 區塊，可以直接調。

## 風格

印象派在音樂上有明確對應（德布西、拉威爾）：五聲／全音階、不解決的和聲、
柔軟的起音、長長的殘響。所以你會聽到的是暈開的鐘聲質感，而不是電子遊戲的
嗶嗶聲。殘響是程式生成的脈衝響應，不是音檔。

## 用自己的音檔覆蓋

1. 把檔案放進 `assets/audio/samples/`
2. 在 [`manifest.js`](manifest.js) 的 `sets` 裡填路徑，把 `activeSet` 指過去

```js
window.TETRIX_AUDIO = {
  version: 1,
  activeSet: 'my-sounds',
  sets: {
    'my-sounds': {
      cues: {
        hardDrop: 'assets/audio/samples/slam.mp3',
        clear4:   'assets/audio/samples/tetris.mp3',
      },
    },
  },
};
```

### Cue 名稱

| Cue | 什麼時候響 |
|---|---|
| `lock` | 方塊輕輕落定 |
| `hardDrop` | 直落（Space）的急促撞擊 |
| `clear1` `clear2` `clear3` `clear4` | 消行，依一次消掉幾行分開 |
| `levelUp` | 升級 |
| `gameOver` | 遊戲結束 |

**每個都是選用的。** 沒填到的 cue 就繼續用合成音 —— 可以只換 `hardDrop` 一個。

### 音檔規格

| 項目 | 建議 |
|---|---|
| 格式 | MP3、WAV、OGG、M4A —— 瀏覽器播得動的都行 |
| 長度 | 短音效 0.2–1 秒；消 4 行那種可以到 3 秒 |
| 音量 | 事先正規化到接近但不破的程度，播放音量由 `masterVolume` 控制 |

## 覆蓋音檔的一個限制

combo 升調在合成音上是真正的移調；但**音檔只能靠 `playbackRate` 變速**，所以
combo 越高時你的音檔會同時變快變短。這是瀏覽器不做音高位移的先天限制。
在意的話，就讓 combo 相關的消行音效維持合成，只覆蓋 `lock` / `hardDrop` 這些
不隨 combo 變化的。

## 規則

- **檔案壞掉或路徑打錯**：那個 cue 自動退回合成音，遊戲照常，主控台會有一行
  `[tetrix/audio]` 警告指出是哪個檔
- **manifest 寫錯**（版本號不對、`activeSet` 指到不存在的 set）：主控台出現
  `[tetrix/audio]` 錯誤並指名欄位，全部退回合成音
- 路徑相對於 HTML 檔（repo 根目錄），所以以 `assets/` 開頭

## 靜音與瀏覽器限制

按 **M** 靜音，設定會記在 `localStorage`。

瀏覽器規定聲音必須由使用者操作觸發，所以音訊在你按下 **Game Start** 或任何按鍵
之前不會啟動 —— 這是規範行為，不是壞掉。

編輯 `manifest.js` 後如果沒反應，強制重新整理：瀏覽器在 `file://` 下會用力快取
這個檔案。
