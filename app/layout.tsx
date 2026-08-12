import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Knowledge Stream",
  description: "A focused view of your tasks and activity.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full flex flex-col">{children}</body></html>;
}
