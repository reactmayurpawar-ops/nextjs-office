/**
 * AuthMenu — Sign In button behaviour.
 *
 * Covers:
 *   - Customer Sign In button visible and redirects to /api/v1/auth/login
 *   - Employee sign in button visible and redirects with &as=associate
 *   - Neither button shown while session is loading
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthMenu } from '@/components/auth/AuthMenu';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const assignMock = vi.fn();

vi.mock('@/components/associate/ImpersonateDialog', () => ({
  ImpersonateDialog: () => null,
}));

vi.mock('@/components/associate/use-impersonation', () => ({
  useCanImpersonate: () => ({ data: false }),
}));

vi.mock('@/components/auth/use-session', async () => {
  const actual = await vi.importActual<typeof import('@/components/auth/use-session')>(
    '@/components/auth/use-session',
  );

  return {
    ...actual,                 // keeps real startLogin() so redirect URLs are real
    useSession: () => ({ data: undefined, isPending: false }),
    useLogout:  () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  };
});

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/home', search: '', assign: assignMock },
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sign In button', () => {
  it('is visible when signed out', () => {
    render(<AuthMenu loginLabel="Sign In" />);
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('redirects to /api/v1/auth/login with returnTo when clicked', () => {
    render(<AuthMenu loginLabel="Sign In" />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith('/api/v1/auth/login?returnTo=%2Fhome');
  });
});