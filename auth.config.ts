import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// 擴充 NextAuth Session 型別，支援 loginTime 時間戳記
declare module "next-auth" {
  interface Session {
    loginTime?: number;
  }
}

// Edge-safe 設定：只放可在 Edge Runtime 執行的 providers 與 callbacks
// 供 middleware.ts 使用，避免把 googleapis / bcryptjs 打包進 middleware bundle
export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
      session.loginTime = token.loginTime as number | undefined;
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.loginTime = Date.now();
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
