"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function AdminUsersPage() {
    const { token, user } = useAuth();
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("Operator");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Optional: Fetch list of users if we had a GET /users endpoint (admin only)
    // For now, just a creation form.

    const handleCreate = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");

        if (!token) return;

        try {
            const base = API_BASE_URL || "http://localhost:8000";
            const res = await fetch(`${base}/users`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ email, name, password, role })
            });

            if (res.ok) {
                setMessage("User created successfully!");
                setEmail("");
                setName("");
                setPassword("");
                setRole("Operator");
            } else {
                const err = await res.json();
                setError(err.detail || "Failed to create user");
            }
        } catch (e) {
            setError("Error creating user");
        }
    };

    if (!user || user.role !== 'Admin') {
        return <div className="p-8 text-center text-red-500">Access Denied. Admins only.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto py-12">
            <h1 className="text-2xl font-bold text-ink mb-2">Admin User Management</h1>
            <p className="text-muted mb-8">Create new accounts for team members.</p>

            <div className="bg-white p-6 rounded-xl border border-border shadow-sm">
                <h2 className="text-lg font-semibold mb-6">Create New User</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                            <option value="Operator">Operator (Standard)</option>
                            <option value="Admin">Admin (Full Access)</option>
                        </select>
                    </div>

                    {message && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{message}</div>}
                    {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
                        >
                            Create User
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
