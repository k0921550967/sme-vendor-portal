import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthRecord, getCourseData } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email;
    const authRecord = await getAuthRecord(email);

    if (!authRecord) {
      return NextResponse.json(
        { error: "Forbidden: Account not in authorized list or inactive" },
        { status: 403 }
      );
    }

    const allCourses = await getCourseData();

    function matchFilter(
      courseValues: string | string[],
      allowed: string[] | "ALL"
    ): boolean {
      if (allowed === "ALL") return true;
      const values = Array.isArray(courseValues) ? courseValues : [courseValues];
      return values.some((v) => allowed.includes(v));
    }

    // 根據所有授權維度過濾課程（欄位間 AND，欄位內多值 OR）
    const filteredCourses = allCourses.filter(
      (c) =>
        matchFilter(c.category, authRecord.allowed_categories) &&
        matchFilter(c.school_name, authRecord.allowed_schools) &&
        matchFilter(c.teachers, authRecord.allowed_teachers)
    );

    // viewer 移除 student_count
    const showStudentCount = authRecord.role !== "viewer";
    const courses = showStudentCount
      ? filteredCourses
      : filteredCourses.map(({ student_count: _sc, ...rest }) => rest);

    return NextResponse.json({
      user: {
        email,
        vendor_name: authRecord.vendor_name,
        role: authRecord.role,
        allowed_categories: authRecord.allowed_categories,
      },
      courses,
      show_student_count: showStudentCount,
    });
  } catch (error) {
    console.error("dashboard-data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
