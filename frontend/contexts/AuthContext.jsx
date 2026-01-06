'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

    useEffect(() => {
        // Check for token on load
        const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (storedToken) {
            setToken(storedToken);
            fetchUser(storedToken);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async (authToken) => {
        try {
            const res = await fetch(`${API_BASE}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
            } else {
                localStorage.removeItem('token');
                setToken(null);
            }
        } catch (err) {
            console.error("Failed to fetch user", err);
            localStorage.removeItem('token');
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch(`${API_BASE}/auth/token`, {
            method: 'POST',
            body: formData,
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            setToken(data.access_token);
            await fetchUser(data.access_token);
            router.push('/dashboard');
            return { success: true };
        } else {
            return { success: false, error: 'Invalid credentials' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, token }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
