"use client";

import { CourseRecord } from "@/types";
import { useMemo } from "react";

export default function StatsCards({ courses }: { courses: CourseRecord[] }) {
  const stats = useMemo(() => {
    const byCategory = courses.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {});
    return { total: courses.length, byCategory };
  }, [courses]);

  const categoryColors = [
    "bg-blue-50 border-blue-200 text-blue-700",
    "bg-green-50 border-green-200 text-green-700",
    "bg-yellow-50 border-yellow-200 text-yellow-700",
    "bg-purple-50 border-purple-200 text-purple-700",
    "bg-pink-50 border-pink-200 text-pink-700",
    "bg-indigo-50 border-indigo-200 text-indigo-700",
    "bg-orange-50 border-orange-200 text-orange-700",
  ];

  const categories = Object.entries(stats.byCategory);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
      {/* 全部 */}
      <div className="bg-brand-700 text-white rounded-xl p-4 flex flex-col gap-1 shadow-sm">
        <span className="text-blue-100 text-xs font-medium">全部課程</span>
        <span className="text-3xl font-bold">{stats.total}</span>
        <span className="text-blue-200 text-xs">筆</span>
      </div>

      {/* 各 category */}
      {categories.map(([cat, count], idx) => (
        <div
          key={cat}
          className={`rounded-xl p-4 flex flex-col gap-1 shadow-sm border ${
            categoryColors[idx % categoryColors.length]
          }`}
        >
          <span className="text-xs font-medium truncate" title={cat}>
            {cat}
          </span>
          <span className="text-3xl font-bold">{count}</span>
          <span className="text-xs opacity-70">筆</span>
        </div>
      ))}
    </div>
  );
}
