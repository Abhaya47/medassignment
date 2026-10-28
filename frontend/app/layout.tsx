// first/app/layout.tsx  (same folder as page.tsx)
import type { ReactNode } from "react";

export const metadata = {
  title: "Lab test bundle finder",
  description: "Find the cheapest way to book your lab tests",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}