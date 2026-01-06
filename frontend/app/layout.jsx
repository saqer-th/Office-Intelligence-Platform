import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import ClientLayout from "./ClientLayout";

export const metadata = {
  title: "OOMI-OS",
  description: "Operational System for Office Outreach",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-sand text-ink antialiased">
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
