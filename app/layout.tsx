import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "2026 SME 開課廠商查詢",
  description: "2026中小企業開課廠商查詢入口",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-gray-50">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
