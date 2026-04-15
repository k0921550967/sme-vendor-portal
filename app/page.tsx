import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import CredentialsLoginForm from "@/components/CredentialsLoginForm";
import GoogleLoginButton from "@/components/GoogleLoginButton";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md flex flex-col items-center gap-6">
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-brand-700 flex items-center justify-center">
            <svg
              className="w-9 h-9 text-white"
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
          <h1 className="text-2xl font-bold text-gray-900">115年AI財會課程開課規劃</h1>
          <p className="text-gray-500 text-sm text-center">
            請使用授權帳號登入以查詢課程資料
          </p>
        </div>

        {/* 帳號密碼登入（Client Component） */}
        <CredentialsLoginForm />

        {/* 分隔線 */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">或使用Google帳號登入</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Google 登入 */}
        <form
          className="w-full"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <GoogleLoginButton />
        </form>



        <p className="text-xs text-gray-400">僅限授權廠商帳號使用</p>
      </div>
    </main>
  );
}
