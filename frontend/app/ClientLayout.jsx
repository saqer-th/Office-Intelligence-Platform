'use client';
import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
    { href: "/outreach/board", label: "Status Board", icon: "📋" },
    { href: "/list", label: "All Offices", icon: "🏢" },
    { href: "/groups", label: "District Groups", icon: "🏘️" },
    { href: "/visits", label: "Visit lists", icon: "📍" },
    { href: "/messages", label: "Message Center", icon: "💬" },
    { href: "/outreach", label: "Batch Sender", icon: "📢" },
];

const SECONDARY_ITEMS = [
    { href: "/map", label: "Map View", icon: "🗺️" },
    { href: "/dashboard", label: "Analytics", icon: "📊" },
];

export default function ClientLayout({ children }) {
    const { user, loading, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // If on login page, don't show sidebar
    if (pathname === '/login') {
        return <div className="min-h-screen bg-sand">{children}</div>;
    }

    // Protect all other routes
    if (!loading && !user) {
        router.push('/login');
        return null; // Or a loading spinner
    }

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-sand text-muted">Loading...</div>;
    }

    const SidebarContent = () => (
        <>
            <div className="mb-8 px-2 mt-2 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold tracking-tight text-primary">OOMI-OS</h1>
                    <p className="text-xs text-muted">Market Intelligence v2.0</p>
                </div>
                {/* Close button for mobile */}
                <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-slate-800"
                >
                    ✕
                </button>
            </div>

            <nav className="space-y-1 flex-1 overflow-y-auto">
                <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted opacity-50 mb-2">Core Operations</p>
                {NAV_ITEMS.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${pathname === item.href ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
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
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${pathname === item.href ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <span className="text-lg">{item.icon}</span>
                        {item.label}
                    </Link>
                ))}

                {/* Admin Section */}
                {user?.role === 'Admin' && (
                    <>
                        <div className="my-6 border-t border-slate-100" />
                        <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted opacity-50 mb-2">Admin</p>
                        <Link
                            href="/admin/users"
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${pathname === '/admin/users' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                        >
                            <span className="text-lg">👥</span>
                            User Management
                        </Link>
                    </>
                )}
            </nav>

            <div className="mt-auto border-t border-slate-100 p-4">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 text-xs rounded-full bg-slate-200 flex items-center justify-center font-bold">
                        {user ? (user.name ? user.name.slice(0, 2).toUpperCase() : 'US') : 'G'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate">{user ? user.name : 'Guest'}</p>
                        <p className="text-xs text-muted truncate">{user ? user.role : 'Read Only'}</p>
                    </div>
                    {user && (
                        <button onClick={logout} className="text-xs text-red-500 hover:text-red-700">Logout</button>
                    )}
                    {!user && (
                        <Link href="/login" className="text-xs text-blue-500 hover:text-blue-700">Login</Link>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 flex-col border-r border-black/5 bg-panel p-4 lg:flex">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
                    <aside className="fixed inset-y-0 left-0 w-64 bg-white p-4 shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <header className="flex h-16 items-center justify-between border-b border-black/5 bg-panel lg:hidden px-4">
                    <div className="font-bold flex items-center gap-3">
                        <button onClick={() => setMobileMenuOpen(true)} className="p-1 -ml-1 text-slate-600">
                            <span className="text-xl">☰</span>
                        </button>
                        OOMI-OS
                    </div>
                </header>

                <main className="flex-1 overflow-auto bg-sand p-4 lg:p-8">
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
