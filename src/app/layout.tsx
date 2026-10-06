import { ActionNotifications } from "@/components/ui/action-notifications";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/shell/theme-provider";
import "./globals.css";
import "./orbit-design.css";
export const metadata: Metadata = {
  title: { default: "Orbit — Your academic space", template: "%s · Orbit" },
  description: "Your private academic workspace.",
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ActionNotifications>{children}</ActionNotifications>
        </ThemeProvider>
      </body>
    </html>
  );
}
