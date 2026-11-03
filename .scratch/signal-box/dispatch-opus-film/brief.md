# Worker brief：opus-signal-box-film / kiroween-signal-box

你是 `/Users/linhancheng/Desktop/projects/kiroween-signal-box` 裡的完整 Claude Code session（模型：`opus[1m]`，effort：`max`，使用 `team-p` 流量），這個 repo 與全域 `~/.claude` 的 hook、skill 與 settings 對你生效。派工的是另一個 session（main）；使用者本人也可能直接在這個視窗打字。

## 任務

使用全域 `onetake` skill（`/Users/linhancheng/.claude/skills/onetake/SKILL.md`），為 **AWS Kiroween 2026**（`Resurrection` 賽道）參賽作品 **Signal Box (`LeverFrame`) — 1856 Victorian Mechanical Interlocking × Spec-Driven `fast-check` PBT Exorcist** 設計並渲染一支高美感、電影感十足的 **45 秒 1080p30 產品演示短片**，工作目錄放在 `/Users/linhancheng/Desktop/projects/onetake-trial/films/kiroween-signal-box-opus/`，最終成品輸出至 `/Users/linhancheng/Desktop/projects/kiroween-signal-box/dist/signal-box-demo.mp4`，同時產出 4 張 1920×1080 產品精選截圖至 `/Users/linhancheng/Desktop/projects/kiroween-signal-box/dist/screenshots/` 供 Devpost 畫廊上傳。

## 互動規則

- 直接動手設計、合成配音與機械音效、自我視覺審查並完成渲染與 `verify_promo.py` 8 項驗收，不需中途停下問選擇題。若遇到只有使用者能決定的重大範圍分歧，才把問題原文印出來、停下等答案。
- **重要提醒**：當你啟動 `render.py` 時，請以**前景（foreground，設定較長 timeout 如 600000ms）**執行，不要用 `run_in_background: true` 結束當前 turn——否則外部 watcher 會在你剛啟動背景渲染時誤以為你的 turn 已結束。
- 以 `[main]` 開頭的訊息是 main 轉達的；其中標「以下為使用者原話」的段落才是使用者裁決，其餘是 main 的判讀。沒有前綴的訊息是使用者本人打的。
- 任務全部做完並通過視覺自檢與 `verify_promo.py` 後再回報一次。回報要含：
  1. 你的核心視覺概念與關鍵設計決策（維多利亞暗黑黃銅配色、70% 大留白比例、字體層級、運鏡 Carry 銜接）
  2. `stills.png` 逐格視覺檢查結果與檔案路徑
  3. `verify_promo.py` 完整 8 項指標輸出（必須是 `VERDICT: PASS`）
  4. 最終影片 `/Users/linhancheng/Desktop/projects/kiroween-signal-box/dist/signal-box-demo.mp4` 與 4 張截圖（`dist/screenshots/01..04*.png`）的 `ffprobe` / `ls -lh` 實測數據
  5. 沒做的部分（若無則明寫無）

## 邊界

- 不 push、不開 PR、不 rebase、不 amend。
- **嚴禁跑 `pkill -f chrom`、`killall Google Chrome` 等廣域殺程序指令**（會殺死使用者正在使用的日常 Chrome 與 LCU 連線）；只准清自己啟動的 PID。
- 驗證收據放 `/Users/linhancheng/Desktop/projects/kiroween-signal-box/.scratch/signal-box/dispatch-opus-film/receipts/`，影片合成資產放 `/Users/linhancheng/Desktop/projects/onetake-trial/films/kiroween-signal-box-opus/`。
- 執行 `onetake` Python 腳本時使用：
  `uv run --with playwright --with numpy --with pillow --with scipy --with fonttools --with brotli --with matplotlib python3`

## 脈絡

- 產品規格與實作檔案：
  - `/Users/linhancheng/Desktop/projects/kiroween-signal-box/.scratch/signal-box/spec.md`
  - `/Users/linhancheng/Desktop/projects/kiroween-signal-box/README.md`
  - `/Users/linhancheng/Desktop/projects/kiroween-signal-box/src/lib/interlocking.ts`
  - `/Users/linhancheng/Desktop/projects/kiroween-signal-box/src/lib/pbt-exorcist.ts`
  - `/Users/linhancheng/Desktop/projects/kiroween-signal-box/src/app/page.tsx`
- 前一隻 Opus 5.5 Max worker 剛做完、大獲好評的滿分範本（可直接參考其架構、2.35:1 構圖、字體與混音技巧，但配色與視覺母題必須全新打造為 1856 維多利亞機械聯鎖黃銅號誌樓）：
  - `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live-opus/comp.html`
  - `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live-opus/score.py`
  - `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live-opus/stills.png`
- 以下為使用者原話（逐字）：
  - `行啊不然就1`（選定題目 1：Signal Box / LeverFrame — 19 世紀鐵路機械聯鎖號誌樓 × 多 Agent 資源互斥管制塔，Resurrection 賽道）
  - `允許這次派工`
  - `可以的話派team-p流量`
- main 的判讀（不是裁決）：
  1. **動手前必讀 `onetake` 規範與上一支滿分範本**：
     - 先讀 `/Users/linhancheng/.claude/skills/onetake/SKILL.md` 與 `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live-opus/comp.html`。
  2. **45 秒故事線建議（Mechanical Tappet Carry — 每一拍由同一根機械鎖桿與黃銅拉桿連動推演）**：
     - **Beat 1 (0.0s–6.5s · The 1856 Resurrection Hook)**：深邃煤黑與暖黃銅光澤大留白背景上，一根 1856 年 Saxby & Farmer 黃銅拉桿（`LEVER #3 · FACING POINT LOCK`）伴隨沉穩的金屬栓鎖聲（`LEVER_LATCH`）拉下，底部垂直的鋼製 Tappet 鎖桿滑入水平鎖槽，帶出標題「`1856: Mechanical Mutual Exclusion` → `2026: Resurrected for Parallel AI Agents`」。
     - **Beat 2 (6.5s–16.5s · Standard Interlocking Blocks Collision)**：鏡頭順著 Tappet 鎖槽滑向局部精簡的號誌樓控制卡：`Builder` Agent 列車獲准通過 `NORTH_TO_BRIDGE`（`Lever #3 REVERSE → Lever #1 REVERSE`，綠燈亮起）；此時 `Migrator` Agent 試圖強拉 `South Branch Signal #4`，水平 Tappet 鎖桿物理卡死垂直槽（發出沉重金屬撞擊聲 `INTERLOCK_CLANK`），浮現 `BLOCKED BY EARS-ILK-01`。
     - **Beat 3 (16.5s–29.5s · The Cursed Rule Table & `fast-check` PBT Exorcist)**：切換至故障注入的 `CURSED_MISSING_CROSSOVER_LOCK`（漏寫交叉互斥鎖），啟動 `fast-check` **Stepwise PBT Exorcist**——畫面以極簡高速計數器掃過 `586 stepwise P1/P2 assertions in 1ms`，抓出一條 11 步隨機碰撞序列，並在畫面上像機械齒輪退位般將 **11 步現場壓縮（Shrinking 3.67×）成 3 步最小反例：`PULL #3 → PULL #1 → PULL #4`**！
     - **Beat 4 (29.5s–38.5s · Deterministic Replay & Exorcism)**：3 步最小反例在軌道圖上逐步重播，第 3 步 `junction-throat` 與 `schema-bridge` 亮起刺眼緋紅碰撞警報；隨即把缺失的 `EARS-ILK-01` 鎖片重新鍛入 `.kiro/specs/signal-box/requirements.md` 與 Tappet 鎖床，再次執行 PBT Exorcist，80 輪全數綠燈通過（`PbtTrialReceipt` 6 項指標全綠）。
     - **Beat 5 (38.5s–45.0s · Quiet Hold & End Lockup)**：留出至少 2.5 秒的靜止留白（Dead-still hold，滿足 `verify_promo.py` 的 stillness 與 quiet 門檻），收斂為黃銅銘牌鎖定字標：**`SIGNAL BOX // LEVERFRAME`** · `Resurrected with Kiro Specs, Hooks & Stepwise PBT`。
  3. **技術檢核要點**：
     - 用 Kokoro TTS（`/Users/linhancheng/.claude/skills/onetake/scripts/vo_tools.py`）生成地道英文旁白，並在畫面底部放不遮擋主視覺的中英雙語字幕。
     - 渲染時使用 `--gap 6 --samples-max 48` 確保快速運鏡具備平順 180° 快門動態模糊，通過 `verify_promo.py` 全部 8 項檢查（`rhythm`, `stillness`, `burst`, `audio_levels`, `audio_quiet`, `continuity`, `curves`, `framing`）。
     - 從 `comp.html` 擷取 4 張最具代表性的 1920×1080 高解析度畫面存到 `/Users/linhancheng/Desktop/projects/kiroween-signal-box/dist/screenshots/`（`01-lever-frame-interlock.png`, `02-ears-tappet-block.png`, `03-pbt-exorcist-shrinking.png`, `04-trial-receipt-verified.png`），方便主視窗直接上傳 Devpost。
