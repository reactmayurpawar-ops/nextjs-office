/**
 * Role-based UI context tests — verifies user identity fields:
 *   ✓ FirstName & LastName
 *   ✓ Email
 *   ✓ Role
 *   ✓ AccountId
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import { handleCsoUser, csoUserSession } from '../../mocks/handlers/auth';
import { AuthMenu } from '@/components/auth/AuthMenu';

// ── MSW Lifecycle ─────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.mock('@/components/associate/ImpersonateDialog', () => ({
  ImpersonateDialog: () => null,
}));

vi.mock('@/components/associate/use-impersonation', () => ({
  useCanImpersonate: () => ({ data: false }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function renderAndOpenMenu() {
  server.use(handleCsoUser);
  renderWithClient(<AuthMenu loginLabel="Sign In" />);

  // Wait for user name to appear on trigger button
  await waitFor(() =>
    expect(screen.getByText('PCDIG12User React POC')).toBeInTheDocument(),
  );

  // Click trigger to open dropdown
  fireEvent.click(screen.getByText('PCDIG12User React POC'));
}

describe('User context and role display in UI', () => {
  const { user, role, effectiveAccountId } = csoUserSession.data;

  it('displays FirstName and LastName', async () => {
    await renderAndOpenMenu();
    expect(
      screen.getAllByText(`${user.firstName} ${user.lastName}`).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('displays email address', async () => {
    await renderAndOpenMenu();
    expect(screen.getByText(user.email)).toBeInTheDocument();
  });

  it('displays accountId context (Shopping for <companyName>)', async () => {
    await renderAndOpenMenu();
    expect(
      screen.getByText(`Shopping for ${user.companyName}`),
    ).toBeInTheDocument();
    expect(effectiveAccountId).toBe('001TEST000001ACME');
  });

  it('verifies authenticated user role is cso', () => {
    expect(role).toBe('cso');
  });
});
