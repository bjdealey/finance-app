'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, registerAction, type AuthState } from '@/server/auth/actions';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const action = mode === 'login' ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});
  const isLogin = mode === 'login';

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="text-sm font-semibold uppercase tracking-widest text-primary">Finance OS</div>
        <h1 className="mt-2 text-2xl font-semibold">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-muted">
          See what your money should do next — with the reasoning shown.
        </p>
      </div>

      <form action={formAction} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        {!isLogin && (
          <Field label="Name" name="name" type="text" autoComplete="name" required />
        )}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
        />

        {state.error && (
          <p className="rounded-lg bg-neg/10 px-3 py-2 text-sm text-neg" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-fg transition disabled:opacity-60"
        >
          {pending ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        {isLogin ? (
          <>
            No account?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>

      {isLogin && (
        <p className="mt-6 rounded-lg border border-border bg-surface-2 px-3 py-2 text-center text-xs text-muted">
          Demo login — <span className="font-mono">demo@example.com</span> / <span className="font-mono">demo12345</span>
        </p>
      )}
    </div>
  );
}

function Field({ label, name, type, autoComplete, required }: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}
