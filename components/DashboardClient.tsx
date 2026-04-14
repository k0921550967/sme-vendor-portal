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

function formatDateRange(iso: string, durationHours: number): { date: string; timeRange: string } {
  if (!iso) return { date: "-", timeRange: "" };
  try {
    const start = new Date(iso);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    const dateFmt = new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Taipei",
    });
    const timeFmt = new Intl.DateTimeFormat("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Taipei",
    });

    const date = dateFmt.format(start).replace(/\//g, "/");
    const startTime = timeFmt.format(start);
    const endTime = timeFmt.format(end);

    return { date, timeRange: `${startTime} - ${endTime}` };
  } catch {
    return { date: iso, timeRange: "" };
  }
}

// ──────────────────────────────────────────────
// 欄位順序設定：調整陣列順序即可改變表格欄位排列
// student_count 欄會依使用者角色自動顯示/隱藏
// ──────────────────────────────────────────────
type ColumnKey =
  | "class_name"
  | "school_name"
  | "schedule_address"
  | "start_hour"
  | "duration"
  | "teachers"
  | "category"
  | "student_count";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align: "left" | "center";
}

const COLUMNS: ColumnDef[] = [
  { key: "class_name",        label: "班級名稱",   align: "left" },
  { key: "student_count",     label: "學生人數",   align: "center" },
  { key: "category",          label: "類別",       align: "center" },
  { key: "start_hour",        label: "開課時間",   align: "left" },
  { key: "duration",          label: "時數(小時)", align: "center" },
  { key: "school_name",       label: "開課單位",   align: "left" },
  { key: "schedule_address",  label: "地址",       align: "left" },
  { key: "teachers",          label: "教師",       align: "left" },
];

function renderCell(
  key: ColumnKey,
  course: import("@/types").CourseRecord,
  categoryColorMap: Record<string, string>,
  mainUpdatedAt: string | null
): React.ReactNode {
  switch (key) {
    case "class_name":
      return <span className="font-medium text-gray-900 whitespace-nowrap">{course.class_name || "-"}</span>;
    case "school_name":
      return course.school_name.length > 0 ? (
        <div className="flex flex-col gap-0.5 max-w-xs">
          {course.school_name.map((s, i) => <span key={i} className="text-xs">{s}</span>)}
        </div>
      ) : "-";
    case "schedule_address":
      return <span className="text-xs max-w-xs">{course.schedule_address || "-"}</span>;
    case "start_hour": {
      const { date, timeRange } = formatDateRange(course.start_hour, course.duration);
      return (
        <div className="flex flex-col gap-0.5 whitespace-nowrap text-xs">
          <span>{date}</span>
          {timeRange && <span className="text-gray-600">{timeRange}</span>}
        </div>
      );
    }
    case "duration":
      return course.duration || "-";
    case "teachers":
      return course.teachers.length > 0 ? course.teachers.join("、") : "-";
    case "category":
      return (
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
          categoryColorMap[course.category] ?? "bg-gray-100 border border-gray-200 text-gray-600"
        }`}>
          {course.category || "-"}
        </span>
      );
    case "student_count":
      return (
        <>
          {course.student_count ?? "-"}
          {course.updated_at && course.updated_at !== mainUpdatedAt && (
            <div className="text-gray-400 font-normal mt-0.5" style={{ fontSize: "10px" }}>
              更新：{formatDateTime(course.updated_at)}
            </div>
          )}
        </>
      );
  }
}

const CATEGORY_COLORS = [
  "bg-blue-50 border border-blue-200 text-blue-700",
  "bg-green-50 border border-green-200 text-green-700",
  "bg-yellow-50 border border-yellow-200 text-yellow-700",
  "bg-purple-50 border border-purple-200 text-purple-700",
  "bg-pink-50 border border-pink-200 text-pink-700",
  "bg-indigo-50 border border-indigo-200 text-indigo-700",
  "bg-orange-50 border border-orange-200 text-orange-700",
];

export default function DashboardClient({
  courses,
  showStudentCount,
}: {
  courses: CourseRecord[];
  showStudentCount: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let idx = 0;
    courses.forEach((c) => {
      if (c.category && !(c.category in map)) {
        map[c.category] = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
        idx++;
      }
    });
    return map;
  }, [courses]);

  const mainUpdatedAt = useMemo(() => {
    const freq: Record<string, number> = {};
    courses.forEach((c) => {
      if (c.updated_at) freq[c.updated_at] = (freq[c.updated_at] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [courses]);

  const filtered = useMemo(() => {
    let result = courses;
    if (selectedCategory) {
      result = result.filter((c) => c.category === selectedCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (c) =>
          c.class_name.toLowerCase().includes(q) ||
          c.school_name.some((s) => s.toLowerCase().includes(q)) ||
          c.category.toLowerCase().includes(q) ||
          c.schedule_address.toLowerCase().includes(q)
      );
    }
    return result;
  }, [courses, query, selectedCategory]);

  return (
    <>
      {/* Stats */}
      <StatsCards
        courses={courses}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Search + 更新時間同一列 */}
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
            placeholder="搜尋班級名稱、開課單位、類別、地址..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
          />
        </div>
        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-1 text-xs bg-brand-100 text-brand-700 border border-brand-200 px-2 py-1 rounded-full hover:bg-brand-200 transition-colors"
          >
            {selectedCategory}
            <span className="text-brand-400 font-bold">×</span>
          </button>
        )}
        {(query || selectedCategory) && (
          <span className="text-sm text-gray-500">
            找到 <strong>{filtered.length}</strong> 筆
          </span>
        )}
        {mainUpdatedAt && (
          <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
            資料更新時間：
            <span className="text-gray-500 font-medium">
              {formatDateTime(mainUpdatedAt)}
            </span>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-700 text-white">
                {COLUMNS.filter(
                  (col) => col.key !== "student_count" || showStudentCount
                ).map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-semibold whitespace-nowrap text-${col.align}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      COLUMNS.filter(
                        (col) => col.key !== "student_count" || showStudentCount
                      ).length
                    }
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {query ? "找不到符合的課程" : "目前沒有課程資料"}
                  </td>
                </tr>
              ) : (
                filtered.map((course, idx) => (
                  <tr
                    key={`${course.id || ""}-${idx}`}
                    className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    {COLUMNS.filter(
                      (col) => col.key !== "student_count" || showStudentCount
                    ).map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-${col.align} text-gray-600`}
                      >
                        {renderCell(col.key, course, categoryColorMap, mainUpdatedAt)}
                      </td>
                    ))}
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
