'use client';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';

export default function AppShell({ children }) {
  const { user } = useAuth();
  const pathname = usePathname();

  // Don't show sidebar on login page
  if (pathname === '/login') {
    return <AuthGuard>{children}</AuthGuard>;
  }

  return (
    <AuthGuard>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content fade-in">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
