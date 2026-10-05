/**
 * Role-based UI tests — acceptance criteria:
 *   ✓ Test Role Based UI
 *   ✓ React Component tests use MSW mocks of test users
 *
 * CSO (Customer Service Officer) role rules:
 *   ✓ Sees name + email + company in header
 *   ✓ Does NOT see "Act as a customer" button (CSA-only feature)
 *   ✓ Does NOT see sign-in buttons (already authenticated)
 *
 * MSW intercepts /api/v1/auth/session so the real useSession() hook runs.
 * No credentials, no Salesforce — purely in-process network interception.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from './mocks/server';
import { handleCsoUser, handleSignedOut } from './mocks/handlers';
import { AuthMenu } from '@/components/auth/AuthMenu';

// ── MSW lifecycle ─────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.mock('@/components/associate/ImpersonateDialog', () => ({
  ImpersonateDialog: () => null,
}));

// canImpersonate: false → simulates CSO (not CSA — CSA would have this true)
vi.mock('@/components/associate/use-impersonation', () => ({
  useCanImpersonate: () => ({ data: false }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderAndOpenMenu() {
  render(<AuthMenu loginLabel="Sign In" />);
  await waitFor(() =>
    expect(screen.getByText('PCDIG12 User')).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByText('PCDIG12 User'));
}

// ── CSO role UI tests ─────────────────────────────────────────────────────────

describe('Role: CSO — PCDIG12User', () => {
  beforeAll(() => server.use(handleCsoUser));

  describe('identity display', () => {
    it('shows the full name in the header trigger', async () => {
      render(<AuthMenu loginLabel="Sign In" />);
      await waitFor(() =>
        expect(screen.getByText('PCDIG12 User')).toBeInTheDocument(),
      );
    });

    it('shows email in the dropdown identity card', async () => {
      await renderAndOpenMenu();
      expect(screen.getByText('pcdig12user@test.pcdigires.com')).toBeInTheDocument();
    });

    it('shows company name in the dropdown identity card', async () => {
      await renderAndOpenMenu();
      expect(screen.getByText('Shopping for Acme HVAC Supply')).toBeInTheDocument();
    });
  });

  describe('CSO-specific access controls', () => {
    it('does NOT show "Act as a customer" button — that is CSA-only', async () => {
      await renderAndOpenMenu();
      expect(
        screen.queryByRole('menuitem', { name: /act as a customer/i }),
      ).not.toBeInTheDocument();
    });

    it('shows the Sign out button — available to all authenticated roles', async () => {
      await renderAndOpenMenu();
      expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    });

    it('does NOT show customer Sign In button — CSO is already authenticated', async () => {
      render(<AuthMenu loginLabel="Sign In" />);
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument(),
      );
    });
  });
});

// ── Signed-out baseline (control group) ──────────────────────────────────────

describe('Role: none (signed out) — control group', () => {
  beforeAll(() => server.use(handleSignedOut));

  it('shows Sign In button — confirming MSW role switch works correctly', async () => {
    render(<AuthMenu loginLabel="Sign In" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument(),
    );
  });

  it('does NOT show user name', async () => {
    render(<AuthMenu loginLabel="Sign In" />);
    await waitFor(() =>
      expect(screen.queryByText('PCDIG12 User')).not.toBeInTheDocument(),
    );
  });
});
