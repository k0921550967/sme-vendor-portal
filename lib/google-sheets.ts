import { google } from "googleapis";
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
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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

export async function getAuthRecord(email: string): Promise<AuthRecord | null> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "授權名單!A2:E",
  });

  const rows = response.data.values || [];
  const row = rows.find(
    (r) =>
      r[0]?.toLowerCase() === email.toLowerCase() &&
      r[4]?.trim() === "啟用"
  );

  if (!row) return null;

  const categoryField = row[3]?.trim() || "";
  const allowed_categories =
    categoryField === "ALL"
      ? ("ALL" as const)
      : categoryField
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);

  return {
    gmail: row[0],
    vendor_name: row[1] || "",
    role: (row[2] || "viewer") as AuthRecord["role"],
    allowed_categories,
    status: row[4] || "",
  };
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
