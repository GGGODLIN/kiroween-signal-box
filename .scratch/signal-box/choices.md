# Signal Box (LeverFrame) 實作決定帳本（`3090e24..3635bdd`）

## 八類掃描

- **資料形狀與格式**：有（C1 `StepHistoryEntry` 冪等操作不重複附加紀錄、C2 `TappetBarView` 與 `SoundCue` 衍生狀態結構）
- **存放位置與命名**：有（C3 `POST /api/mcp` 模組層級單例 Store 與 `.kiro/hooks/*.json` 結構）
- **API 契約與錯誤行為**：有（C4 `executeSignalBoxMcpTool` 在衝突路線已開放時跳過前置轉轍器／路牌扳動直接檢測目標號誌、C5 `POST /api/mcp` 對畸形 JSON 回傳 HTTP 400 與 `INVALID_JSON_BODY`）
- **新增的相依套件**：有（C6 釘選 `fast-check@^4.1.1` 與預設常數 `DEFAULT_NUM_RUNS=80`、`DEFAULT_MAX_STEPS=25`、`DEFAULT_SEED=20261031`）
- **並行與效能取捨**：有（C7 瀏覽器端 `sharedAudioContext` 單例重用與節點 `onended` 斷開）
- **範圍解讀**：無（完整實作規格所列之 8 根拉桿、雙預設表、逐步 PBT 驅魔、反例單步重播、6 項 Trial Receipt 與 4 個 MCP 工具，無自減或超範圍擴張）
- **測試設定改動**：無（使用 Node 24 原生 `node --experimental-strip-types --test`，無放寬 timeout、無 skip、無 mock 掉真實聯鎖核心）
- **之後的程式會照抄的模式**：有（C8 `CURSED_MISSING_CROSSOVER_LOCK` 故障注入僅在 `Signal #1` 已開放時省略 `Point #2` 對齊檢查，使 P1 與 P2 皆維持正交有效）

---

## 決定明細

### C1：冪等拉桿操作（`NO_OP_IDEMPOTENT`）不重複寫入 `stepHistory`
- **何時**：Pass `Ticket 01`（commit `3a1d5e5`），出處 `src/lib/interlocking.ts:575-587`
- **決定**：當使用者或隨機測試產生器對已經處於 `REVERSE`（拉起）的拉桿再次執行 `PULL`，或對已處於 `NORMAL`（歸位）的拉桿再次執行 `RELEASE` 時，現在直接回傳 `lastOutcome: 'NO_OP_IDEMPOTENT'` 並保留原本的 `stepHistory` 陣列不附加新列；如果沒選這個做法而是每次重複拉動都往 `stepHistory` 塞一筆紀錄，隨機序列在連續抽到相同動作時會讓步驟歷史膨脹且污染重播步驟計數。
- **規格缺口**：Ticket 01 第 6 條驗收條件要求「handled idempotently without duplicating active routes or corrupting step history」，但未明訂 `NO_OP_IDEMPOTENT` 是否應在 `stepHistory` 新增一筆紀錄或保持原長度。
- **影響範圍**：所有讀取 `FrameState.stepHistory` 的 UI 歷史面板與重播索引對齊邏輯。
- **判定**：`sound` — 機械拉桿已經拉到底時再拉一次並無物理位移，不追加歷史步驟最符合「不污染步驟歷史」的契約。
- **把握度**：高

### C2：Store 內嵌 `tappetBars` 即時鎖定狀態與 `lastSoundCue` 音效事件分類
- **何時**：Pass `Ticket 03`（commit `eeb51a7`），出處 `src/lib/signal-box-store.ts:15-31`、`src/lib/signal-box-store.ts:138-168`
- **決定**：每次拉動拉桿或切換預設表時，Store 自動巡檢目前預設表的每一條 `InterlockRule` 並輸出 `tappetBars`（含 `engaged: boolean` 代表該機械鎖定桿是否正在擋住目標拉桿）以及 4 種離散音效代號 `lastSoundCue`（`LEVER_LATCH`、`INTERLOCK_CLANK`、`COLLISION_ALARM`、`BELL_CHIME`）；如果沒選這個做法而讓 React 元件自己在渲染時重跑規則閉包或各自判斷音效，UI 與 headless 測試就無法在 `Seam 2` 直接驗證鎖床狀態與音效觸發。
- **規格缺口**：規格要求在 `Seam 2` 暴露「tappet locking bars」與 WebAudio 機械音效回饋，但未規定鎖床單一鎖桿的資料欄位名稱與音效事件列舉值。
- **影響範圍**：`src/app/page.tsx` 的 Tappet 鎖床表格、WebAudio 合成器分派與 `tests/ticket-03-ui-store-and-mcp.test.ts`。
- **判定**：`sound` — 將衍生鎖桿狀態與音效事件收進純 TypeScript Store，讓無瀏覽器的 Node 測試也能完整驗證鎖床與音效觸發條件。
- **把握度**：高

### C3：`POST /api/mcp` 路由採用模組層級單例 Store 供無狀態 HTTP 呼叫共享狀態
- **何時**：Pass `Ticket 03`（commit `eeb51a7`），出處 `src/app/api/mcp/route.ts:8-27`
- **決定**：當外部 Kiro Crew Agent 透過 HTTP `POST /api/mcp` 連續發送 `request_route`、`inspect_interlock` 與 `release_route` 請求時，API 路由使用模組層級的 `serverSignalBoxStore` 保存跨請求的號誌樓狀態；如果沒選這個做法而是每個 HTTP 請求都新建一個空白 Store，前一個 Agent 取得的路線鎖定在下一個 HTTP 請求進來時就會消失，無法在 HTTP 層展示多 Agent 互斥。
- **規格缺口**：Ticket 03 指定實作 `executeSignalBoxMcpTool` 與 `POST /api/mcp`，但未指定 HTTP 端點在多次請求間如何持有 Store 實例。
- **影響範圍**：透過 `/api/mcp` HTTP 端點互動的外部客戶端與 API 測試。
- **判定**：`sound` — 單機展示與黑客松 Demo 下以行程內單例持有號誌樓狀態最簡單直接，且核心邏輯仍由可注入任意 `store` 的 `executeSignalBoxMcpTool(store, req)` 承載。
- **把握度**：高

### C4：`executeSignalBoxMcpTool` 的 `request_route` 在已有衝突號誌開放時不預先扳動轉轍器或路牌
- **何時**：Pass `Step 3.5 Review Fix`（commit `3635bdd`），出處 `src/lib/signal-box-store.ts:306-374`、`src/lib/interlocking.ts:261-287`
- **決定**：當某個 AI Agent 呼叫 `request_route` 請求路線（例如 `Deployer` 請求 `BRIDGE_MAINLINE` 或 `Migrator` 請求 `SOUTH_TO_BRIDGE`），而場上已有另一個衝突號誌處於 `REVERSE`（通行中）時，`buildRouteActionSequence` 會跳過前置的轉轍器或路牌拉桿（如 `#2`、`#3`、`#7`、`#8`），直接嘗試拉動目標號誌拉桿並由聯鎖規則擋下；如果沒選這個做法而是照常先拉前置拉桿再拉號誌，當最後一步號誌被聯鎖拒絕時，前置拉桿（如 `#7` 路牌）就會殘留在被改動的 `REVERSE` 狀態。
- **規格缺口**：規格要求 `request_route` 使用與手動拉桿完全相同的聯鎖核心與 EARS 規則，但未定義多步路線請求在最後一步被拒絕時，前置準備動作應如何避免留下半套副作用。
- **影響範圍**：`executeSignalBoxMcpTool` 的 `request_route` 行為與 `tests/ticket-03-ui-store-and-mcp.test.ts` 的 AC 3 驗證。
- **判定**：`sound` — 真實信號樓操作員在看到衝突號誌開放時不會先去硬扳轉轍器或路牌；跳過前置步驟直接測試目標號誌，既能拿到正確的阻擋規則 ID（如 `EARS-ILK-01`、`EARS-ILK-06`），又保證被拒絕的請求零狀態殘留。
- **把握度**：高

### C5：`POST /api/mcp` 遇到無法解析的 JSON Body 時回傳結構化 400 回應而非拋出 500
- **何時**：Pass `Ticket 03`（commit `eeb51a7`），出處 `src/app/api/mcp/route.ts:10-21`
- **決定**：當客戶端對 `POST /api/mcp` 送出損壞的 JSON 字串時，`request.json()` 的例外被攔截並回傳 HTTP 400 與 `{ isError: true, errorCode: 'INVALID_JSON_BODY', errorMessage: '...' }`；如果沒選這個做法而是讓 `request.json()` 直接 throw，Next.js 會回傳非結構化的 500 HTML/文字錯誤，違反 MCP 工具不拋未處理例外的契約。
- **規格缺口**：Ticket 03 AC 4 規定對缺欄位或未知工具回傳結構化錯誤（`isError: true`, `errorCode`），但未明寫 HTTP 層收到非法 JSON 語法時的 `errorCode`。
- **影響範圍**：`src/app/api/mcp/route.ts` 的錯誤處理契約。
- **判定**：`sound` — 與 `executeSignalBoxMcpTool` 的結構化錯誤形狀完全一致。
- **把握度**：高

### C6：`fast-check` 驅魔引擎固定內部預設參數（`numRuns=80`、`maxSteps=25`、`seed=20261031`）
- **何時**：Pass `Ticket 02` 與 YAGNI 修剪（commit `0be2f3d`），出處 `src/lib/pbt-exorcist.ts:69-71`
- **決定**：當呼叫 `runInterlockingExorcism` 或 `generatePbtTrialReceipt` 時，內部固定使用 `DEFAULT_NUM_RUNS = 80`、`DEFAULT_MAX_STEPS = 25`、`DEFAULT_SEED = 20261031`（在 `CURSED_MISSING_CROSSOVER_LOCK` 第 3 輪產生 11 步隨機碰撞序列並縮減為 3 步最小反例，雙預設總耗時約 1–2 毫秒）；如果沒選這個做法而是用極大 `numRuns`（如 10,000 次）或不固定 seed，瀏覽器點擊「RUN PBT EXORCIST」時可能造成 UI 卡頓，且每次產出的 `originalLength` 會隨時間浮動。
- **規格缺口**：規格要求使用 `fast-check` 跑隨機拉桿序列並輸出包含 seed 與時間成本的 Trial Receipt，但未硬性規定預設跑幾輪、每輪幾步與預設 seed 數值。
- **影響範圍**：`src/lib/pbt-exorcist.ts` 與 UI 的 Trial Receipt 顯示數值。
- **判定**：`needs-user` — 80 輪 × 最長 25 步（共約 586 次逐步斷言、耗時 1–2ms）兼顧了瀏覽器即時互動流暢度與反例縮減展示效果；暫定做法為維持 `DEFAULT_NUM_RUNS = 80`、`DEFAULT_MAX_STEPS = 25`、`DEFAULT_SEED = 20261031`，若你想提高隨機探索強度，撤回方式為修改 `src/lib/pbt-exorcist.ts:69-71` 的三個常數。
- **把握度**：中

### C7：WebAudio 合成器共用單一 `sharedAudioContext` 並在振盪器結束時斷開節點
- **何時**：Pass `Step 3.5 Review Fix`（commit `3635bdd`），出處 `src/app/page.tsx:107-138`
- **決定**：當使用者在瀏覽器連續點擊拉桿或重播反例觸發 `playMechanicalSound` 時，程式重用模組層級的 `sharedAudioContext`（若處於 `suspended` 則呼叫 `resume()`），並在每個 `OscillatorNode` 的 `onended` 回呼中呼叫 `disconnect()`；如果沒選這個做法而是每次點擊都 `new AudioContext()`，在 Safari 或 Chrome 連續拉動超過 6–32 次後就會撞上瀏覽器硬體 `AudioContext` 數量上限而變成無聲。
- **規格缺口**：規格要求以 WebAudio 合成機械音效並支援靜音切換，但未指定 `AudioContext` 生命週期管理方式。
- **影響範圍**：`src/app/page.tsx` 的瀏覽器音效播放穩定性。
- **判定**：`sound` — 符合瀏覽器 WebAudio API 資源管理最佳實踐。
- **把握度**：高

### C8：`CURSED_MISSING_CROSSOVER_LOCK` 僅在 `Signal #1` 已開放時漏檢 `Point #2` 對齊條件
- **何時**：Pass `Step 3.5 Review Fix`（commit `3635bdd`），出處 `src/lib/interlocking.ts:449-468`、`src/lib/pbt-exorcist.ts:127-135`
- **決定**：在故障注入預設表 `CURSED_MISSING_CROSSOVER_LOCK` 的 `ruleIlk05Cursed` 中，當 `Signal #1` 為 `NORMAL` 時仍正常要求 `Point #2 === 'REVERSE'`，只有當 `Signal #1` 已經是 `REVERSE` 時才同時漏掉 `EARS-ILK-01` 與 `Point #2` 檢查，且 `runInterlockingExorcism` 對 P1 與 P2 任一違規皆回傳 `false`；如果沒選這個做法而是無條件拿掉 `Point #2` 檢查，隨機序列只要 2 步（`PULL #3 -> PULL #4`）就會先撞上單純的轉轍器未對齊（P2），或者為了避開它而在 PBT 裡忽略 P2 違規。
- **規格缺口**：規格定義 `CURSED_MISSING_CROSSOVER_LOCK` 為「漏掉交叉互斥鎖導致雙車同時進入共用橋樑區段（P1 碰撞）」，同時要求 PBT 每步檢查 P1 與 P2。
- **影響範圍**：`src/lib/interlocking.ts` 的 `CURSED_MISSING_CROSSOVER_LOCK` 規則定義與 `src/lib/pbt-exorcist.ts` 的逐步斷言。
- **判定**：`needs-user` — 將故障精確定位在「North 號誌已開放時的交叉鎖遺漏」，讓 P1 與 P2 都在 PBT 中嚴格生效且縮減出最直觀的 3 步雙列車對撞反例（`PULL #3 -> PULL #1 -> PULL #4`）；暫定做法為保留 `src/lib/interlocking.ts:457` 的條件式故障注入，若你想讓 Cursed 表連單車轉轍器對齊也一併拿掉（改展示 2 步 P2 反例），撤回方式為刪除 `src/lib/interlocking.ts:457-462` 的 `if (levers[1] === 'NORMAL' && levers[2] !== 'REVERSE')` 分支。
- **把握度**：中
