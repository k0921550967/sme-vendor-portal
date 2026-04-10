import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthRecord, getCourseData } from "@/lib/google-sheets";
import { CourseRecord } from "@/types";

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

    // 根據角色過濾
    let filteredCourses: CourseRecord[];
    if (authRecord.allowed_categories === "ALL") {
      filteredCourses = allCourses;
    } else {
      const allowed = authRecord.allowed_categories as string[];
      filteredCourses = allCourses.filter((c) => allowed.includes(c.category));
    }

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
