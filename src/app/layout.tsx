import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "DMS — Database Management System", template: "%s · DMS" },
  description: "A focused PostgreSQL administration workspace for exploring, querying, and monitoring databases.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col"><Providers>{children}</Providers></body>
    </html>
  );
}
