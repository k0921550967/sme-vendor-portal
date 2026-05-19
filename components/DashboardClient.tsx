"use client";

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { CourseRecord, UserRole } from "@/types";
import {
  ALL_PUBLISH_STATUSES_TOKEN,
  filterCoursesByPublishStatus,
  isAdminOnlyColumnKey,
  isAdminRole,
  isTableColumnVisible,
  resolvePublishStatusFilter,
} from "@/lib/dashboard-access";
import StatsCards from "./StatsCards";

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 1. 日期/時間 helpers                                                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function formatDateTime(iso: string): string {
  if (!iso) return "-";
  const raw = iso.trim();
  try {
    // 直接從字串擷取，不經 Date 轉換，避免秒數與時區偏移
    const match = raw.match(
      /^(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{2}):(\d{2})/
    );
    if (match) {
      const [, year, month, day, hour, min] = match;
      return `${year}/${month}/${day} ${hour}:${min}`;
    }
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Taipei",
    }).format(new Date(raw));
  } catch {
    // fallback：去掉秒數與毫秒
    return raw
      .replace(/(\d{2}:\d{2}):\d{2}(?:\.\d+)?/, "$1")
      .replace("T", " ");
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

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 2. 課程「時間狀態」（即將開課 / 進行中 / 已結束）                        ║
// ║    依 start_hour + duration 判斷。fakeNow = now + 8h，與台灣時間同基準。 ║
// ╚══════════════════════════════════════════════════════════════════════════╝
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
  upcoming: "即將開課",
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

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 3. 開課狀態 / 請款狀態字典                                                ║
// ║    以「陣列」維護，方便未來新增、調整顯示順序、定義排序 order            ║
// ║    - value:  Sheet 內原始字串（lower-case 比對）                          ║
// ║    - label:  顯示中文                                                     ║
// ║    - cls:    Tailwind class                                              ║
// ║    - order:  排序權重（小→大顯示），未定義者排在後面                    ║
// ║                                                                          ║
// ║   空字串「""」也是一個合法值，代表「尚未送審 / 尚未請款」                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝
interface StatusConfig {
  value: string;
  label: string;
  cls: string;
  order: number;
}

const PUBLISH_STATUSES: StatusConfig[] = [
  { value: "action_requested", label: "開課單位正在退回修改", cls: "bg-orange-50 border-orange-300 text-orange-700",  order: 0 },
  { value: "sent",             label: "需要審核",             cls: "bg-yellow-50 border-yellow-300 text-yellow-700",  order: 1 },
  { value: "ok",               label: "已通過",               cls: "bg-green-50 border-green-300 text-green-700",     order: 2 },
  { value: "",                 label: "開課單位未送審",       cls: "bg-gray-100 border-gray-300 text-gray-600",        order: 3 },
];

const COMPLETION_STATUSES: StatusConfig[] = [
  { value: "report_number_of_student_completed", label: "需要請款", cls: "bg-yellow-50 border-yellow-300 text-yellow-700", order: 0 },
  { value: "",                                    label: "尚未請款", cls: "bg-gray-100 border-gray-300 text-gray-600",      order: 1 },
];

// 不在字典中的舊資料 fallback
const STATUS_FALLBACK: { label: (raw: string) => string; cls: string; order: number } = {
  label: (raw) => raw || "-",
  cls: "bg-gray-50 border-gray-200 text-gray-600",
  order: 999,
};

function normalizeStatus(raw: string | undefined | null): string {
  return (raw ?? "").toString().toLowerCase().trim();
}

function lookupStatus(raw: string, dict: StatusConfig[]): StatusConfig | null {
  const key = normalizeStatus(raw);
  return dict.find((s) => s.value === key) ?? null;
}

function renderStatusBadge(raw: string, dict: StatusConfig[]): React.ReactNode {
  const found = lookupStatus(raw, dict);
  if (found) {
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-full border whitespace-nowrap text-base ${found.cls}`}
      >
        {found.label}
      </span>
    );
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full border whitespace-nowrap text-base ${STATUS_FALLBACK.cls}`}
    >
      {STATUS_FALLBACK.label(raw)}
    </span>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 4. 文字字型統一設定                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Tailwind 字體大小對照：text-sm=14px / text-base=16px / text-lg=18px / text-xl=20px / text-2xl=24px
const TABLE_FONT = {
  tableBase:   "text-xl",     // 表格主體（表頭 + 資料列基準）          20px
  cellSmall:   "text-lg",     // 開課單位、地址、開課時間                18px
  badge:       "text-lg",     // 類別 badge                             18px
  statusLabel: "16px",        // 時間狀態小字（即將開課/進行中/已結束）  16px
  updateNote:  "15px",        // 學生人數下方更新時間小字                15px
  tab:         "text-xl",     // 狀態標籤頁文字                         20px
  tabBadge:    "text-lg",     // 標籤頁右側數字                         18px
  search:      "text-xl",     // 搜尋框輸入文字                         20px
  filterTag:   "text-lg",     // 已選類別標籤                           18px
  filterCount: "text-xl",     // 篩選結果數                             20px
  updateTime:  "text-lg",     // 右上角資料更新時間                     18px
  footer:      "text-lg",     // 底部「共 N 筆」                        18px
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 5. 欄位設定                                                               ║
// ║    - defaultWidth / minWidth：拖曳欄寬用                                  ║
// ║    - sortType：決定排序比較器（text/number/date/status）                  ║
// ║    - groupLevel：true 表示同 class 多場次共用同一格；false 表示要逐場次   ║
// ║                  在同一格內堆疊顯示                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
type ColumnKey =
  | "class_name"
  | "school_name"
  | "schedule_address"
  | "start_hour"
  | "duration"
  | "teachers"
  | "category"
  | "student_count"
  | "latest_publish_status"
  | "latest_completion_status";

type SortType = "text" | "number" | "date" | "publish_status" | "completion_status";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align: "left" | "center";
  defaultWidth: number;
  minWidth: number;
  sortable: boolean;
  sortType: SortType;
  groupLevel: boolean; // true = 同班級共用一格；false = 逐場次堆疊
  viewerHidden?: boolean;
  /** 僅指定角色可見；未設定則所有角色可見 */
  visibleForRoles?: UserRole[];
  hidden?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "class_name",                label: "班級名稱",     align: "center", defaultWidth: 260, minWidth: 160, sortable: true,  sortType: "text",              groupLevel: true  },
  { key: "student_count",             label: "學生人數",     align: "center", defaultWidth: 110, minWidth: 80,  sortable: true,  sortType: "number",            groupLevel: true  },
  { key: "category",                  label: "類別",         align: "center", defaultWidth: 140, minWidth: 80,  sortable: true,  sortType: "text",              groupLevel: true, hidden: true },
  { key: "start_hour",                label: "開課時間",     align: "left",   defaultWidth: 200, minWidth: 130, sortable: true,  sortType: "date",              groupLevel: false },
  { key: "duration",                  label: "時數(小時)",   align: "center", defaultWidth: 110, minWidth: 80,  sortable: true,  sortType: "number",            groupLevel: false },
  { key: "school_name",               label: "開課單位",     align: "center", defaultWidth: 200, minWidth: 120, sortable: true,  sortType: "text",              groupLevel: true  },
  { key: "schedule_address",          label: "地址",         align: "left",   defaultWidth: 240, minWidth: 140, sortable: true,  sortType: "text",              groupLevel: false },
  { key: "teachers",                  label: "教師",         align: "center", defaultWidth: 160, minWidth: 100, sortable: true,  sortType: "text",              groupLevel: false },
  { key: "latest_publish_status",     label: "開課狀態",     align: "center", defaultWidth: 180, minWidth: 120, sortable: true,  sortType: "publish_status",    groupLevel: true,  visibleForRoles: ["admin"] },
  { key: "latest_completion_status",  label: "請款狀態",     align: "center", defaultWidth: 150, minWidth: 110, sortable: true,  sortType: "completion_status", groupLevel: true,  visibleForRoles: ["admin"] },
];

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 6. 班級分組：同一 class_id（fallback: class_name）的 session 收進一組    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
interface ClassGroup {
  /** Stable key for React */
  key: string;
  class_id: string;
  class_name: string;
  /** group-level 欄位：取自第一筆 session */
  category: string;
  school_name: string[];
  teachers: string[];
  student_count: number;
  /** 已按 start_hour 由早到晚排序 */
  sessions: CourseRecord[];
}

function groupByClass(sessions: CourseRecord[]): ClassGroup[] {
  const map = new Map<string, ClassGroup>();
  for (const s of sessions) {
    const key = (s.class_id || s.class_name || s.id || "").trim() || "__unknown__";
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        class_id: s.class_id,
        class_name: s.class_name,
        category: s.category,
        school_name: s.school_name,
        teachers: s.teachers,
        student_count: s.student_count,
        sessions: [],
      };
      map.set(key, g);
    }
    g.sessions.push(s);
  }
  // 每組內 session 依 start_hour 由早到晚
  for (const g of map.values()) {
    g.sessions.sort((a, b) => (a.start_hour || "").localeCompare(b.start_hour || ""));
  }
  return Array.from(map.values());
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 7. 排序                                                                  ║
// ║    - 文字：Intl.Collator（zh-Hant + co=stroke）依筆畫順序                ║
// ║    - 數字：直接相減                                                       ║
// ║    - 日期：時間戳遞增                                                     ║
// ║    - 狀態：依 StatusConfig.order                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const strokeCollator = new Intl.Collator("zh-Hant-u-co-stroke", { numeric: true });

type SortKey = string | number;

function statusOrder(raw: string, dict: StatusConfig[]): number {
  return lookupStatus(raw, dict)?.order ?? STATUS_FALLBACK.order;
}

function getGroupSortKey(group: ClassGroup, col: ColumnDef): SortKey {
  switch (col.key) {
    case "class_name":      return group.class_name || "";
    case "school_name":     return group.school_name.join("、");
    case "category":        return group.category || "";
    case "teachers":
      return (group.sessions[0]?.teachers ?? []).join("、");
    case "student_count":   return group.student_count ?? 0;
    case "start_hour": {
      // 取最早的 session
      const ts = group.sessions
        .map((s) => new Date(s.start_hour).getTime())
        .filter((n) => !isNaN(n));
      return ts.length ? Math.min(...ts) : Number.POSITIVE_INFINITY;
    }
    case "duration": {
      const ds = group.sessions.map((s) => s.duration || 0);
      return ds.length ? Math.min(...ds) : 0;
    }
    case "schedule_address":
      return group.sessions[0]?.schedule_address || "";
    case "latest_publish_status":
      return Math.min(
        ...group.sessions.map((s) => statusOrder(s.latest_publish_status, PUBLISH_STATUSES))
      );
    case "latest_completion_status":
      return Math.min(
        ...group.sessions.map((s) => statusOrder(s.latest_completion_status, COMPLETION_STATUSES))
      );
  }
}

function compareGroups(
  a: ClassGroup,
  b: ClassGroup,
  col: ColumnDef,
  direction: "asc" | "desc"
): number {
  const va = getGroupSortKey(a, col);
  const vb = getGroupSortKey(b, col);
  let cmp: number;
  if (typeof va === "number" && typeof vb === "number") {
    cmp = va - vb;
  } else if (col.sortType === "text") {
    cmp = strokeCollator.compare(String(va), String(vb));
  } else {
    cmp = String(va).localeCompare(String(vb));
  }
  return direction === "asc" ? cmp : -cmp;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 8. 類別顏色                                                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const CATEGORY_COLORS = [
  "bg-blue-50 border border-blue-200 text-blue-700",
  "bg-green-50 border border-green-200 text-green-700",
  "bg-yellow-50 border border-yellow-200 text-yellow-700",
  "bg-purple-50 border border-purple-200 text-purple-700",
  "bg-pink-50 border border-pink-200 text-pink-700",
  "bg-indigo-50 border border-indigo-200 text-indigo-700",
  "bg-orange-50 border border-orange-200 text-orange-700",
];

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 9. 欄寬 localStorage                                                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const COLUMN_WIDTH_STORAGE_KEY = "dashboard.columnWidths.v1";

function loadColumnWidths(): Partial<Record<ColumnKey, number>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveColumnWidths(widths: Partial<Record<ColumnKey, number>>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // 忽略 quota 等錯誤
  }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 10. Cell rendering                                                       ║
// ║                                                                          ║
// ║    每個多場次欄位內的「單場次區塊」都套用 SESSION_ROW_CLS，               ║
// ║    確保各欄位垂直方向對齊。                                               ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const SESSION_ROW_CLS =
  "min-h-[56px] flex flex-col justify-center border-t border-gray-100 first:border-t-0 py-2";

type StatusField = "latest_publish_status" | "latest_completion_status";

/** 同班所有場次的指定狀態欄位是否一致（normalize 後比對） */
function allSessionsShareStatus(sessions: CourseRecord[], field: StatusField): boolean {
  if (sessions.length <= 1) return true;
  const first = normalizeStatus(sessions[0][field]);
  return sessions.every((s) => normalizeStatus(s[field]) === first);
}

/**
 * 班級層級顯示開課/請款狀態：
 * - 各場次相同 → 合併為單一 badge（置中）
 * - 各場次不同 → 仍依場次堆疊，與開課時間等欄位列對齊
 */
function renderMergedStatusCell(
  group: ClassGroup,
  field: StatusField,
  dict: StatusConfig[]
): React.ReactNode {
  if (allSessionsShareStatus(group.sessions, field)) {
    return renderStatusBadge(group.sessions[0][field], dict);
  }
  return (
    <div className="flex flex-col w-full">
      {group.sessions.map((session, i) => (
        <div
          key={i}
          className={`${SESSION_ROW_CLS} items-center`}
        >
          {renderStatusBadge(session[field], dict)}
        </div>
      ))}
    </div>
  );
}

function renderGroupLevelCell(
  key: ColumnKey,
  group: ClassGroup,
  categoryColorMap: Record<string, string>,
  mainUpdatedAt: string | null
): React.ReactNode {
  switch (key) {
    case "class_name": {
      const sessionCount = group.sessions.length;
      return (
        <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
          <span
            className={`font-medium px-2 py-0.5 rounded-full ${
              categoryColorMap[group.category] ??
              "bg-gray-100 border border-gray-200 text-gray-600"
            }`}
          >
            {group.class_name || "-"}
          </span>
          {sessionCount > 1 && (
            <span
              style={{ fontSize: TABLE_FONT.statusLabel }}
              className="text-gray-400"
            >
              共 {sessionCount} 場
            </span>
          )}
        </span>
      );
    }
    case "school_name":
      return group.school_name.length > 0 ? (
        <div className="flex flex-col items-center gap-0.5">
          {group.school_name.map((s, i) => (
            <span key={i} className={TABLE_FONT.cellSmall}>
              {s}
            </span>
          ))}
        </div>
      ) : (
        "-"
      );
    case "category":
      return (
        <span
          className={`inline-block ${TABLE_FONT.badge} px-2 py-0.5 rounded-full whitespace-nowrap ${
            categoryColorMap[group.category] ??
            "bg-gray-100 border border-gray-200 text-gray-600"
          }`}
        >
          {group.category || "-"}
        </span>
      );
    case "student_count": {
      // 顯示班級的學生人數；若任一場次的 updated_at 與主時間不同則顯示更新時間
      const sessionUpdate = group.sessions.find(
        (s) => s.updated_at && s.updated_at !== mainUpdatedAt
      )?.updated_at;
      return (
        <div className="text-center">
          {group.student_count ?? "-"}
          {sessionUpdate && (
            <div
              className="text-gray-400 font-normal mt-0.5"
              style={{ fontSize: TABLE_FONT.updateNote }}
            >
              更新：{formatDateTime(sessionUpdate)}
            </div>
          )}
        </div>
      );
    }
    case "latest_publish_status":
      return renderMergedStatusCell(group, "latest_publish_status", PUBLISH_STATUSES);
    case "latest_completion_status":
      return renderMergedStatusCell(group, "latest_completion_status", COMPLETION_STATUSES);
    default:
      return null;
  }
}

function renderSessionCell(key: ColumnKey, session: CourseRecord): React.ReactNode {
  switch (key) {
    case "start_hour": {
      const { date, timeRange } = formatDateRange(session.start_hour, session.duration);
      const status = getCourseStatus(session.start_hour, session.duration);
      const label = STATUS_LABEL[status];
      return (
        <>
          <div className={`flex items-baseline gap-2 whitespace-nowrap ${TABLE_FONT.cellSmall}`}>
            <span>{date}</span>
            {label && (
              <span
                style={{ fontSize: TABLE_FONT.statusLabel }}
                className={`font-medium ${STATUS_COLOR[status]}`}
              >
                {label}
              </span>
            )}
          </div>
          {timeRange && (
            <span className={`text-gray-600 whitespace-nowrap ${TABLE_FONT.cellSmall}`}>
              {timeRange}
            </span>
          )}
        </>
      );
    }
    case "duration":
      return <span>{session.duration || "-"}</span>;
    case "schedule_address":
      return <span className={TABLE_FONT.cellSmall}>{session.schedule_address || "-"}</span>;
    case "teachers":
      return session.teachers.length > 0 ? session.teachers.join("、") : "-";
    default:
      return null;
  }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 11. 主元件                                                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝
type StatusTab = "all" | "upcoming" | "ongoing" | "ended";

interface SortState {
  key: ColumnKey;
  direction: "asc" | "desc";
}

export default function DashboardClient({
  courses,
  isViewer,
  role,
}: {
  courses: CourseRecord[];
  isViewer: boolean;
  role: UserRole;
}) {
  const isAdmin = isAdminRole(role);
  const columnVisibilityCtx = useMemo(
    () => ({ role, isViewer }),
    [role, isViewer]
  );

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>("upcoming");
  // 預設只看 publish_status = "ok"（已通過）。admin 可改成其他值或全部。
  const [publishStatusFilter, setPublishStatusFilter] = useState<string>("ok");
  const [sort, setSort] = useState<SortState | null>(null);

  // 每次瀏覽器 session 開始（包含關閉後重開自動登入）都記錄一筆登入紀錄
  useEffect(() => {
    fetch("/api/record-login", { method: "POST" }).catch(() => {});
  }, []);

  // ──────────────────────────────────────────────
  // 欄位（依角色過濾）
  // ──────────────────────────────────────────────
  const visibleColumns = useMemo(
    () => COLUMNS.filter((col) => isTableColumnVisible(col, columnVisibilityCtx)),
    [columnVisibilityCtx]
  );

  // 若目前排序欄位對非 admin 不可見，清除排序避免無效 state
  useEffect(() => {
    if (!isAdmin && sort && isAdminOnlyColumnKey(sort.key)) {
      setSort(null);
    }
  }, [isAdmin, sort]);

  // ──────────────────────────────────────────────
  // 欄寬
  // ──────────────────────────────────────────────
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColumnKey, number>>>({});

  useEffect(() => {
    setColumnWidths(loadColumnWidths());
  }, []);

  const getWidth = useCallback(
    (col: ColumnDef) => columnWidths[col.key] ?? col.defaultWidth,
    [columnWidths]
  );

  const resizingRef = useRef<{
    key: ColumnKey;
    startX: number;
    startWidth: number;
    minWidth: number;
  } | null>(null);

  const onMouseMoveResize = useCallback((e: MouseEvent) => {
    const r = resizingRef.current;
    if (!r) return;
    const delta = e.clientX - r.startX;
    const next = Math.max(r.minWidth, Math.round(r.startWidth + delta));
    setColumnWidths((prev) => ({ ...prev, [r.key]: next }));
  }, []);

  const onMouseUpResize = useCallback(() => {
    resizingRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMouseMoveResize);
    window.removeEventListener("mouseup", onMouseUpResize);
    setColumnWidths((prev) => {
      saveColumnWidths(prev);
      return prev;
    });
  }, [onMouseMoveResize]);

  const startResize = useCallback(
    (col: ColumnDef, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = {
        key: col.key,
        startX: e.clientX,
        startWidth: getWidth(col),
        minWidth: col.minWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMoveResize);
      window.addEventListener("mouseup", onMouseUpResize);
    },
    [getWidth, onMouseMoveResize, onMouseUpResize]
  );

  // ──────────────────────────────────────────────
  // 雙重水平卷軸
  //   - 用 ResizeObserver 監聽 table 寬度變化，避免 state 不同步
  //   - 用「比例」同步 scrollLeft，確保兩條卷軸都能拉到各自的最右端
  // ──────────────────────────────────────────────
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableContentWidth, setTableContentWidth] = useState(0);
  const syncingRef = useRef<"top" | "table" | null>(null);

  const recalcTableWidth = useCallback(() => {
    // table 用 width: max-content，所以 offsetWidth = 全部欄寬的總和
    const w = tableRef.current?.offsetWidth ?? tableWrapRef.current?.scrollWidth ?? 0;
    setTableContentWidth(w);
  }, []);

  useLayoutEffect(() => {
    recalcTableWidth();
  }, [recalcTableWidth, columnWidths, visibleColumns, courses.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ro = new ResizeObserver(() => recalcTableWidth());
    if (tableRef.current) ro.observe(tableRef.current);
    if (tableWrapRef.current) ro.observe(tableWrapRef.current);
    window.addEventListener("resize", recalcTableWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalcTableWidth);
    };
  }, [recalcTableWidth]);

  const syncScroll = useCallback(
    (source: "top" | "table") => {
      const top = topScrollRef.current;
      const tab = tableWrapRef.current;
      if (!top || !tab) return;
      if (syncingRef.current && syncingRef.current !== source) return;
      syncingRef.current = source;
      const fromEl = source === "top" ? top : tab;
      const toEl = source === "top" ? tab : top;
      const fromMax = fromEl.scrollWidth - fromEl.clientWidth;
      const toMax = toEl.scrollWidth - toEl.clientWidth;
      const ratio = fromMax > 0 ? fromEl.scrollLeft / fromMax : 0;
      const target = Math.round(ratio * toMax);
      if (Math.abs(toEl.scrollLeft - target) > 0.5) {
        toEl.scrollLeft = target;
      }
      // 用 rAF 釋放鎖，避免互相觸發
      requestAnimationFrame(() => {
        syncingRef.current = null;
      });
    },
    []
  );

  const onTopScroll = useCallback(() => syncScroll("top"), [syncScroll]);
  const onTableScroll = useCallback(() => syncScroll("table"), [syncScroll]);

  // ──────────────────────────────────────────────
  // 資料處理 pipeline
  //   1. publish_status 篩選（非 admin 強制 "ok"）
  //   2. tab + category + query 篩選
  //   3. 同 class_id 合併為 group
  //   4. 排序
  // ──────────────────────────────────────────────
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

  // 篩選下拉的可選值：依 PUBLISH_STATUSES 順序顯示
  const publishFilterOptions: { value: string; label: string }[] = useMemo(
    () => [
      { value: ALL_PUBLISH_STATUSES_TOKEN, label: "全部" },
      ...PUBLISH_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    ],
    []
  );

  const effectivePublishFilter = resolvePublishStatusFilter(
    role,
    publishStatusFilter
  );

  const coursesAfterPublishFilter = useMemo(
    () => filterCoursesByPublishStatus(courses, effectivePublishFilter),
    [courses, effectivePublishFilter]
  );

  // tab 數字基於 publish_status 篩選後的資料
  const tabCounts = useMemo(
    () => ({
      all:      coursesAfterPublishFilter.length,
      upcoming: coursesAfterPublishFilter.filter((c) => getCourseStatus(c.start_hour, c.duration) === "upcoming").length,
      ongoing:  coursesAfterPublishFilter.filter((c) => getCourseStatus(c.start_hour, c.duration) === "ongoing").length,
      ended:    coursesAfterPublishFilter.filter((c) => getCourseStatus(c.start_hour, c.duration) === "ended").length,
    }),
    [coursesAfterPublishFilter]
  );

  const filteredSessions = useMemo(() => {
    let result = coursesAfterPublishFilter;
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
  }, [coursesAfterPublishFilter, query, selectedCategory, statusTab]);

  const groups: ClassGroup[] = useMemo(() => {
    const g = groupByClass(filteredSessions);
    if (sort) {
      const col = visibleColumns.find((c) => c.key === sort.key);
      if (col) g.sort((a, b) => compareGroups(a, b, col, sort.direction));
    } else {
      // 預設：依班級名稱（筆畫）升序
      g.sort((a, b) => strokeCollator.compare(a.class_name || "", b.class_name || ""));
    }
    return g;
  }, [filteredSessions, sort, visibleColumns]);

  // ──────────────────────────────────────────────
  // 排序按鈕：null → asc → desc → null 三段循環
  // ──────────────────────────────────────────────
  const toggleSort = useCallback((key: ColumnKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }, []);

  return (
    <>
      {/* Stats */}
      <StatsCards
        courses={coursesAfterPublishFilter}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Status Tabs */}
      <div className="mb-4 flex gap-0 border-b border-gray-200 overflow-x-auto">
        {(
          [
            { key: "all",      label: "全部" },
            { key: "upcoming", label: "即將開課" },
            { key: "ongoing",  label: "進行中" },
            { key: "ended",    label: "已結束" },
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
            <span
              className={`ml-1.5 ${TABLE_FONT.tabBadge} px-1.5 py-0.5 rounded-full ${
                statusTab === tab.key
                  ? "bg-brand-100 text-brand-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + admin 篩選 + 更新時間同一列 */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[260px]">
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

        {/* admin 限定：開課狀態篩選 */}
        {isAdmin && (
          <label className="flex items-center gap-2 text-gray-600">
            <span className={`${TABLE_FONT.filterTag} whitespace-nowrap`}>開課狀態</span>
            <select
              value={publishStatusFilter}
              onChange={(e) => setPublishStatusFilter(e.target.value)}
              className={`${TABLE_FONT.search} px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500`}
            >
              {publishFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

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
            找到 <strong>{groups.length}</strong> 班
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
        {/* 頂部水平卷軸 */}
        <div
          ref={topScrollRef}
          onScroll={onTopScroll}
          className="overflow-x-auto scrollbar-thin border-b border-gray-100"
          style={{ height: 14 }}
          aria-hidden="true"
        >
          <div style={{ width: tableContentWidth, height: 1 }} />
        </div>

        <div
          ref={tableWrapRef}
          onScroll={onTableScroll}
          className="overflow-x-auto scrollbar-thin"
        >
          <table
            ref={tableRef}
            className={`${TABLE_FONT.tableBase}`}
            style={{
              tableLayout: "fixed",
              borderCollapse: "collapse",
              width: "max-content",
              minWidth: "100%",
            }}
          >
            <colgroup>
              {visibleColumns.map((col) => (
                <col key={col.key} style={{ width: getWidth(col) }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-brand-700 text-white">
                {visibleColumns.map((col) => {
                  const isSorted = sort?.key === col.key;
                  return (
                    <th
                      key={col.key}
                      className={`relative px-4 py-3 font-semibold whitespace-nowrap text-${col.align} select-none ${
                        col.sortable ? "cursor-pointer hover:bg-brand-600" : ""
                      }`}
                      onClick={() => col.sortable && toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1 align-middle">
                        {col.label}
                        {col.sortable && (
                          <span
                            className={`inline-flex flex-col text-[10px] leading-[10px] ${
                              isSorted ? "text-white" : "text-white/40"
                            }`}
                            aria-hidden="true"
                          >
                            <span
                              className={
                                isSorted && sort?.direction === "asc"
                                  ? "text-white"
                                  : "text-white/40"
                              }
                            >
                              ▲
                            </span>
                            <span
                              className={
                                isSorted && sort?.direction === "desc"
                                  ? "text-white"
                                  : "text-white/40"
                              }
                            >
                              ▼
                            </span>
                          </span>
                        )}
                      </span>
                      {/* 欄寬拖曳把手：mousedown 阻擋傳播以免觸發排序 */}
                      <span
                        onMouseDown={(e) => startResize(col, e)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setColumnWidths((prev) => {
                            const next = { ...prev };
                            delete next[col.key];
                            saveColumnWidths(next);
                            return next;
                          });
                        }}
                        title="拖曳調整欄寬，雙擊重設"
                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-white/60 active:bg-white"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {query ? "找不到符合的課程" : "目前沒有課程資料"}
                  </td>
                </tr>
              ) : (
                groups.map((group, idx) => (
                  <tr
                    key={group.key}
                    className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-2 text-gray-600 overflow-hidden ${
                          col.groupLevel
                            ? "text-center align-middle"
                            : `text-${col.align} align-top`
                        }`}
                        style={{ wordBreak: "break-word" }}
                      >
                        {col.groupLevel ? (
                          <div className="flex flex-col items-center justify-center">
                            {renderGroupLevelCell(col.key, group, categoryColorMap, mainUpdatedAt)}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            {group.sessions.map((session, i) => (
                              <div key={`${group.key}-${i}`} className={SESSION_ROW_CLS}>
                                {renderSessionCell(col.key, session)}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {groups.length > 0 && (
          <div
            className={`px-4 py-2 border-t border-gray-100 bg-gray-50 ${TABLE_FONT.footer} text-gray-400 text-right`}
          >
            共 {groups.length} 班 / {filteredSessions.length} 場次
            {query && `（篩選自 ${coursesAfterPublishFilter.length} 場次）`}
          </div>
        )}
      </div>
    </>
  );
}
