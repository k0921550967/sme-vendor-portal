import { CourseRecord, UserRole } from "@/types";

/**
 * 儀表板權限與資料可見性
 *
 * 角色（授權名單 sheet）：
 * - admin：可看全部 latest_publish_status、表格含「開課狀態」「請款狀態」欄
 * - manager / viewer：僅看 latest_publish_status = ok，且不顯示上述兩欄
 *
 * 擴充方式：
 * - 新角色限制：在 ColumnDef.visibleForRoles 加角色
 * - 新預設篩選：調整 DEFAULT_PUBLISH_STATUS_FOR_NON_ADMIN
 */

/** 非 admin 強制套用的開課狀態篩選（已通過） */
export const DEFAULT_PUBLISH_STATUS_FOR_NON_ADMIN = "ok";

/** admin 篩選下拉「全部」的內部值 */
export const ALL_PUBLISH_STATUSES_TOKEN = "__all__";

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

/** 依角色決定實際套用的 latest_publish_status 篩選值 */
export function resolvePublishStatusFilter(
  role: UserRole,
  adminSelectedFilter: string
): string {
  return isAdminRole(role) ? adminSelectedFilter : DEFAULT_PUBLISH_STATUS_FOR_NON_ADMIN;
}

export function normalizePublishStatus(raw: string | undefined | null): string {
  return (raw ?? "").toString().toLowerCase().trim();
}

export function filterCoursesByPublishStatus(
  courses: CourseRecord[],
  filter: string
): CourseRecord[] {
  if (filter === ALL_PUBLISH_STATUSES_TOKEN) return courses;
  const target = normalizePublishStatus(filter);
  return courses.filter(
    (c) => normalizePublishStatus(c.latest_publish_status) === target
  );
}

/** 表格欄位可見性（與 ColumnDef 對齊的精簡介面） */
export interface ColumnRoleGate {
  hidden?: boolean;
  viewerHidden?: boolean;
  /** 若設定，僅列出的角色可看見此欄；未設定則所有角色可看 */
  visibleForRoles?: UserRole[];
}

export function isTableColumnVisible(
  col: ColumnRoleGate,
  ctx: { role: UserRole; isViewer: boolean }
): boolean {
  if (col.hidden) return false;
  if (col.viewerHidden && ctx.isViewer) return false;
  if (
    col.visibleForRoles?.length &&
    !col.visibleForRoles.includes(ctx.role)
  ) {
    return false;
  }
  return true;
}

/** admin 專用欄位 key（供排序重置等邏輯使用） */
export const ADMIN_ONLY_COLUMN_KEYS = [
  "latest_publish_status",
  "latest_completion_status",
] as const;

export function isAdminOnlyColumnKey(key: string): boolean {
  return (ADMIN_ONLY_COLUMN_KEYS as readonly string[]).includes(key);
}
