# SME 廠商入口 (sme-vendor-portal)

中小企業廠商課程查詢入口網站，基於 Next.js 15 App Router + NextAuth.js v5 + Google Sheets API。

---

## 功能概覽

- Google OAuth 登入，只有授權名單內的帳號才能存取
- 三種角色：**admin**（全部課程）、**manager**（指定類別 + 可看人數）、**viewer**（指定類別，隱藏人數）
- 統計卡片、即時搜尋、課程資料表格
- Vercel Cron Job 每天 08:00（台灣時間）自動同步課程資料
- Admin 可手動呼叫 `/api/cron/sync` 觸發同步

---

## 技術棧

| 項目 | 版本 |
|------|------|
| Next.js | 15 (App Router) |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 3 |
| NextAuth.js | v5 (beta) |
| Google Sheets API | googleapis v144 |

---

## Google Sheets 結構

同一份試算表（`SPREADSHEET_ID`），共三個工作表：

### 工作表1：`課程資料`
| 欄 | 說明 |
|----|------|
| A | id |
| B | class_id |
| C | class_name |
| D | school_name（JSON 陣列字串） |
| E | schedule_address |
| F | start_hour（ISO 8601） |
| G | duration |
| H | teachers（JSON 陣列字串） |
| I | student_count |
| J | category |
| K | 更新時間 |

### 工作表2：`授權名單`
| 欄 | 說明 |
|----|------|
| A | gmail帳號 |
| B | 廠商名稱 |
| C | 角色（admin / manager / viewer） |
| D | 可看category（逗號分隔，admin 填 ALL） |
| E | 狀態（填「啟用」才有效） |

### 工作表3：`系統設定`
| 儲存格 | 說明 |
|--------|------|
| A1 | 標籤：`API_URL` |
| B1 | 實際 API 網址（課程資料來源） |

---

## 環境變數

複製 `.env.local.example` 為 `.env.local` 並填入：

```bash
cp .env.local.example .env.local
```

| 變數 | 說明 |
|------|------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console OAuth Client Secret |
| `NEXTAUTH_SECRET` | 任意隨機字串（可用 `openssl rand -base64 32` 產生） |
| `NEXTAUTH_URL` | 部署後的完整 URL（本地開發用 `http://localhost:3000`） |
| `SPREADSHEET_ID` | Google Sheets 網址中的 ID 部分 |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | service-account.json 內容轉成單行 JSON |
| `CRON_SECRET` | 任意隨機字串，用於保護 Cron API |

---

## 本地開發

```bash
# 安裝依賴
npm install

# 複製並填寫環境變數
cp .env.local.example .env.local

# 啟動開發伺服器
npm run dev
```

---

## 部署步驟

### 1. Google Cloud Console 設定

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選擇專案
3. 啟用 **Google Sheets API**
4. 建立 **OAuth 2.0 Client ID**（Web Application）
   - Authorized JavaScript origins: `https://your-domain.vercel.app`
   - Authorized redirect URIs: `https://your-domain.vercel.app/api/auth/callback/google`
5. 建立 **Service Account**，下載 JSON 金鑰（`service-account.json`）
6. 將 Service Account Email 加入 Google Sheets 的共用清單（編輯者）

### 2. 設定 GOOGLE_SERVICE_ACCOUNT_KEY

將 `service-account.json` 壓成單行：

```bash
# Linux / macOS
cat service-account.json | tr -d '\n'

# Windows PowerShell
(Get-Content service-account.json -Raw) -replace '\r?\n', '' | Set-Clipboard
```

複製輸出，貼到 `GOOGLE_SERVICE_ACCOUNT_KEY` 環境變數。

### 3. 部署至 Vercel

1. 推送程式碼到 GitHub
2. 在 Vercel 匯入專案
3. 在 Vercel 專案設定 → Environment Variables，填入所有環境變數
4. `NEXTAUTH_URL` 填入實際部署的網址（如 `https://your-app.vercel.app`）
5. 部署完成後，Vercel 會依 `vercel.json` 設定每天 UTC 00:00（台灣時間 08:00）執行同步

### 4. 手動觸發同步（Admin）

Admin 帳號登入後，可直接在瀏覽器呼叫：

```
GET /api/cron/sync
```

或透過 curl：

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://your-domain.vercel.app/api/cron/sync
```

---

## 授權名單範例

| gmail帳號 | 廠商名稱 | 角色 | 可看category | 狀態 |
|-----------|----------|------|--------------|------|
| admin@example.com | 管理公司 | admin | ALL | 啟用 |
| manager@vendor.com | 製造廠商 | manager | 製造業初階,製造業進階 | 啟用 |
| viewer@partner.com | 合作夥伴 | viewer | 服務業初階 | 啟用 |
| old@company.com | 舊廠商 | viewer | 服務業初階 | 停用 |

---

## 目錄結構

```
sme-vendor-portal/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # 首頁（登入頁）
│   ├── globals.css
│   ├── dashboard/
│   │   └── page.tsx            # 課程儀表板
│   ├── unauthorized/
│   │   └── page.tsx            # 無存取權限頁面
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handler
│       ├── dashboard-data/     # 課程資料 API
│       └── cron/sync/          # 同步 Cron API
├── components/
│   ├── SessionProvider.tsx
│   ├── Header.tsx
│   ├── StatsCards.tsx
│   └── DashboardClient.tsx     # 搜尋 + 表格（Client Component）
├── lib/
│   └── google-sheets.ts        # Google Sheets API 封裝
├── types/
│   └── index.ts
├── auth.ts                     # NextAuth 設定
├── middleware.ts               # 路由保護
├── vercel.json                 # Cron Job 設定
└── .env.local.example
```
