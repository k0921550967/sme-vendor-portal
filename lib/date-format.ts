/**
 * 儀表板日期時間顯示（統一不顯示秒數）
 * 支援格式：
 *   YYYY-MM-DDTHH:MM:SS.mmmZ   （ISO 8601，T 分隔）
 *   YYYY/MM/DD HH:MM:SS         （斜線 + 空格，可能只有一位數小時，如 9:00:00）
 *   任何以上兩種的衍生格式
 *
 * 例：
 *   2026/06/08 10:00:00  → 2026/06/08 10:00
 *   2026/05/30 9:00:00   → 2026/05/30 09:00
 */

// \d{1,2} 讓小時支援 1～2 位數（如 9:00、09:00、14:00）
const DATETIME_PARSE_RE =
  /^(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/;

export function formatDateTimeNoSeconds(iso: string): string {
  if (!iso) return "-";
  const raw = iso.trim();
  try {
    const match = raw.match(DATETIME_PARSE_RE);
    if (match) {
      const [, year, month, day, hour, min] = match;
      return `${year}/${month}/${day} ${String(Number(hour)).padStart(2, "0")}:${min}`;
    }
    const viaIntl = new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Taipei",
    }).format(new Date(raw));
    return stripSecondsFromDisplay(viaIntl);
  } catch {
    return stripSecondsFromDisplay(raw.replace("T", " "));
  }
}

/** 將已格式化的字串中的 :SS（秒數）去掉，支援 1～2 位數小時 */
export function stripSecondsFromDisplay(value: string): string {
  return value.replace(/(\d{1,2}:\d{2}):\d{2}(?:\.\d+)?/g, "$1");
}
