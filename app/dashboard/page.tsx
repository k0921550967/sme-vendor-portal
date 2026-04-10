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

  // 根據角色過濾課程
  let filteredCourses: CourseRecord[];
  if (authRecord.role === "admin" || authRecord.allowed_categories === "ALL") {
    filteredCourses = allCourses;
  } else {
    const allowed = authRecord.allowed_categories as string[];
    filteredCourses = allCourses.filter((c) => allowed.includes(c.category));
  }

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
