import { google } from "googleapis";
import bcrypt from "bcryptjs";
import { AuthRecord, CourseRecord } from "@/types";

function getGoogleAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const credentials = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  const auth = getGoogleAuth();
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

function parseArrayField(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      // JSON 陣列中每個元素可能還含有頓號分隔的多個名稱
      return parsed.flatMap((s: string) =>
        String(s).split(/[,、]/).map((t) => t.trim()).filter(Boolean)
      );
    }
    return String(parsed).split(/[,、]/).map((s) => s.trim()).filter(Boolean);
  } catch {
    // 非 JSON 格式，直接用逗號或頓號分割
    return value.split(/[,、]/).map((s) => s.trim()).filter(Boolean);
  }
}

export async function getCourseData(): Promise<CourseRecord[]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "課程資料!A2:K",
  });

  const rows = response.data.values || [];
  return rows
    .filter((row) => row[0]) // 過濾空行
    .map((row) => ({
      id: row[0] || "",
      class_id: row[1] || "",
      class_name: row[2] || "",
      school_name: parseArrayField(row[3]),
      schedule_address: row[4] || "",
      start_hour: row[5] || "",
      duration: Number(row[6]) || 0,
      teachers: parseArrayField(row[7]),
      student_count: Number(row[8]) || 0,
      category: row[9] || "",
      updated_at: row[10] || "",
    }));
}

function parseFilter(value: string | undefined): string[] | "ALL" {
  const v = value?.trim() || "";
  if (!v || v === "ALL") return "ALL";
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function getAuthRecord(email: string): Promise<AuthRecord | null> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "授權名單!A2:G",
  });

  const rows = response.data.values || [];
  const row = rows.find(
    (r) =>
      r[0]?.toLowerCase() === email.toLowerCase() &&
      r[4]?.trim() === "啟用"
  );

  if (!row) return null;

  return {
    gmail: row[0],
    vendor_name: row[1] || "",
    role: (row[2] || "viewer") as AuthRecord["role"],
    allowed_categories: parseFilter(row[3]),
    allowed_schools: parseFilter(row[5]),
    allowed_teachers: parseFilter(row[6]),
    status: row[4] || "",
  };
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ email: string } | null> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "授權名單!A2:H",
  });

  const rows = response.data.values || [];
  const row = rows.find(
    (r) =>
      r[0]?.toLowerCase() === email.toLowerCase() &&
      r[4]?.trim() === "啟用"
  );

  if (!row) return null;

  const hash = row[7]?.trim() || "";
  if (!hash) return null;

  const isValid = await bcrypt.compare(password, hash);
  return isValid ? { email: row[0] } : null;
}

export interface LoginLogEntry {
  gmail: string;
  vendor_name: string;
  role: string;
  result: "登入成功" | "拒絕存取";
  reason: string;
  ip?: string;
  user_agent?: string;
}

/** 從 User-Agent 字串提取可讀的裝置/瀏覽器摘要 */
function parseUserAgent(ua: string): string {
  if (!ua) return "未知";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" :
    "其他瀏覽器";

  const os =
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Windows NT/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" :
    "其他系統";

  return `${browser} / ${os}`;
}

export async function appendLoginLog(entry: LoginLogEntry): Promise<void> {
  try {
    const sheets = getSheetsClient();

    // 24 小時制時間
    const now = new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Taipei",
    }).format(new Date());

    const row = [
      now,
      entry.gmail,
      entry.vendor_name,
      entry.role,
      entry.result,
      entry.reason,
      entry.ip ?? "-",
      entry.user_agent ? parseUserAgent(entry.user_agent) : "-",
    ];

    // 取得「登入紀錄」的 sheetId，才能用 insertDimension 插入首列
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: "sheets(properties(sheetId,title))",
    });
    const sheetId = meta.data.sheets?.find(
      (s) => s.properties?.title === "登入紀錄"
    )?.properties?.sheetId;

    if (sheetId == null) throw new Error("找不到「登入紀錄」Sheet");

    // 在標題列之後（index 1）插入一列空白列，資料往下推
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1, // 0-based，= 第 2 列（標題下方）
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        }],
      },
    });

    // 寫入資料到剛插入的空白列
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "登入紀錄!A2:H2",
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } catch (err) {
    // 寫入失敗不影響主流程
    console.error("appendLoginLog error:", err);
  }
}

export async function getApiUrl(): Promise<string> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "系統設定!A1:B1",
  });

  const rows = response.data.values || [];
  // A1 = 標籤 "API_URL", B1 = 實際網址
  return rows[0]?.[1] || "";
}

export async function updateCourseData(courses: CourseRecord[]): Promise<void> {
  const sheets = getSheetsClient();

  // 清除舊資料
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: "課程資料!A2:K",
  });

  if (courses.length === 0) return;

  const now = new Date().toISOString();
  const values = courses.map((c) => [
    c.id,
    c.class_id,
    c.class_name,
    JSON.stringify(c.school_name),
    c.schedule_address,
    c.start_hour,
    c.duration,
    JSON.stringify(c.teachers),
    c.student_count,
    c.category,
    now,
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "課程資料!A2",
    valueInputOption: "RAW",
    requestBody: { values },
  });
}
