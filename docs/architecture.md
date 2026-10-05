# 架構與擴充指南

Ippo 是純前端的靜態網站：沒有後端，學習資料存在瀏覽器的 localStorage。這份文件說明程式怎麼分層，以及新增各種東西時要改哪裡。

## 分層

```
src/
  content/   課程內容與內容檢查（純資料，不碰 DOM）
  lib/       與畫面無關的基礎：日文標記、羅馬拼音、語音、儲存
  quiz/      出題與測驗流程（純邏輯，可單元測試）
  ui/        畫面；每個頁面一個模組，共用元件在 dom.ts、japanese.ts、layout.ts
  state.ts   設定與課程進度（全域狀態）
  main.ts    頁面表與路由
```

依賴方向只往下：`ui → quiz → content → lib`。`content`、`lib`、`quiz` 都不 import `ui`，所以能在 Node 裡直接測試。

## 擴充點

### 新增一課
1. 新增 `src/content/lessons/NN-id.ts`，`export default { … } satisfies Lesson`。格式見 `src/content/types.ts`，範例見 `05-self-intro.ts`。
2. 在 `src/content/course.ts` 的單元裡登記。
3. `npm test` 會用 `src/content/validate.ts` 檢查整個課程（讀音、助詞、選項、句子重組…）。

課程 id 一旦上線就不要改：學習紀錄以 id 儲存。

### 新增一種題型
1. `src/quiz/questions.ts`：在 `Question` 聯集加上新型別，並在出題函式中產生它。
2. `src/ui/drill/`：新增一個渲染模組（參考 `mc.ts`、`order.ts`），簽名是 `(question, surface, answered) => void`。
3. `src/ui/drill/index.ts` 的 `renderQuestion` 加一個 case。TypeScript 的窮舉檢查會指出其他需要處理的地方。

渲染模組只負責畫題目與判斷對錯；「答錯移到最後」、進度條、回饋訊息都由 `runDrill` 統一處理。

### 新增一種上課步驟
`src/ui/lesson/steps.ts` 的 `lessonSteps()` 決定一課的學習步驟順序。新步驟是一個回傳 `StepView` 的函式（`el` 是畫面，`onShow` 會在使用者點進來時執行，可以在這裡播放聲音）。

### 新增頁面或分頁
- 頁面：在 `src/main.ts` 的 `PAGES` 加一筆。網址是 `#/<名稱>/<參數…>`；有 `tab` 的頁面會套用底部分頁列。
- 分頁：在 `src/ui/layout.ts` 的 `TABS` 加一筆，並擴充 `Tab` 型別。

### 新增要保存的資料
用 `src/lib/store.ts` 的 `defineStore(name, version, parse)`：

- 存在 `ippo.<name>`，內容包成 `{ v, data }`。
- `parse(data, savedVersion)` 必須對任何輸入都回傳合法的值（資料可能被手動改過，或來自舊版本）。
- 要改資料格式時：把 `version` 加一，並在 `parse` 裡依 `savedVersion` 轉換舊格式。在加入版本號之前存的資料，`savedVersion` 是 0。

### 新增設定
在 `src/state.ts` 的 `Settings`、`DEFAULT_SETTINGS`、`parseSettings` 加欄位；畫面在 `src/ui/settings.ts`。需要套用到整個頁面的設定（例如 CSS 開關）寫在 `applySettings()`。

### 主題與顏色
顏色都是 CSS 變數，定義在 `src/style.css` 的 `:root`，Tailwind 透過 `tailwind.config.js` 使用（`bg-paper`、`text-ink`、`bg-card`…）。新主題只要覆寫這些變數；元件裡不要寫死顏色（例如 `bg-white`），改用語意化的 token。

### 語音
所有發音都經過 `src/lib/speech.ts` 的 `speak()`，畫面元件透過 `src/ui/japanese.ts` 的 `play()`／`playSequence()` 使用。之後若要改用預錄音檔，只需要在 `speak()` 這一處切換來源。

## 卡片與每日複習

```
src/learn/
  cards.ts      卡片目錄：每個單字、例句、會話台詞都是一張卡片
  scheduler.ts  FSRS 排程（ts-fsrs）＋題型等級
  memory.ts     每張卡的記憶狀態、作答紀錄、學習日（ippo.memory）與成效指標
  review.ts     依卡片熟悉度出複習題
```

- **卡片 id 就是日文標記本身**：同一句話在課程中出現幾次都是同一張卡。修改句子文字等於換一張新卡；舊的紀錄還留在儲存裡，但到期數、複習與統計都只看 `CARDS` 裡還存在的卡片，所以不會卡住。
- **哪些內容會進複習**：`lessonCards()` 決定。發音課的例句只是示範聲音，用 `Lesson.review: "words"` 讓那一課只有單字進複習。
- **題型隨熟悉度變難**：`level` 0 認得（看日文選意思）→ 1 聽懂（聽音選意思）→ 2 以上說出來（看中文說日文、自評）。答對且距離上次至少 12 小時才升一級（剛做完又重考不算），差一點不變，不會降兩級。課程結束時沒被考到的內容以 level 0 加入。只需要聽懂的卡片（別人的台詞、單一假名）停在「聽懂」。
- **新的卡片種類**：在 `Card.kind` 加一種，`reviewQuestion()` 的 switch 會要求你寫它的出題方式；`source` 標明卡片來自哪一課或哪個來源。
- **作答怎麼進排程**：任何題目只要帶 `card`，`runDrill` 的 `onFirstAnswer` 會把第一次作答的結果交給 `memory.answer()`。新題型想計入複習，只要在題目上填 `card`。
- **成效指標** `computeStats()`：連續學習天數、預估記得的單字（最近一次答錯的不算）、說得出口的句子與說法（最近一次「說說看」）、隔 3 天以上的複習答對率（作答紀錄只保留 30 天）。

## 測試

- `npm test`：單元測試與整個課程的內容檢查。
- 測試只驗證使用者看得到的行為與資料規則；不測實作細節。
- pull request 會自動跑測試與建置（`.github/workflows/ci.yml`）；合併到 `main` 後自動部署到 GitHub Pages。
