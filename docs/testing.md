# 測試計畫

Ippo 是純前端的靜態網站，學習紀錄只存在使用者自己的瀏覽器。一旦出錯，沒有後端可以幫忙修資料，使用者也沒辦法回報「我昨天的進度不見了」。所以測試的重點放在三件事：**內容正確**、**學習紀錄不會壞掉**、**手機上每個畫面都走得完**。

## 分層

| 層 | 工具 | 跑在哪 | 指令 | 顧什麼 |
|---|---|---|---|---|
| 內容檢查 | Vitest + `src/content/validate.ts` | Node | `npm test` | 每一課的標記語法、讀音、助詞、選項、句子重組 |
| 單元測試 | Vitest | Node | `npm test` | 出題、FSRS 排程、記憶與成效指標、存檔解析與版本遷移、備份、羅馬拼音、答案比對、語音朗讀與聽寫的包裝層 |
| 端對端 | Playwright（手機尺寸 Chromium） | 正式建置 + `vite preview` | `npm run test:e2e` | 路由、畫面、跨重新整理的存檔、整課走完、離線 |
| 真機手測 | 人 | iPhone Safari、Android Chrome | 見文末清單 | 瀏覽器自帶、自動化測不到的能力 |

原則：
- 測使用者看得到的行為與資料規則，不測實作細節。E2E 只用角色和可見文字找元素（`getByRole`、`getByText`），不依賴 class 名稱。唯一的例外是解題 helper，它需要讀出「正確答案」的標示。
- 邏輯能在 Node 測就在 Node 測：快，失敗時也容易看懂。E2E 只放「只有瀏覽器才看得到」的部分。
- 每個 E2E 測試都會檢查 console 沒有錯誤（`e2e/fixtures.ts` 的 `errors` fixture 自動套用）。

## 風險與對應的測試

| 風險 | 後果 | 測試 |
|---|---|---|
| 課程內容寫錯（漏讀音、助詞黏在一起、題目有兩個正確答案） | 學錯、題目無解 | `tests/content.test.ts`、`tests/quiz.test.ts` |
| 存檔格式改版或被手動改壞 | 進度歸零、整個 App 打不開 | `tests/store.test.ts`、`tests/learn.test.ts`（`parse*`）、`tests/live-stores.test.ts` |
| 複習排程錯誤 | 不該出現的卡片一直出現，或該複習的都不出現 | `tests/learn.test.ts`、`tests/interleave.test.ts`、`e2e/practice.e2e.ts`（到期卡片 → 複習 → 重新排程） |
| 備份檔還原不完整 | 換手機時遺失紀錄 | `tests/backup.test.ts`、`e2e/settings.e2e.ts`（匯出 → 清除 → 匯入） |
| 語音引擎不回報結束、沒有日文語音 | 「播放全部」卡住、畫面一直顯示播放中 | `tests/speech.test.ts` |
| 聽寫權限被拒、網路中斷、Android 不發出錯誤就直接結束 | 角色扮演一直在等 | `tests/listen.test.ts` |
| 某一頁丟出例外或在手機上需要左右捲動 | 畫面空白、跑版 | `e2e/routes.e2e.ts`（每一頁、每一課、每個單元挑戰；特大字體） |
| 一課走不完（步驟卡住、測驗的題目永遠答不完） | 學習中斷 | `e2e/lesson.e2e.ts`、`e2e/practice.e2e.ts` |
| 新手引導綁架深層連結，或之後又跳出來 | 分享出去的連結打不開 | `e2e/onboarding.e2e.ts` |
| 「給店員看」蓋住畫面關不掉、橫拿被切掉 | 在店裡最需要的時候不能用 | `e2e/phrasebook.e2e.ts` |
| Service worker 沒快取到資源 | 在日本沒網路時打不開 | `e2e/offline.e2e.ts` |
| 深色模式、字體大小沒有套用或沒存起來 | 戶外看不清楚 | `tests/theme.test.ts`（WCAG AA 對比）、`e2e/settings.e2e.ts` |

## 端對端測試的寫法

- **對象是正式建置的網站**：`playwright.config.ts` 會先跑 `npm run build`，再用 `vite preview` 開在 4173 埠，跟 GitHub Pages 服務的是同一份檔案。
- **手機優先**：預設模擬 Pixel 7（觸控、412px 寬），語系 `zh-TW`。
- **假的語音引擎**：無頭 Chromium 沒有日文語音，真的引擎也會讓每個測試都在等聲音播完。`fakeSpeech` 換掉 `speechSynthesis`，把要唸的文字記在 `window.__spoken` 並立刻結束。用 `spoken(page)` 檢查唸了什麼。
- **預先放好存檔**：`test.use({ seed: { progress: {...} } })` 會在第一次載入前寫進 localStorage，格式跟 App 自己存的一樣（`ippo.<名稱>` → `{ v, data }`）。傳入的 `settings` 會合併在 `{ welcomed: true }` 之上，所以預設會略過新手引導；要測第一次使用的情境，就傳 `settings: undefined`。重新整理不會再寫一次，所以能檢查 App 自己存了什麼。用 `store(page, "memory")` 讀回存檔。
- **解題 helper `solveDrill`**：不預先知道任何答案。第一次看到一題就猜；猜錯的話，畫面會顯示正確答案，helper 記下來，等這題重新出現時答對。這和學習者的經驗一樣，所以內容改了也不用改測試。
- **Service worker 預設封鎖**，避免拿到上一次建置的快取；只有 `offline.e2e.ts` 會打開它。
- **一個測試會走完整段測驗時**，加上 `test.slow()`。

本機執行：

```bash
npx playwright install chromium   # 第一次
npm run test:e2e
npm run test:e2e -- --ui          # 互動模式，可以一步一步看
```

已經裝好 Chromium 的環境（例如雲端沙盒）可以用 `PLAYWRIGHT_CHROMIUM=/path/to/chrome npm run test:e2e` 指定瀏覽器，不必再下載。

## 不穩定的測試

- 不設自動重試（`retries: 0`）：會不穩定的測試就是有 bug，可能在測試，也可能在 App。
- 新增或修改 E2E 時，先用 `npm run test:e2e -- --repeat-each=5` 跑過再送出。
- CI 失敗時，`playwright-report/` 和 `test-results/`（含 trace）會上傳成 artifact，用 `npx playwright show-trace <trace.zip>` 打開來看。

## CI

`.github/workflows/ci.yml` 在每個 pull request 跑兩個 job：
- `check`：`npm test`，接著 `npm run build`（型別檢查 + 打包）。
- `e2e`：`npm run typecheck:e2e`，接著安裝 Chromium，最後跑 `npm run test:e2e`。

## 模擬器（GitHub Actions）

`.github/workflows/devices.yml` 會在 iOS 模擬器的 Safari 和 Android 模擬器的 Chrome 上，跑正式建置的網站，替真機清單先檢查做得到的部分：
- 有沒有日文語音，按「聽聽看」之後語音有沒有唸完。按鈕是用模擬器本身的點擊按下去的，因為 iOS 只在使用者操作時才會發聲。
- 上課頁、分頁列和「給店員看」的按鈕，有沒有被瀏海、Home 條或系統列擋到；「給店員看」直拿、橫拿時字有沒有被切掉。
- 特大字體下，12 個最滿的頁面有沒有需要左右捲動。
- 深色模式。只截圖，由人來看對比。
- 關掉伺服器之後，還能不能從快取打開課程頁。這是在瀏覽器裡測的，不是加到主畫面的 App。

到 Actions 分頁選 **devices → Run workflow** 執行；填了 issue 編號，結果會留言到那個 issue，截圖在這次執行的 artifacts 裡。改了 `devices/` 的 pull request 也會自動跑。腳本本身可以先在本機試跑：`npm run build && node devices/run.mjs desktop`。

模擬器測不到麥克風、錄音、系統分享選單和加到主畫面，也聽不到實際音質，所以這些仍要用真機確認。

## 真機手測清單（發版前）

自動化測不到裝置本身的能力。發版前，用一台 iPhone（Safari）和一台 Android（Chrome）走一遍：

- [ ] 第一次打開：新手引導的「聽聽看」真的有聲音；按「聽不到」會出現這台裝置適用的說明。
- [ ] 設定頁可以選語音（Kyoko／Otoya、Google），試聽正常；語速改了之後有生效。
- [ ] 角色扮演：第一次使用前會先顯示麥克風說明；允許之後，說日文能辨識並判定過關；拒絕權限後可以改用自評走完整段對話。
- [ ] 跟讀：可以錄音、播放自己的聲音，離開畫面後錄音就刪掉。
- [ ] 加到主畫面（PWA）之後，開飛航模式還能打開，也能上課。
- [ ] 匯出備份：手機上會跳出系統分享選單，存到「檔案」之後可以再匯入。
- [ ] 「給店員看」橫拿時字會放大，而且不會被切掉；iPhone 的瀏海和 Home 條沒有擋到按鈕。
- [ ] 深色模式在戶外和夜裡都看得清楚；特大字體下沒有任何一頁需要左右捲動。
