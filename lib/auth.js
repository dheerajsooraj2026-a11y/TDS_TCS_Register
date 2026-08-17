'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const login = async (email, password) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing in this environment. Please configure them in your Vercel Project Settings and redeploy.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch failed')) {
        throw new Error('Unable to connect to Supabase server. Please check your internet connection or Supabase URL configuration.');
      }
      throw error;
    }
    return data;
  };

  const register = async (email, password) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing in this environment. Please configure them in your Vercel Project Settings and redeploy.');
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch failed')) {
        throw new Error('Unable to connect to Supabase server. Please check your internet connection or Supabase URL configuration.');
      }
      throw error;
    }
    return data;
  };

  const logout = async () => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const verifyPassword = async (password) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured in this environment.');
    }
    if (!user?.email) {
      throw new Error('No user is currently logged in.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (error) {
      if (
        error.message?.toLowerCase().includes('invalid login credentials') ||
        error.message?.toLowerCase().includes('invalid credentials')
      ) {
        throw new Error('Incorrect password. Deletion unauthorized.');
      }
      throw error;
    }
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, verifyPassword, isConfigured: isSupabaseConfigured() }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

