import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

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
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },
});
