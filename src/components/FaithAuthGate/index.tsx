import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface FaithAuthGateProps {
  children: ReactNode;
}

// Faith data now lives in Supabase (see README "Setting up Supabase"), so
// this tab specifically needs a signed-in session — unlike the rest of the
// public site, which stays unauthenticated. Mirrors running-faith-mobile's
// AuthGate; one combined sign-in/sign-up form is enough for a single-user
// personal project, not a general multi-user auth flow.
const FaithAuthGate = ({ children }: FaithAuthGateProps) => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const { error: authError } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (authError) setError(authError.message);
  };

  if (session === undefined) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Loading…
        </p>
      </div>
    );
  }

  if (session === null) {
    return (
      <div
        className="mx-auto w-full max-w-sm rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h2
          className="mb-1 text-base font-bold"
          style={{ color: 'var(--color-text)' }}
        >
          Sign in
        </h2>
        <p
          className="mb-5 text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Faith activities sync through your own Supabase project — sign in to
          log or view them.
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoCapitalize="none"
          className="mb-3 w-full rounded-xl px-4 py-2.5 text-sm"
          style={{
            backgroundColor: 'var(--color-card-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mb-4 w-full rounded-xl px-4 py-2.5 text-sm"
          style={{
            backgroundColor: 'var(--color-card-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />

        {error && (
          <p className="mb-3 text-xs" style={{ color: '#ff6b6b' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !email || !password}
          className="mb-4 w-full rounded-full py-3 text-sm font-bold disabled:opacity-40"
          style={{
            backgroundColor: 'var(--color-brand)',
            color: 'var(--color-background)',
          }}
        >
          {submitting
            ? 'Please wait…'
            : mode === 'sign-in'
              ? 'Sign in'
              : 'Create account'}
        </button>

        <button
          onClick={() =>
            setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'))
          }
          className="w-full text-center text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {mode === 'sign-in'
            ? 'First time here? Create an account'
            : 'Already have an account? Sign in'}
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default FaithAuthGate;
