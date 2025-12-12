import type { Metadata } from "next";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import AppFrame from "@/components/app-frame";

export const metadata: Metadata = {
  title: "My App",
  description: "Thirdweb external wallet login",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThirdwebProvider>
          <AppFrame>{children}</AppFrame>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
