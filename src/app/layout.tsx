import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppLayout } from "@/components/layout/app-layout";

export const metadata: Metadata = {
  title: "NIVA Mission Control",
  description: "Executive visibility platform for NIVA Health initiatives.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <QueryProvider>
          <AppLayout>{children}</AppLayout>
        </QueryProvider>
      </body>
    </html>
  );
}
