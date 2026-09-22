import axios from 'axios';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type Worker = {
  id: number;
  name: string;
  role: string;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  worker: Worker | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureCsrfCookie() {
  await axios.get('/sanctum/csrf-cookie', { withCredentials: true });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await ensureCsrfCookie();
        const { data } = await axios.get<AuthUser>('/api/v1/me', { withCredentials: true, withXSRFToken: true });
        setUser(data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      await ensureCsrfCookie();
      const { data } = await axios.post<AuthUser>(
        '/api/v1/login',
        { email, password },
        { withCredentials: true, withXSRFToken: true },
      );
      setUser(data);
    } catch (err) {
      setError('Correo o contraseña incorrectos.');
      throw err;
    }
  };

  const logout = async () => {
    await axios.post('/api/v1/logout', {}, { withCredentials: true, withXSRFToken: true });
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, error, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
