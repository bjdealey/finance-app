import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { AuthForm } from '@/components/auth-form';

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/dashboard');
  return <AuthForm mode="login" />;
}
