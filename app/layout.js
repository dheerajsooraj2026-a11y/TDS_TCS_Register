import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'TDS/TCS Register – Tax Deduction Management',
  description: 'Personal TDS/TCS register for managing tax deductions, challans, and generating monthly reports.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
