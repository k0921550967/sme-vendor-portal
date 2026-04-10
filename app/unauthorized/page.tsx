import { signOut } from "@/auth";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md flex flex-col items-center gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">無存取權限</h1>
          <p className="text-gray-500 text-sm">
            您的帳號未在授權名單中，或帳號狀態為停用。
            <br />
            請聯繫管理員取得存取權限。
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="px-6 py-2 rounded-lg bg-brand-700 text-white font-medium hover:bg-brand-800 transition-colors cursor-pointer"
          >
            登出並返回首頁
          </button>
        </form>
      </div>
    </main>
  );
}
