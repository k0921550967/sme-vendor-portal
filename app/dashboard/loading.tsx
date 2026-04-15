export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header 骨架 */}
      <div className="bg-brand-700 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="h-6 w-48 bg-white/20 rounded animate-pulse" />
          <div className="h-8 w-24 bg-white/20 rounded-lg animate-pulse" />
        </div>
      </div>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {/* Stats 骨架 */}
        <div className="flex flex-wrap gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 w-32 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse" />
          ))}
        </div>

        {/* 搜尋列骨架 */}
        <div className="flex items-center gap-3">
          <div className="h-9 flex-1 max-w-xs bg-white rounded-lg border border-gray-200 animate-pulse" />
          <div className="ml-auto h-5 w-36 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* 表格骨架 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* 表頭 */}
          <div className="bg-brand-700 px-4 py-3 flex gap-6">
            {[120, 80, 100, 80, 140, 160, 80, 80].map((w, i) => (
              <div key={i} className="h-4 bg-white/30 rounded animate-pulse" style={{ width: w }} />
            ))}
          </div>
          {/* 資料列 */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`px-4 py-3 flex gap-6 border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
            >
              {[120, 80, 100, 80, 140, 160, 80, 80].map((w, j) => (
                <div key={j} className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: w }} />
              ))}
            </div>
          ))}
        </div>

        {/* 中央提示 */}
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          正在載入課程資料…
        </div>
      </main>
    </div>
  );
}
