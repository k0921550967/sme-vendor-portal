import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getApiUrl, updateCourseData, getAuthRecord } from "@/lib/google-sheets";
import { ApiCourseResponse, CourseRecord } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runSync(): Promise<{ synced: number; error?: string }> {
  const apiUrl = await getApiUrl();
  if (!apiUrl) {
    return { synced: 0, error: "API_URL not configured in 系統設定 sheet" };
  }

  const res = await fetch(apiUrl, { cache: "no-store" });
  if (!res.ok) {
    return { synced: 0, error: `External API returned ${res.status}` };
  }

  const data: ApiCourseResponse = await res.json();

  // 將分組格式攤平，加入 category 欄位
  const courses: CourseRecord[] = [];
  for (const [category, records] of Object.entries(data)) {
    for (const record of records) {
      courses.push({
        ...record,
        category,
      });
    }
  }

  await updateCourseData(courses);
  return { synced: courses.length };
}

// Vercel Cron Job 會帶 Authorization: Bearer <CRON_SECRET>
// 管理員也可手動呼叫（帶 session）
export async function GET(req: NextRequest) {
  // 方法 1：Vercel Cron Secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    try {
      const result = await runSync();
      return NextResponse.json({
        ok: true,
        message: `同步完成，共 ${result.synced} 筆課程`,
        ...result,
        triggered_by: "cron",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Cron sync error:", error);
      return NextResponse.json(
        { ok: false, error: String(error) },
        { status: 500 }
      );
    }
  }

  // 方法 2：已登入的 admin 手動觸發
  const session = await auth();
  if (session?.user?.email) {
    const authRecord = await getAuthRecord(session.user.email).catch(() => null);
    if (authRecord?.role === "admin") {
      try {
        const result = await runSync();
        return NextResponse.json({
          ok: true,
          message: `同步完成，共 ${result.synced} 筆課程`,
          ...result,
          triggered_by: session.user.email,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Manual sync error:", error);
        return NextResponse.json(
          { ok: false, error: String(error) },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
