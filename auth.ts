import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";

// 完整版 NextAuth：在 Edge-safe 設定之上，加入需要 Node runtime 的 Credentials provider
// （會動態 import googleapis 與 bcryptjs，只在 API route / server action 被呼叫）
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "帳號（Email）", type: "email" },
        password: { label: "密碼", type: "password" },
      },
      async authorize(credentials) {
        // 基本防暴力：固定延遲 1 秒
        await new Promise((r) => setTimeout(r, 1000));

        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // 動態 import 避免 webpack 把 googleapis 打包進 client / edge bundle
        const { verifyCredentials } = await import("@/lib/google-sheets");
        const result = await verifyCredentials(email, password).catch(() => null);
        if (!result) return null;

        return { id: result.email, email: result.email };
      },
    }),
  ],
});
