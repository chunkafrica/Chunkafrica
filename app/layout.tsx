import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { ActiveStoreProvider } from "@/lib/store-context";

export const metadata: Metadata = {
  title: "Chunk v2",
  description: "Operations system for production businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full text-ink antialiased">
        <ActiveStoreProvider>
          <div className="min-h-screen">
            <Sidebar />
            <main className="px-4 py-6 sm:px-6 lg:min-h-screen lg:pl-[19rem] lg:pr-8 lg:pt-8">
              <div className="mx-auto max-w-7xl">{children}</div>
            </main>
          </div>
        </ActiveStoreProvider>
      </body>
    </html>
  );
}
