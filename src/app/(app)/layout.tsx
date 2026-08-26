import { requireUser } from '@/server/auth/session';
import { AppHeader } from '@/components/nav';
import { CommandPalette } from '@/components/command-palette';
import { ToastProvider } from '@/components/toast';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <AppHeader userName={user.name} />
      <CommandPalette />
      <ToastProvider>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      </ToastProvider>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted sm:px-6">
        Financial planning suggestions and educational information — not regulated financial advice.
        No money is moved by this app.
      </footer>
    </div>
  );
}
