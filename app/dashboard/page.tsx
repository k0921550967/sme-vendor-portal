import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAuthRecord, getCourseData } from "@/lib/google-sheets";
import { CourseRecord } from "@/types";
import Header from "@/components/Header";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/");
  }

  const email = session.user.email;

  // 查授權名單
  const authRecord = await getAuthRecord(email).catch(() => null);
  if (!authRecord) {
    redirect("/unauthorized");
  }

  // 取得所有課程資料
  const allCourses = await getCourseData().catch(() => [] as CourseRecord[]);

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

  // viewer 隱藏 student_count
  const showStudentCount = authRecord.role !== "viewer";

  const userInfo = {
    email,
    vendor_name: authRecord.vendor_name,
    role: authRecord.role,
    allowed_categories: authRecord.allowed_categories,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header user={userInfo} />
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <DashboardClient
          courses={filteredCourses}
          showStudentCount={showStudentCount}
        />
      </main>
    </div>
  );
}
