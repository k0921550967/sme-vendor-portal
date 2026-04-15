import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

// 擴充 NextAuth 型別，讓 session/token 支援 isNewLogin 旗標
declare module "next-auth" {
  interface Session {
    isNewLogin?: boolean;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    isNewLogin?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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

        // 動態 import 避免 webpack 把 googleapis 打包進 client bundle
        const { verifyCredentials } = await import("@/lib/google-sheets");
        const result = await verifyCredentials(email, password).catch(() => null);
        if (!result) return null;

        return { id: result.email, email: result.email };
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      // 將「全新登入」旗標傳入 session
      session.isNewLogin = token.isNewLogin ?? false;
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        // account 只在剛登入時存在，後續 refresh 為 undefined
        token.accessToken = account.access_token;
        token.isNewLogin = true;
      } else {
        // 第二次以後（頁面 refresh）清除旗標
        token.isNewLogin = false;
      }
      return token;
    },
  },
});
