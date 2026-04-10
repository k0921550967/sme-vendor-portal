"use client";

import { signOut } from "next-auth/react";
import { UserInfo } from "@/types";

const roleLabel: Record<string, { text: string; color: string }> = {
  admin: { text: "管理員", color: "bg-purple-100 text-purple-700" },
  manager: { text: "管理者", color: "bg-green-100 text-green-700" },
  viewer: { text: "檢視者", color: "bg-gray-100 text-gray-600" },
};

export default function Header({ user }: { user: UserInfo }) {
  const role = roleLabel[user.role] ?? { text: user.role, color: "bg-gray-100 text-gray-600" };

  return (
    <header className="bg-brand-700 shadow-md">
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-wide">
            SME 廠商入口
          </span>
        </div>

        {/* Right: User info + logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            {/* 廠商名稱 + 角色標籤 + email 同一區塊 */}
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm leading-tight">
                {user.vendor_name}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${role.color}`}
              >
                {role.text}
              </span>
            </div>
            <span className="text-blue-200 text-xs leading-tight">
              {user.email}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-blue-200 hover:text-white border border-blue-400 hover:border-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            登出
          </button>
        </div>
      </div>
    </header>
  );
}
