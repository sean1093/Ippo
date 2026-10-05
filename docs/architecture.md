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
`src/ui/lesson/steps.ts` 的 `lessonSteps()` 決定一課的學習步驟順序。新步驟是一個回傳 `StepView` 的函式：

- `el` 是畫面。
- `onShow` 會在使用者點進來時執行，可以在這裡播放聲音。
- `onLeave` 會在離開這個步驟時執行（換下一步、回上一步、關掉或用瀏覽器返回），用來停掉聲音、放掉麥克風、`URL.revokeObjectURL()`。只要步驟握著資源就一定要實作它。

學習步驟由 `src/ui/lesson/player.ts` 放進一個 `touch-pan-y` 的容器裡，左右滑動就是上一步／繼續（`src/ui/swipe.ts` 的 `onSwipe`：位移 64px 以上、橫向是縱向的兩倍以上、800 毫秒以內，而且不是從按鈕、連結、輸入框、`[data-no-swipe]` 或螢幕邊緣 24px 內開始）。會自己橫向捲動或拖曳的區塊（句子重組的字卡、會話的模式切換）要加上 `data-no-swipe`。換頁的滑入動畫是 `.slide-forward`／`.slide-back`，`prefers-reduced-motion` 下和其他動畫一起關掉。

### 繼續上次的進度
`src/learn/resume.ts` 用 `ippo.resume` 記住**一課**的位置 `{ lesson, step, at }`：

- `saveResume()`：播放器每進一個學習步驟就存一次，進入測驗時存 `steps.length`；`clearResume()` 在完成那一課時清掉，設定頁的「清除學習紀錄」也會清。
- `resumePoint(lessonId, stepCount, now)` 回傳要接續的步驟或 null：超過 30 天就不再提（隔太久不如重上），步驟數會夾到那一課現在的步驟數（改版後內容會變），第 0 步等於從頭開始，不算進度。
- 課程簡介用它顯示「從第 k 步繼續」／「繼續測驗」加上「從頭開始」；首頁的主要按鈕變成「繼續第 N 課（第 k / m 步）」。已經完成的課回去翻時也會留下位置，那時只有課程簡介會提供，首頁的主要按鈕照常指向下一課。
- 因為位置留著了，離開學習步驟不再問；只有測驗會問「要離開測驗嗎？下次會從測驗開始。」

### 情境會話的四種模式
`src/ui/lesson/dialogue.ts` 只放最上面的模式切換；每一種模式是 `src/ui/lesson/dialogue/` 底下的一個模組，回傳 `DialogueMode`（`el` ＋ 選用的 `onLeave`）：

| 模式 | 模組 | 做什麼 |
|---|---|---|
| 閱讀 | `read.ts` | 整段對話、逐句發音、隱藏中文 |
| 先聽懂 | `hear.ts` | 先藏起文字，只用耳朵聽，再逐句打開 |
| 跟讀 | `shadow.ts` | 原音 → 錄自己 → 聽自己比對 |
| 角色扮演 | `roleplay.ts` | 對方的台詞自動播放，你的台詞用說的 |

對話泡泡與「播放全部」共用 `dialogue/shared.ts`；切換模式時會先呼叫前一個模式的 `onLeave`。新增一種模式＝多一個模組加 `MODES` 一筆。

### 新增頁面或分頁
- 頁面：在 `src/main.ts` 的 `PAGES` 加一筆。網址是 `#/<名稱>/<參數…>`；有 `tab` 的頁面會套用底部分頁列。
- 分頁：在 `src/ui/layout.ts` 的 `TABS` 加一筆，並擴充 `Tab` 型別。同一個分頁可以有好幾個頁面（「我的」底下有 `#/me`、`#/phrasebook`、`#/settings`），分頁列會一起亮起來。

### 新增要保存的資料
用 `src/lib/store.ts` 的 `defineStore(name, version, parse)`：

- 存在 `ippo.<name>`，內容包成 `{ v, data }`。
- `parse(data, savedVersion)` 必須對任何輸入都回傳合法的值（資料可能被手動改過，或來自舊版本）。
- 要改資料格式時：把 `version` 加一，並在 `parse` 裡依 `savedVersion` 轉換舊格式。在加入版本號之前存的資料，`savedVersion` 是 0。

### 備份與還原
`src/lib/backup.ts` 把 localStorage 裡所有 `ippo.` 開頭的 key 原封不動包成一個檔案，所以**新增一個 store 不用改備份程式**：

```jsonc
{ "app": "ippo", "format": 1, "exportedAt": "2026-10-05T09:00:00.000Z",
  "stores": { "ippo.progress": { "v": 1, "data": { … } }, "ippo.memory": { … } } }
```

- `createBackup(storage, now)` 收集、`readBackup(text)` 驗證（不是 JSON、`app`／`format` 不對、`stores` 不是物件、含有 `ippo.` 以外的 key 都丟出中文訊息的 `Error`）、`restoreBackup(storage, backup)` 先刪掉現有的 `ippo.` key 再寫入。
- 還原是「換成備份當時的那台裝置」，所以備份裡沒有的 `ippo.` key 會被移除；`ippo.` 以外的 key 永遠不碰（同一個網域可能還有別的專案）。
- `Storage` 是參數而不是直接用 `localStorage`，整組函式才能單元測試（`tests/backup.test.ts`）。
- 畫面在設定頁的「學習紀錄」。匯出：觸控裝置（`pointer: coarse`）且 `navigator.canShare({ files })` 可用時走系統分享，因為 iOS 沒有看得到的下載資料夾；使用者取消（`AbortError`）就停在那裡，其他錯誤或電腦（分享選單沒有「儲存」）一律改用 Blob URL 下載 `ippo-backup-YYYY-MM-DD.json`。匯入：先 `confirm()` 顯示幾課幾張卡，還原後 `location.reload()`（記憶體裡的狀態都是啟動時從儲存讀進來的）。

### 一課要多久
`src/content/estimate.ts` 的 `lessonMinutes(lesson)` 從內容本身算出整數分鐘（最少 3 分鐘）：新假名、單字與例句、句型與例句、會話行數，再加上這一課會出幾題。課程改了估計就跟著改，不用手動維護。課程地圖的每一列顯示「約 N 分鐘・<目標>」，課程簡介的第一項是「大約 N 分鐘」。

### 新手引導
`src/ui/welcome.ts`（`#/welcome`，用 `focusLayout`，沒有分頁列）三個畫面：怎麼學、聽聽看、從哪裡開始。

- `src/main.ts` 在第一次 `route()` 之前判斷：`!settings.welcomed`、沒有任何課程紀錄、而且網址是空的或 `#/` 時，才用 `history.replaceState(null, "", "#/welcome")` 換網址。這裡不用 `location.replace`：它會觸發 `hashchange`，引導會被畫兩次。深連結（分享出去的某一課、書籤）永遠不會被攔截。
- 「聽聽看」用 `play()` 唸一次こんにちは；`voiceStatus()` 說這台裝置沒有日文語音時，不等使用者按「聽不到」就直接展開解法。解法本身是 `src/ui/voice-help.ts`，設定頁與引導共用同一份，不要再抄一份。
- 「我已經會五十音」會設 `knowsKana` 與 `romaji: "off"`，並跳到第一個非 `skippableWithKana` 單元的課。
- `Unit.skippableWithKana`（目前只有 `sounds` 單元）＋ `lessonsFor(knowsKana)`（`src/content/course.ts`）決定「下一課」要從哪裡算；課程地圖仍然列出全部的課，只是不再推薦發音單元，首頁的「還不會五十音也沒關係」也會收起來。

### 新增設定
在 `src/state.ts` 的 `Settings`、`DEFAULT_SETTINGS`、`parseSettings` 加欄位；畫面在 `src/ui/settings.ts`。需要套用到整個頁面的設定（例如 CSS 開關）寫在 `applySettings()`。

### 主題與顏色
顏色都是 CSS 變數，定義在 `src/style.css` 的 `:root`，Tailwind 透過 `tailwind.config.js` 使用（`bg-paper`、`text-ink`、`bg-card`…）。元件裡不要寫死顏色（例如 `bg-white`），改用語意化的 token。

- **深色主題**：`:root[data-theme="dark"]` 只覆寫同一組變數，別的都不用改。設定 `theme`（`system`／`light`／`dark`）由 `applySettings()` 解析：`system` 讀 `matchMedia("(prefers-color-scheme: dark)")` 並持續監聽，所以系統切換時畫面立刻跟著變；結果寫進 `<html data-theme>`，同時設定 `color-scheme` 與 `<meta name="theme-color">`。`index.html` 裡有一小段 inline script 在第一次繪製前做同樣的事，否則深色下重新整理會閃一下白底。
- **填色上的字**：按鈕、複習橫幅、句型卡這類填滿強調色的區塊，文字用 `text-on-accent`（`--on-accent`）而不是白色——深色主題的強調色偏亮，白字對比不足。唯一的例外是設定頁開關的圓鈕，兩個主題都維持白色。
- **字體大小**：設定 `textSize`（`standard`／`large`／`xlarge`）寫進 `<html data-text-size>`，只改根元素的 `font-size`（100%／112.5%／125%）。版面全部用 rem，所以整個 UI 一起放大。
- `tests/theme.test.ts` 直接讀 `src/style.css` 的變數，檢查兩個主題裡每一組「文字 × 底色」都達到 WCAG AA（4.5:1）。調色時先跑它。

### 語音
所有發音都經過 `src/lib/speech.ts` 的 `speak(markup, { rate, voice, pitch })`，畫面元件透過 `src/ui/japanese.ts` 的 `play()`／`playSequence()` 使用。不給選項就用學習者設定的語音與語速；聽辨特訓會指定語音（`varietyVoices()`）、語速與音高。之後若要改用預錄音檔，只需要在 `speak()` 這一處切換來源。

### 說出來：語音辨識與錄音
角色扮演與跟讀會用到麥克風，兩支包裝都在 `lib/`，不碰 DOM：

- `src/lib/listen.ts`：一次性的語音辨識（`SpeechRecognition`／`webkitSpeechRecognition`，ja-JP，五個候選，有逾時）。`canRecognize()` 告訴畫面能不能用；開始聽之前一定先停掉朗讀，否則會把自己的聲音聽進去。
- `src/lib/recorder.ts`：`MediaRecorder` 包裝（Safari 用 audio/mp4、Chrome 用 audio/webm），八秒自動停，結束一定放掉麥克風。
- `src/lib/match.ts`：`judgeSpeech()` 把辨識結果正規化（NFKC 統一全形與半形片假名、片假名轉平假名、去標點與空白）後，跟三種寫法比對——漢字原文、假名讀音，以及電話號碼這種連續唸出的數字轉成阿拉伯數字——用編輯距離給 pass／close／miss。

**隱私**：辨識的聲音會送到瀏覽器廠商（Chrome → Google、Safari → Apple），錄音則完全留在裝置上、離開畫面就 `revokeObjectURL()` 丟掉。第一次用麥克風前會顯示這段說明，看過了記在設定 `micNoticeSeen`（`src/ui/lesson/dialogue/mic.ts`）。

## 不方便說、不方便聽

兩種暫停都在 `src/ui/pause.ts`，各自對應一個設定：`speakOffUntil` 與 `listenOffUntil`（epoch 毫秒，0 表示開著）。`pauseRow(kind, onChange)` 畫出「現在不方便說／現在不方便聽」與「已關閉…，HH:MM 之後恢復」加「取消」，按下去之後呼叫 `onChange` 讓畫面重畫。

- **不方便說**：`speakingOff()`。跟讀收起錄音、角色扮演改成自評，一樣能走完整段對話。
- **不方便聽**：`listeningOff()`，而且是一道出題的閘門：
  - `shouldAutoplay()`（＝ `settings.autoplay && !listeningOff()`）是唯一的自動播放判斷，畫面不要自己讀 `settings.autoplay`；手動點喇叭永遠可以播。
  - 出題函式是純函式，不讀設定：`lessonQuestions`、`kanaQuestions`、`reviewQuestions`、`challengeQuestions`、`kanjiQuestion`、`exerciseQuestion` 都收一個 `Ask`（`{ listening }`），由畫面傳 `!listeningOff()`。關掉時課程測驗改出「看意思／看中文選日文」，五十音考「看假名選拼音」，複習與單元挑戰把「聽懂」階段降成「認得」，假名卡整個不排進這次複習（它們還是到期的）；手寫的聽力題只有在把文字顯示出來不會洩漏答案時才留著，否則整題拿掉。
  - 測驗做到一半才按：每個聽力題下面都有這一行，按下去用 `Drill.skip(predicate)` 把當下這題和剩下的聽力題一起移出測驗——不計分、不進複習，進度的分母也跟著變小。
  - 一題都沒作答的測驗（全部跳過）不算完成：`runDrill` 的 `onFinish(score, answered)` 會告訴畫面還剩幾題，`answered === 0` 時不寫課程完成、不記學習日，改顯示 `skippedView()`。

## 焦點與朗讀

- `src/main.ts` 的 `route()` 在換頁後把焦點移到頁面的 `h1`（`src/ui/dom.ts` 的 `focusHeading()`，`tabindex="-1"` ＋ `preventScroll`），第一次載入不動焦點。
- 全螢幕流程（上課步驟、測驗題目、結算畫面）換畫面時也呼叫 `focusHeading()`，否則底部按鈕被換掉時焦點會掉回 `<body>`。沒有標題的畫面（例如單字卡）就讓 `<main>` 收下焦點。
- `announce(text)` 是全站唯一的 `aria-live="polite"` 隱藏區塊，掛在 `<body>` 上。測驗回饋用它唸「答對了」或「答錯了，正確答案是…」（去掉拼音與振假名的純文字）；回饋區塊本身因此沒有 `role="status"`，不會被唸兩次。

## 卡片與每日複習

```
src/learn/
  cards.ts      卡片目錄：每個單字、例句、會話台詞都是一張卡片
  scheduler.ts  FSRS 排程（ts-fsrs）＋題型等級
  memory.ts     每張卡的記憶狀態、作答紀錄、學習日（ippo.memory）與成效指標
  review.ts     依卡片熟悉度出複習題
```

- **卡片 id 就是日文標記本身**：同一句話在課程中出現幾次都是同一張卡。修改句子文字等於換一張新卡；舊的紀錄還留在儲存裡，但到期數、複習與統計都只看 `CARDS` 裡還存在的卡片，所以不會卡住。
- **哪些內容會進複習**：`lessonCards()` 決定，加上那一課第一次用到的假名（`lessonCardIds()`）。發音課的例句只是示範聲音，用 `Lesson.review: "words"` 讓那一課只有單字進複習。
- **題型隨熟悉度變難**：`level` 0 認得（看日文選意思）→ 1 聽懂（聽音選意思）→ 2 以上說出來（看中文說日文、自評）。答對且距離上次至少 12 小時才升一級（剛做完又重考不算），差一點不變，不會降兩級。課程結束時沒被考到的內容以 level 0 加入。只需要聽懂的卡片（別人的台詞、單一假名）停在「聽懂」。
- **新的卡片種類**：在 `Card.kind` 加一種，`reviewQuestion()` 的 switch 會要求你寫它的出題方式；`source` 標明卡片來自哪一課或哪個來源。課程以外的來源目前有 `"self"`：使用者自我介紹的五句話，由 `setProfileCards()` 放進 `CARDS`（`src/learn/profile.ts` 的 `selfIntro()` 產生），改了個人資料就換成新的句子，舊的像被改寫的課程內容一樣被忽略。
- **作答怎麼進排程**：任何題目只要帶 `card`，`runDrill` 的 `onFirstAnswer` 會把第一次作答的結果交給 `memory.answer()`。新題型想計入複習，只要在題目上填 `card`。
- **成效指標** `computeStats()`：連續學習天數、預估記得的單字（最近一次答錯的不算）、說得出口的句子與說法（最近一次「說說看」）、隔 3 天以上的複習答對率（作答紀錄只保留 30 天）。

## 混合複習與單元挑戰

新東西要跟舊東西放在一起練，才學得牢。課程裡有兩個地方做這件事：

- **課程測驗混入舊內容**：`memory.ts` 的 `pickMixIns()` 挑出「這一課以外」而且該複習的卡片（先到期的，最到期的排前面；再來是模型估計快忘掉的，低於 90% 才算）。`src/ui/lesson/player.ts` 用 `reviewQuestions()` 把它們變成題目，交給 `lessonQuestions(lesson, earlier, rng, mixIns)`，平均散在自動出的單字題之間（不是全部擠在開頭或結尾）。這些題目帶 `card`，所以作答一樣會進排程。
- **單元挑戰**：`src/learn/challenge.ts` 的 `challengeQuestions(unit, memoryOf, rng)` 只用那個單元的課，混出約 12 題：聽對方的台詞、說自己的台詞、單元裡手寫的題目（選句與句子重組）、單字。沒有會話的發音單元就只用單字，所以每個單元都出得來。出題順序輪流取用，不會連續兩題同一種。最近答錯或還不熟的卡片排前面。
- 單元要有 kebab-case 的 `id`（`src/content/types.ts` 的 `Unit`），網址 `#/challenge/<unitId>` 與最佳成績（`ippo.challenges`）都用它；`validateCourse()` 會擋重複或格式不對的 id。

## 假名進度與羅馬拼音

假名不是一次教完，而是跟著課程出現：`src/content/kana-progression.ts` 從每一課的讀音（單字、例句、句型例句、會話）算出用到哪些假名，把每個假名算給**第一次**用到它的課。一個「假名單位」是學習者一次要認的東西：拗音的小字 ゃゅょ 跟前一個假名合成一個單位（きゃ），和五十音表的格子一致；促音 っ 與長音 ー 不是單位（表上沒有它們，難的是拍子不是字形），標點也不算。

- **假名卡片**：`kana:<假名>`，`kind: "kana"`、`source: "kana"`，中文欄位放羅馬拼音。卡片來自五十音表的每一格（清音、濁音、拗音，平假名與片假名各一張），所以在表上練什麼都算得到。等級 0 出「看假名選拼音」（不給拼音提示），等級 1 以上出「聽音選假名」。
- **上課第一步**：有新假名的課，`lessonSteps()` 會先插入「這課的新假名」，平假名與片假名分開，點了就唸；課程簡介也會列出「新假名 N 個」。課程結束時這些假名卡片一起進入複習。
- **羅馬拼音逐字淡出**：`jpText()` 把每個單字排成一欄（上面是日文與振假名，下面是這個字的拼音），所以換行仍然只發生在單字之間；拼音在 `lang="ja"` 的行裡面，所以用 `aria-hidden` 讓讀螢幕軟體跳過，並用 `--font-page` 維持頁面字體。設定 `romaji` 有三種：`auto`（預設，整個字的假名都熟了就不再標）、`always`、`off`（用根元素的 `no-romaji` 整個關掉）。熟了的定義在 `memory.ts` 的 `mastered()`：等級 2 以上且最近一次沒答錯。含 っ 或 ー 的字永遠保留拼音，因為那是拍子的提示；考「讀假名」的題目用 `jpText(…, { romaji: false })` 強制不標。
## 台灣學習者專屬

```
src/content/kanji.ts  同形異義詞（陷阱）與新字體／繁體對照
src/content/pairs.ts  最小對立詞：長音・促音・清濁音・拗音・重音
src/learn/kanji.ts    漢字卡片怎麼出題
src/learn/pairs.ts    聽辨出題與各類別正確率（ippo.pairs）
src/ui/kanji.ts       漢字小教室（#/kanji）＋陷阱測驗（#/kanji-quiz）
src/ui/pairs.ts       聽辨特訓（#/pairs）＋一輪 12 題（#/pairs-quiz/<類別>）
```

- **同形異義**：每個詞有 `zh`（日文的意思）和 `trap`（同樣的漢字在中文的意思）。`trap` 一定會出現在選項裡，所以答對代表真的排除了中文的理解。這些詞是卡片（`kind: "kanji"`、`source: "kanji"`），點開或答過就進每日複習；課程已經教過的詞仍然算那一課的卡片。
- **聽辨特訓**：`trials()` 用注入的亂數產生一輪題目，每組對立詞出現次數平均、左右兩邊各一半，語速與音高每題隨機。聲音每題從 `varietyVoices()` 隨機挑一個——這是高變異語音訓練（HVPT）的精神，但多數裝置（例如 iPhone）只有一個可用的日文語音，那時真正變化的只有語速與音高，文案也只能這樣寫。
- 重音類別的詞寫成漢字（橋／箸、雨／飴），語音引擎才唸得出高低差；而且只挑單獨唸就聽得出差別的詞（頭高 vs 其他），尾高與平板的差別要接助詞才聽得到，不適合這個練習。其他類別用該詞平常的寫法。
- 這兩個練習不走 `runDrill`：聽辨是二選一，答錯再出一次只是猜，所以一題只問一次，正確率直接記進 `ippo.pairs`。
## 個人資料與旅行小抄

- `src/learn/profile.ts`：姓氏、城市、職業的候選清單與 `selfIntro(profile)`（純函式，回傳五句日文＋中文）。資料存在 `ippo.profile`；名字只收假名，`kanaName()` 會統一轉成片假名。城市讀音照日本的習慣：大多寫漢字加音讀（台中＝たいちゅう、高雄＝たかお），台北與基隆直接寫片假名 タイペイ／キールン——台北跟第 5 課的句子用同一種寫法，才不會多出一張一模一樣的卡片。
- `src/learn/phrasebook.ts`：`ippo.phrasebook` 存的是卡片 id 的順序清單，句子本身一律從 `CARDS` 取，所以不會和課程內容脫節。畫面上的 ☆ 是 `src/ui/star.ts` 的 `starButton(id)`；不是卡片的內容（發音課的示範例句）不會出現星星。

## 離線使用（PWA）

- `public/manifest.webmanifest` 與 `public/sw.js` 直接複製到 `dist/`，網址全部相對，所以在 GitHub Pages 的子路徑也能用。
- Service worker 只在 `import.meta.env.PROD` 時由 `src/main.ts` 註冊：安裝時快取 `./`、`./index.html` 和 index 裡面的 `./assets/…`；開頁面走「先連網、連不到就用快取」（只有正常回應才會覆蓋離線用的首頁），其他同源 GET 走「先快取」。改版時把 `sw.js` 裡的 `CACHE` 加一號，activate 時會刪掉其他 `ippo-` 開頭的快取——快取空間是整個網域共用的，同一個 GitHub 帳號的其他專案不能掃到。
- 圖示（`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`apple-touch-icon.png`）是用無頭瀏覽器把 `public/favicon.svg` 截圖產生的，換圖示時重做一次即可。

## 測試

- `npm test`：單元測試與整個課程的內容檢查。
- 測試只驗證使用者看得到的行為與資料規則；不測實作細節。
- pull request 會自動跑測試與建置（`.github/workflows/ci.yml`）；合併到 `main` 後自動部署到 GitHub Pages。
