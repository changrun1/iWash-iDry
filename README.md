# iWash-iDry 校園洗衣／烘衣預約系統

這份文件整合了專案的開發、部署與設定流程，協助你快速啟動前端、後端、硬體模擬器與 HTTPS 隧道服務。

## 專案架構

```
.
├── app/                     # Vue 3 + Element Plus 前端
│   ├── Dockerfile           # 前端建置用 Dockerfile (Nginx)
│   ├── docker/nginx.conf    # 反向代理設定，將 /api 透過容器網路指向後端
│   └── src/                 # 前端程式碼
├── hardware/
│   └── simulation/          # Python 硬體控制器模擬器
│       └── Dockerfile       # 模擬器容器設定，預設啟動所有宿舍
├── server/                  # Node.js (Express) 後端 API + SQLite
│   ├── Dockerfile
│   ├── app.js               # 入口程式，整合 CORS、排程與路由
│   └── data/washing_machine.db
├── docker-compose.yml       # 一鍵啟動前端、後端、模擬器與隧道（可選）
├── .env.example             # 參考環境變數設定
└── README.md                # 本文件
```

## 前置需求

- [Docker](https://docs.docker.com/get-docker/)、Docker Compose Plugin
- Node.js 18+ 與 npm（僅在本機開發模式使用）
- Python 3.10+（僅在本機直接執行模擬器時使用）

## 環境變數設定

1. 複製範本並依需求調整。
	```bash
	cp .env.example .env
	```
2. 重要參數說明：
	- `JWT_SECRET`：後端簽發 JWT 的密鑰（務必更換）。
	- `HARDWARE_API_KEY`：硬體模擬器/控制器上報狀態時使用的 API Key。
	- `CLIENT_BASE_URL`：提供給 LINE Bot 訊息中的前端 URL，開發模式預設 `http://localhost:8080`。
	- `ALLOWED_ORIGINS`、`ALLOWED_ORIGIN_PATTERNS`：後端允許的 CORS 來源（逗號分隔）。
	- `LINE_*`：LINE Bot 的 Channel/Access Token 等設定，若未使用可保持空白。
	- `VITE_API_BASE_URL`：前端打 API 時的 baseURL（Docker 版預設 `/api`）。
	- `VITE_LINE_BOT_ID`：前端顯示的 LINE Bot ID（若未設定，前端僅顯示「未設定」）。
	- `SIMULATOR_SERVER_URL`：硬體模擬器回報的後端 API URL，Docker 預設 `http://backend:3000`。
	- `TUNNEL_SUBDOMAIN`：localtunnel 指定子網域（選填，需要 `docker compose --profile tunnel ...`）。
	- `BACKEND_PORT` / `FRONTEND_PORT`：對外映射的埠號。

## 使用 Docker 快速啟動

1. 建置並啟動主要服務（前端、後端、模擬器）。
	```bash
	docker compose up --build
	```
2. （可選）同時啟動 HTTPS 隧道服務。
	```bash
	docker compose --profile tunnel up --build
	```
3. 服務啟動後：
	- 前端（Nginx）：<http://localhost:8080>
	- 後端 API：<http://localhost:3000>
	- 健康檢查：<http://localhost:3000/api/health>
	- 隧道服務：請查看 `iwash-tunnel` 容器日志以取得公開網址。
4. 停止服務：
	```bash
	docker compose down
	```

### Docker 注意事項
- 後端使用 SQLite，`./server/data` 會以 bind mount 方式保存資料。
- 模擬器容器預設以 `start_all_dormitories.py --auto` 啟動全部宿舍，可透過環境變數覆寫。
- localtunnel 只在啟用 `tunnel` profile 時下載並啟動。

## 本機開發模式（不使用 Docker）

1. 安裝相依套件：
	```bash
	npm install
	npm run install:all
	```
2. 啟動前後端開發伺服器：
	```bash
	npm run dev
	```
	- 前端：<http://localhost:5173>
	- 後端：<http://localhost:3000>
3. 硬體模擬器（可選）：
	```bash
	cd hardware/simulation
	python start_all_dormitories.py --auto
	```
	或使用互動式腳本 `python start_all_dormitories.py` 自行選擇伺服器與宿舍。

## 服務說明

### 前端（`app/`）
- 使用 Vite、Vue 3、Pinia 與 Element Plus。
- `src/utils/api.js` 會讀取 `VITE_API_BASE_URL`，預設指向 `/api`。
- `vite.config.js` 的 dev proxy 透過 `VITE_PROXY_TARGET`（環境變數）控制。
- `LineBinding.vue` 中的 LINE Bot ID 會優先使用後端回傳資訊，再 fallback 到 `VITE_LINE_BOT_ID`。

### 後端（`server/`）
- Express + SQLite。
- 允許的 CORS 來源由 `ALLOWED_ORIGINS`（逗號分隔）與 `ALLOWED_ORIGIN_PATTERNS`（支援 `*` 通配符）控制。
- LINE Bot 相關網址（預約、機器狀態、綁定頁）透過下列環境變數覆寫：
  - `CLIENT_BASE_URL`
  - `LINE_HELP_PAGE_URL`
  - `LINE_BOOKING_PAGE_URL`
  - `LINE_MACHINES_PAGE_URL`
- `start-with-tunnel.js` 與 `npm run tunnel` 支援透過 `TUNNEL_SUBDOMAIN` 指定子網域，未設定時改用隨機網域。

### 硬體模擬器（`hardware/simulation/`）
- 預設讀取 `SIMULATOR_SERVER_URL`（預設 `http://localhost:3000` 或 Docker 內部 `http://backend:3000`）。
- API Key 可以透過 `HARDWARE_API_KEY` 覆寫，需與後端設定一致。
- `start_all_dormitories.py` 支援互動或 `--auto` 模式，並可透過 `SIMULATOR_CLIENT_URL` 指定前端網址（顯示於提示中）。

### 隧道服務（localtunnel）
- Docker 版在 `tunnel` profile 中以 `node:20-alpine` 立即執行 `npx localtunnel`。
- 若需固定子網域，請在 `.env` 中設定 `TUNNEL_SUBDOMAIN`。
- 啟動後請至 `iwash-tunnel` 容器日誌取得公開網址，並手動填入 `.env` 的 `TUNNEL_URL` 供後端紀錄與顯示。

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run docker:build` | 建置所有 Docker 映像檔 |
| `npm run docker:up` | 以 Docker 啟動主要服務 |
| `npm run docker:down` | 停止 Docker 服務 |
| `npm run docker:logs` | 追蹤所有容器日誌 |
| `npm run dev` | 同時啟動本地前後端開發伺服器 |
| `python hardware/simulation/start_all_dormitories.py --auto` | 以自動模式啟動模擬器 |

## 部署建議

1. 將 `.env` 中的密鑰改為正式值，並確保 `.env` 不被提交。
2. 於主機上執行 `docker compose up --build -d` 部署服務。
3. 若需對外提供 HTTPS，可啟用 `tunnel` profile 或自行配置 Nginx/Reverse Proxy。
4. 定期備份 `server/data/washing_machine.db`。

## 安全注意事項

- `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`JWT_SECRET` 等敏感資訊僅可存放於 `.env` 或安全的秘密管理系統。
- 任何對外開放時，請務必限縮 `ALLOWED_ORIGINS` 與 `ALLOWED_ORIGIN_PATTERNS`。
- 若未使用 LINE Bot，可維持相關環境變數為空值，前端會顯示「未設定」。

## 版本控管與上傳建議

1. 確認已刪除多餘檔案（暫存、測試 HTML、Windows 批次檔、個人環境設定等）。
2. 建議初始化 Git 儲存庫並推送到 GitHub：
	```bash
	git init
	git add .
	git commit -m "Initial cleanup and Docker setup"
	git remote add origin https://github.com/changrun1/iWash-iDry.git
	git push -u origin main
	```
3. 推送前再三確認 `.env` 等敏感檔案不在追蹤範圍。

---

若需擴充功能（例如正式硬體控制器或更進階的隧道服務），建議以現行 Docker Compose 為基礎新增服務或設定，確保整體部署流程仍可一鍵啟動。祝開發順利！