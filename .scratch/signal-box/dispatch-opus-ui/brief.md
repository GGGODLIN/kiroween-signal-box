# Worker brief：opus-signal-box-ui / kiroween-signal-box

你是 `/Users/linhancheng/Desktop/projects/kiroween-signal-box` 裡的完整 Claude Code session（模型：`opus[1m]`，effort：`max`，使用 `team-p` 流量），這個 repo 與全域 `~/.claude` 的 hook、skill 與 settings 對你生效。派工的是另一個 session（main）；使用者本人也可能直接在這個視窗打字。

## 任務

使用者看過剛才 `onetake` 影片的高質感設計後，點出目前的 **Live Demo 線上站 UI（`src/app/page.tsx` 與 `src/app/layout.tsx`）太醜**（目前是用生硬的後台深色方框與密密麻麻的 inline styles 拼出來的工程師介面），指定由你（`Opus 5.5 Max`）徹底重做 `src/app/page.tsx` 與 `src/app/layout.tsx` 的視覺與互動體驗！

請將你在 `/Users/linhancheng/Desktop/projects/onetake-trial/films/kiroween-signal-box-opus/comp.html` 與 `look.json` 中建立的 **1856 維多利亞暗黑黃銅機械號誌樓美學**（深綠煤黑 `#0B0F0D`、奶油琺瑯 `#EFE8D6`、鍛造黃銅 `#C9A35B`、`Fraunces` + `Archivo Condensed` + `Geist Mono` 字體排印、英國鐵路慣例配色的立體扁鐵拉桿與扳機把手、會真實滑動並用黃銅鎖塊 dog 物理卡死的鋼製 Tappet 鎖床、以及碎裂縮減的 11→3 步 `fast-check` 反例劇場）完整移植並升級成這個互動式 Next.js Web App！

## 互動規則

- 直接動手重做 `src/app/page.tsx` 與 `src/app/layout.tsx`（可新增 CSS 或子元件），不需要停下來問選擇題。
- **必須實際截圖並用 `Read` 視覺自檢**：啟動本地伺服器（或透過 Playwright 截圖腳本）擷取桌面版（1440×900 / 1920×1080）在以下狀態的真實瀏覽器渲染截圖並用 `Read` 挑剔檢查排版、字距、留白、拉桿透視與鎖床對齊：
  1. 初始與 `NORTH_TO_BRIDGE` 淨空狀態（`Lever #3 REVERSE → Lever #1 REVERSE`）
  2. `STANDARD_SAFE` 下嘗試拉 `#4` 被 `EARS-ILK-01` 黃銅鎖塊物理擋下的狀態
  3. 切換至 `CURSED_MISSING_CROSSOVER_LOCK` 並執行 `RUN PBT EXORCIST` 抓出 `11 → 3 steps (P3 · P1 · P4)` 最小反例的狀態
  4. 逐步重播（`Step Replay Forward`）至第 3 步觸發 `junction-throat` 與 `schema-bridge` 碰撞警報，以及檢視 6 項 `PBT Trial Receipt` 的狀態
- 將上述 4 張美感滿分的最新實機截圖覆寫存至 `/Users/linhancheng/Desktop/projects/kiroween-signal-box/dist/screenshots/`（`01-lever-frame-interlock.png`, `02-ears-tappet-block.png`, `03-pbt-exorcist-shrinking.png`, `04-trial-receipt-verified.png`），並產出一張重做前後對照圖 `/Users/linhancheng/Desktop/projects/kiroween-signal-box/.scratch/signal-box/dispatch-opus-ui/receipts/ui-before-after.png`。
- 確保既有 18 條測試（`npm test`）與 `npm run build` 100% 通過（注意 `tests/ticket-03-ui-store-and-mcp.test.ts` AC 5 會檢查 `src/app/page.tsx` 內的一些關鍵文案或標記，重做時請先讀 `tests/ticket-03-ui-store-and-mcp.test.ts` 確保所有測試斷言保持綠燈！）。
- 完成後回報：
  1. 舊版 UI 的審美敗筆 vs 新版 UI 的核心設計（配色、字體、立體拉桿架、動態 Tappet 鎖床、留白與版面構成）
  2. `ui-before-after.png` 與 4 張新實機截圖的路徑與自檢結果
  3. `npm test`（18/18 pass）與 `npm run build` 的驗證輸出

## 邊界

- 不 push、不開 PR、不 rebase、不 amend（可在本地 commit 或保持工作區乾淨交給 main 部署 GitHub Pages）。
- **嚴禁跑 `pkill -f chrom`、`killall Google Chrome` 等廣域殺程序指令**；只准清自己啟動的 PID。
- 執行 Playwright 截圖時使用：
  `uv run --with playwright --with pillow python3`

## 脈絡

- 以下為使用者原話（逐字）：
  - `Live Demo 線上站也太醜，也讓opus max重作吧`
- 必讀參考檔案：
  - 剛完成的滿分影片合成檔（美學標竿）：`/Users/linhancheng/Desktop/projects/onetake-trial/films/kiroween-signal-box-opus/comp.html` 與 `/Users/linhancheng/Desktop/projects/onetake-trial/films/kiroween-signal-box-opus/look.json`
  - 舊版過醜的實機截圖（反面教材）：`/Users/linhancheng/Desktop/projects/onetake-trial/films/kiroween-signal-box-opus/ref/` 底下的舊版 app 截圖
  - 待重做的目標檔案：`/Users/linhancheng/Desktop/projects/kiroween-signal-box/src/app/page.tsx`、`/Users/linhancheng/Desktop/projects/kiroween-signal-box/src/app/layout.tsx`
  - 狀態機與 Store 介面：`/Users/linhancheng/Desktop/projects/kiroween-signal-box/src/lib/interlocking.ts`、`/Users/linhancheng/Desktop/projects/kiroween-signal-box/src/lib/pbt-exorcist.ts`、`/Users/linhancheng/Desktop/projects/kiroween-signal-box/src/lib/signal-box-store.ts`
  - 測試斷言契約：`/Users/linhancheng/Desktop/projects/kiroween-signal-box/tests/ticket-03-ui-store-and-mcp.test.ts`
