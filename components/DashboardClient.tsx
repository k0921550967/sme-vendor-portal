"use client";

import { useState, useMemo } from "react";
import { CourseRecord } from "@/types";
import StatsCards from "./StatsCards";

function formatDateTime(iso: string): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Taipei",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function DashboardClient({
  courses,
  showStudentCount,
}: {
  courses: CourseRecord[];
  showStudentCount: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return courses;
    const q = query.toLowerCase();
    return courses.filter(
      (c) =>
        c.class_name.toLowerCase().includes(q) ||
        c.school_name.some((s) => s.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q) ||
        c.schedule_address.toLowerCase().includes(q)
    );
  }, [courses, query]);

  return (
    <>
      {/* Stats */}
      <StatsCards courses={courses} />

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋班級名稱、機構、類別、地址..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
          />
        </div>
        {query && (
          <span className="text-sm text-gray-500">
            找到 <strong>{filtered.length}</strong> 筆
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-700 text-white">
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  班級名稱
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  承辦機構
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  地址
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  開課時間
                </th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">
                  時數
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  教師
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  類別
                </th>
                {showStudentCount && (
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">
                    學生人數
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={showStudentCount ? 8 : 7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {query ? "找不到符合的課程" : "目前沒有課程資料"}
                  </td>
                </tr>
              ) : (
                filtered.map((course, idx) => (
                  <tr
                    key={course.id || idx}
                    className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {course.class_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      {course.school_name.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {course.school_name.map((s, i) => (
                            <span key={i} className="text-xs">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <span className="text-xs">{course.schedule_address || "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {formatDateTime(course.start_hour)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {course.duration || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {course.teachers.length > 0
                        ? course.teachers.join("、")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-brand-100 text-brand-700 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                        {course.category || "-"}
                      </span>
                    </td>
                    {showStudentCount && (
                      <td className="px-4 py-3 text-center text-gray-600 font-medium">
                        {course.student_count ?? "-"}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
            共 {filtered.length} 筆{query && `（篩選自 ${courses.length} 筆）`}
          </div>
        )}
      </div>
    </>
  );
}
