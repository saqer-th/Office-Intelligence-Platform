import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "OOMI-OS",
  description: "Operational System for Office Outreach",
};

const NAV_ITEMS = [
  { href: "/outreach/board", label: "Status Board", icon: "📋" },
  { href: "/list", label: "All Offices", icon: "🏢" },
  { href: "/groups", label: "District Groups", icon: "🏘️" },
  { href: "/visits", label: "Visit lists", icon: "📍" }, // Updating Label too as user requested persistent lists
  { href: "/messages", label: "Message Center", icon: "💬" },
  { href: "/outreach", label: "Batch Sender", icon: "📢" },
];

const SECONDARY_ITEMS = [
  { href: "/map", label: "Map View", icon: "🗺️" },
  { href: "/dashboard", label: "Analytics", icon: "📊" },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-sand text-ink antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden w-64 flex-col border-r border-black/5 bg-panel p-4 lg:flex">
            <div className="mb-8 px-2 mt-2">
              <h1 className="text-lg font-bold tracking-tight text-primary">OOMI-OS</h1>
              <p className="text-xs text-muted">Market Intelligence v2.0</p>
            </div>

            <nav className="space-y-1 flex-1">
              <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted opacity-50 mb-2">Core Operations</p>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              <div className="my-6 border-t border-slate-100" />

              <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted opacity-50 mb-2">Tools</p>
              {SECONDARY_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto border-t border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 text-xs rounded-full bg-slate-200 flex items-center justify-center font-bold">SA</div>
                <div>
                  <p className="text-sm font-medium">Saqer Al Saqri</p>
                  <p className="text-xs text-muted">Admin Workspace</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-16 items-center justify-between border-b border-black/5 bg-panel lg:hidden px-4">
              <div className="font-bold">OOMI-OS</div>
              {/* Mobile Menu Trigger would go here */}
            </header>

            <main className="flex-1 overflow-auto bg-sand p-4 lg:p-8">
              <div className="mx-auto max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
