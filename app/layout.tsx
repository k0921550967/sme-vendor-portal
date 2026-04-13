import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "115年AI財會課程開課規劃",
  description: "115年AI財會課程開課規劃",
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
