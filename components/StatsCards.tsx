"use client";

import { CourseRecord } from "@/types";
import { useMemo } from "react";

const CATEGORY_COLORS: { idle: string; active: string }[] = [
  { idle: "bg-blue-50 border-blue-200 text-blue-700", active: "bg-blue-500 border-blue-500 text-white" },
  { idle: "bg-green-50 border-green-200 text-green-700", active: "bg-green-500 border-green-500 text-white" },
  { idle: "bg-yellow-50 border-yellow-200 text-yellow-700", active: "bg-yellow-400 border-yellow-400 text-white" },
  { idle: "bg-purple-50 border-purple-200 text-purple-700", active: "bg-purple-500 border-purple-500 text-white" },
  { idle: "bg-pink-50 border-pink-200 text-pink-700", active: "bg-pink-500 border-pink-500 text-white" },
  { idle: "bg-indigo-50 border-indigo-200 text-indigo-700", active: "bg-indigo-500 border-indigo-500 text-white" },
  { idle: "bg-orange-50 border-orange-200 text-orange-700", active: "bg-orange-500 border-orange-500 text-white" },
];

interface StatsCardsProps {
  courses: CourseRecord[];
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
}

export default function StatsCards({ courses, selectedCategory, onSelectCategory }: StatsCardsProps) {
  const stats = useMemo(() => {
    const byCategory = courses.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {});
    return { total: courses.length, byCategory };
  }, [courses]);

  const categories = Object.entries(stats.byCategory);

  const allActive = selectedCategory === null;

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {/* 全部 */}
      <button
        onClick={() => onSelectCategory(null)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
          allActive
            ? "bg-brand-700 border-brand-700 text-white shadow-md scale-[1.02]"
            : "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100"
        }`}
      >
        <div className="flex flex-col items-start">
          <span className="text-[11px] font-medium opacity-80 leading-none mb-1">全部課程</span>
          <span className="text-2xl font-bold leading-none">{stats.total}</span>
        </div>
        <span className="text-xs opacity-70 self-end pb-0.5">筆</span>
      </button>

      {/* 各 category */}
      {categories.map(([cat, count], idx) => {
        const colors = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
        const isActive = selectedCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelectCategory(isActive ? null : cat)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
              isActive
                ? `${colors.active} shadow-md scale-[1.02]`
                : `${colors.idle} hover:brightness-95`
            }`}
          >
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-medium opacity-80 leading-none mb-1 max-w-[120px] break-words leading-tight">
                {cat}
              </span>
              <span className="text-2xl font-bold leading-none">{count}</span>
            </div>
            <span className="text-xs opacity-70 self-end pb-0.5">筆</span>
          </button>
        );
      })}
    </div>
  );
}
