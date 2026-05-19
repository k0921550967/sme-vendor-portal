export interface CourseRecord {
  id: string;
  class_id: string;
  class_name: string;
  school_name: string[];
  schedule_address: string;
  start_hour: string;
  duration: number;
  teachers: string[];
  student_count: number;
  category: string;
  /** 開課狀態（原始 API 欄位 latest_publish_status，常見值如 ok / pending / draft ...） */
  latest_publish_status: string;
  /** 請款狀態（原始 API 欄位 latest_completion_status） */
  latest_completion_status: string;
  updated_at?: string;
}

export type UserRole = "admin" | "manager" | "viewer";

export interface AuthRecord {
  gmail: string;
  vendor_name: string;
  role: UserRole;
  allowed_categories: string[] | "ALL";
  allowed_schools: string[] | "ALL";
  allowed_teachers: string[] | "ALL";
  status: string;
}

export interface UserInfo {
  email: string;
  vendor_name: string;
  role: UserRole;
  allowed_categories: string[] | "ALL";
}

export interface DashboardData {
  user: UserInfo;
  courses: CourseRecord[];
  show_student_count: boolean;
}

// Google Sheets API 回傳格式（按 category 分組）
export type ApiCourseResponse = Record<
  string,
  Omit<CourseRecord, "category" | "updated_at">[]
>;
