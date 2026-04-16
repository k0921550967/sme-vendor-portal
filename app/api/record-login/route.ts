import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { getAuthRecord, appendLoginLog } from "@/lib/google-sheets";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email || !session.loginTime) {
    return NextResponse.json({ ok: false, reason: "no session" });
  }

  const loginTime = String(session.loginTime);

  // 若本次瀏覽器 session 已記錄過同一個 loginTime，略過（避免重新整理重複寫）
  const recorded = req.cookies.get("login_recorded_at")?.value;
  if (recorded === loginTime) {
    return NextResponse.json({ ok: false, reason: "already recorded" });
  }

  const email = session.user.email;
  const authRecord = await getAuthRecord(email).catch(() => null);
  if (!authRecord) {
    return NextResponse.json({ ok: false, reason: "no auth record" });
  }

  const reqHeaders = await headers();
  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    reqHeaders.get("x-real-ip") ??
    "-";
  const userAgent = reqHeaders.get("user-agent") ?? undefined;

  await appendLoginLog({
    gmail: email,
    vendor_name: authRecord.vendor_name,
    role: authRecord.role,
    result: "登入成功",
    reason: "正常",
    ip,
    user_agent: userAgent,
  });

  const res = NextResponse.json({ ok: true });

  // Session cookie（不設 maxAge/expires）→ 關閉瀏覽器即失效
  // 下次重開瀏覽器自動登入時，此 cookie 不存在 → 重新記錄
  res.cookies.set("login_recorded_at", loginTime, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return res;
}
