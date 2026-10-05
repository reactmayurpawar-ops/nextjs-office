/**
 * LoginButton (AuthMenu sign-in state) — tested with MSW test users.
 *
 * Acceptance criteria:
 *   ✓ Test login component with Test Users
 *   ✓ React Component tests use MSW mocks of test users
 *
 * MSW intercepts GET /api/v1/auth/session at the network level so the real
 * useSession() hook runs — no manual mocking of hooks needed.
 *
 * Test user: PCDIG12User (CSO) — maps to E2E_TEST_USERNAME env var but
 * uses MSW, so no real credentials are ever needed in unit tests.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from './mocks/server';
import { handleCsoUser, handleSignedOut } from './mocks/handlers';
import { AuthMenu } from '@/components/auth/AuthMenu';

// ── MSW server lifecycle ──────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());   // isolate per-test overrides
afterAll(() => server.close());

// ── Browser nav mock ──────────────────────────────────────────────────────────

const assignMock = vi.fn();
Object.defineProperty(window, 'location', {
  configurable: true,
  value: { pathname: '/home', search: '', assign: assignMock },
});

// ── Mock associate-only deps (not relevant for login button tests) ─────────────

vi.mock('@/components/associate/ImpersonateDialog', () => ({
  ImpersonateDialog: () => null,
}));
vi.mock('@/components/associate/use-impersonation', () => ({
  useCanImpersonate: () => ({ data: false }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginButton — signed-out state (default MSW handler)', () => {
  it('shows the Sign In button when no session exists (401 from BFF)', async () => {
    // Default handler returns 401 (signed out)
    render(<AuthMenu loginLabel="Sign In" />);

    // Wait for useSession() to resolve the 401 and render the sign-in button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });
  });

  it('redirects to /api/v1/auth/login with returnTo when Sign In is clicked', async () => {
    render(<AuthMenu loginLabel="Sign In" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(assignMock).toHaveBeenCalledWith('/api/v1/auth/login?returnTo=%2Fhome');
  });

  it('shows the Employee sign in button', async () => {
    render(<AuthMenu loginLabel="Sign In" />);
    await waitFor(() =>
      expect(screen.getByText('Employee sign in')).toBeInTheDocument(),
    );
  });

  it('redirects with &as=associate when Employee sign in is clicked', async () => {
    render(<AuthMenu loginLabel="Sign In" />);

    await waitFor(() =>
      expect(screen.getByText('Employee sign in')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('Employee sign in'));
    expect(assignMock).toHaveBeenCalledWith(
      '/api/v1/auth/login?returnTo=%2Fhome&as=associate',
    );
  });
});

describe('LoginButton — PCDIG12User (CSO) signed in via MSW', () => {
  beforeAll(() => {
    // Override the default 401 handler with the CSO user session
    server.use(handleCsoUser);
  });

  it('does not show Sign In button when CSO user is authenticated', async () => {
    render(<AuthMenu loginLabel="Sign In" />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument(),
    );
  });

  it('shows the CSO user name in the header trigger', async () => {
    render(<AuthMenu loginLabel="Sign In" />);
    await waitFor(() =>
      expect(screen.getByText('PCDIG12 User')).toBeInTheDocument(),
    );
  });
});
