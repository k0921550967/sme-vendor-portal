"use client";

import { useState, useMemo, useEffect } from "react";
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
    // 直接解析字串數字，避免 Date 物件將 UTC "Z" 轉成本地時區
    // e.g. "2026-05-27T14:00:00.000Z" → 當作台灣時間 14:00，不做 +8 轉換
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return { date: iso, timeRange: "" };

    const [, year, month, day, hourStr, minStr] = match;
    const date = `${year}/${month}/${day}`;

    const startMin = parseInt(hourStr) * 60 + parseInt(minStr);
    const endMin = startMin + Math.round(durationHours * 60);

    const fmt = (totalMin: number) => {
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    return {
      date,
      timeRange: durationHours > 0 ? `${fmt(startMin)} - ${fmt(endMin)}` : fmt(startMin),
    };
  } catch {
    return { date: iso, timeRange: "" };
  }
}

// ──────────────────────────────────────────────
// 課程狀態判斷
// start_hour 儲存格式為台灣時間但帶 Z 後綴，視為本地時間直接比較
// fakeNow = Date.now() + 8h，讓「現在」與儲存值同基準
// ──────────────────────────────────────────────
type CourseStatus = "upcoming" | "ongoing" | "ended" | "unknown";

function getCourseStatus(startIso: string, durationHours: number): CourseStatus {
  if (!startIso) return "unknown";
  try {
    const startEpoch = new Date(startIso).getTime();
    if (isNaN(startEpoch)) return "unknown";
    const fakeNow = Date.now() + 8 * 3600 * 1000;
    const endEpoch = startEpoch + Math.round(durationHours * 3600 * 1000);
    if (fakeNow < startEpoch) return "upcoming";
    if (fakeNow < endEpoch) return "ongoing";
    return "ended";
  } catch {
    return "unknown";
  }
}

const STATUS_LABEL: Record<CourseStatus, string | null> = {
  upcoming: "尚未開課",
  ongoing:  "進行中",
  ended:    "已結束",
  unknown:  null,
};

const STATUS_COLOR: Record<CourseStatus, string> = {
  upcoming: "text-blue-500",
  ongoing:  "text-green-600",
  ended:    "text-gray-400",
  unknown:  "text-gray-400",
};

// ──────────────────────────────────────────────
// 字體大小設定：統一控制所有文字大小
// 調整此處即可全域變更，不需逐一尋找
//
// ──────────────────────────────────────────────
// Tailwind 字體大小對照：text-sm=14px / text-base=16px / text-lg=18px / text-xl=20px / text-2xl=24px
const TABLE_FONT = {
  tableBase:   "text-xl",     // 表格主體（表頭 + 資料列基準）          20px
  cellSmall:   "text-lg",     // 開課單位、地址、開課時間                18px
  badge:       "text-lg",     // 類別 badge                             18px
  statusLabel: "16px",        // 課程狀態小字（尚未開課/進行中/已結束）  16px
  updateNote:  "15px",        // 學生人數下方更新時間小字                15px
  tab:         "text-xl",     // 狀態標籤頁文字                         20px
  tabBadge:    "text-lg",     // 標籤頁右側數字                         18px
  search:      "text-xl",     // 搜尋框輸入文字                         20px
  filterTag:   "text-lg",     // 已選類別標籤                           18px
  filterCount: "text-xl",     // 篩選結果數                             20px
  updateTime:  "text-lg",     // 右上角資料更新時間                     18px
  footer:      "text-lg",     // 底部「共 N 筆」                        18px
};

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
  viewerHidden?: boolean; // true = viewer 看不到此欄，預設 false（全部可見）
  hidden?: boolean;       // true = 所有人都不顯示此欄
}

const COLUMNS: ColumnDef[] = [
  { key: "class_name",        label: "班級名稱",   align: "center" },
  { key: "student_count",     label: "學生人數",   align: "center" },  // 加 viewerHidden: true 可對 viewer 隱藏
  { key: "category",          label: "類別",       align: "center", hidden: true },
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
    case "class_name": {
      const status = getCourseStatus(course.start_hour, course.duration);
      const label = STATUS_LABEL[status];
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={`font-medium px-2 py-0.5 rounded-full ${
            categoryColorMap[course.category] ?? "bg-gray-100 border border-gray-200 text-gray-600"
          }`}>
            {course.class_name || "-"}
          </span>
          {label && (
            <span style={{ fontSize: TABLE_FONT.statusLabel }} className={`font-medium ${STATUS_COLOR[status]}`}>
              {label}
            </span>
          )}
        </span>
      );
    }
    case "school_name":
      return course.school_name.length > 0 ? (
        <div className="flex flex-col gap-0.5 max-w-xs">
          {course.school_name.map((s, i) => <span key={i} className={TABLE_FONT.cellSmall}>{s}</span>)}
        </div>
      ) : "-";
    case "schedule_address":
      return <span className={`${TABLE_FONT.cellSmall} max-w-xs`}>{course.schedule_address || "-"}</span>;
    case "start_hour": {
      const { date, timeRange } = formatDateRange(course.start_hour, course.duration);
      return (
        <div className={`flex flex-col gap-0.5 whitespace-nowrap ${TABLE_FONT.cellSmall}`}>
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
        <span className={`inline-block ${TABLE_FONT.badge} px-2 py-0.5 rounded-full whitespace-nowrap ${
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
            <div className="text-gray-400 font-normal mt-0.5" style={{ fontSize: TABLE_FONT.updateNote }}>
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
  isViewer,
}: {
  courses: CourseRecord[];
  isViewer: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<"upcoming" | "ongoing" | "ended" | "all">("all");

  // 每次瀏覽器 session 開始（包含關閉後重開自動登入）都記錄一筆登入紀錄
  useEffect(() => {
    fetch("/api/record-login", { method: "POST" }).catch(() => {});
  }, []);

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

  const tabCounts = useMemo(() => ({
    upcoming: courses.filter((c) => getCourseStatus(c.start_hour, c.duration) === "upcoming").length,
    ongoing:  courses.filter((c) => getCourseStatus(c.start_hour, c.duration) === "ongoing").length,
    ended:    courses.filter((c) => getCourseStatus(c.start_hour, c.duration) === "ended").length,
    all:      courses.length,
  }), [courses]);

  const filtered = useMemo(() => {
    let result = courses;
    if (statusTab !== "all") {
      result = result.filter((c) => getCourseStatus(c.start_hour, c.duration) === statusTab);
    }
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
  }, [courses, query, selectedCategory, statusTab]);

  return (
    <>
      {/* Stats */}
      <StatsCards
        courses={courses}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Status Tabs */}
      <div className="mb-4 flex gap-0 border-b border-gray-200">
        {(
          [
            { key: "all",     label: "全部" },
            { key: "ended",   label: "已結束" },
            { key: "ongoing", label: "進行中" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`px-4 py-2 ${TABLE_FONT.tab} font-medium border-b-2 transition-colors whitespace-nowrap ${
              statusTab === tab.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 ${TABLE_FONT.tabBadge} px-1.5 py-0.5 rounded-full ${
              statusTab === tab.key
                ? "bg-brand-100 text-brand-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

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
            className={`w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${TABLE_FONT.search}`}
          />
        </div>
        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className={`flex items-center gap-1 ${TABLE_FONT.filterTag} bg-brand-100 text-brand-700 border border-brand-200 px-2 py-1 rounded-full hover:bg-brand-200 transition-colors`}
          >
            {selectedCategory}
            <span className="text-brand-400 font-bold">×</span>
          </button>
        )}
        {(query || selectedCategory) && (
          <span className={`${TABLE_FONT.filterCount} text-gray-500`}>
            找到 <strong>{filtered.length}</strong> 筆
          </span>
        )}
        {mainUpdatedAt && (
          <span className={`ml-auto ${TABLE_FONT.updateTime} text-gray-400 whitespace-nowrap`}>
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
          <table className={`w-full ${TABLE_FONT.tableBase}`}>
            <thead>
              <tr className="bg-brand-700 text-white">
                {COLUMNS.filter(
                  (col) => !col.hidden && !(col.viewerHidden && isViewer)
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
                      COLUMNS.filter((col) => !col.hidden && !(col.viewerHidden && isViewer)).length
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
                      (col) => !col.hidden && !(col.viewerHidden && isViewer)
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
          <div className={`px-4 py-2 border-t border-gray-100 bg-gray-50 ${TABLE_FONT.footer} text-gray-400 text-right`}>
            共 {filtered.length} 筆{query && `（篩選自 ${courses.length} 筆）`}
          </div>
        )}
      </div>
    </>
  );
}
