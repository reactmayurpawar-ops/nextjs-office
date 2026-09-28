import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthMenu } from '@/components/auth/AuthMenu';

const assignMock = vi.fn();

vi.mock('@/components/associate/ImpersonateDialog', () => ({
  ImpersonateDialog: () => null,
}));

vi.mock('@/components/associate/use-impersonation', () => ({
  useCanImpersonate: () => ({
    data: false,
  }),
}));

vi.mock('@/components/auth/use-session', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/auth/use-session')
  >('@/components/auth/use-session');

  return {
    ...actual,
    useSession: () => ({
      data: undefined,
      isPending: false,
    }),
    useLogout: () => ({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    }),
  };
});

describe('test Sign In button', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/home',
        search: '',
        assign: assignMock,
      },
    });
  });

  it('checking Sign In button is visible or not', () => {
    render(<AuthMenu loginLabel="Sign In" />);

    expect(
      screen.getByRole('button', {
        name: "Sign In",
      })
    ).toBeInTheDocument();
  });

  it('redirects to login url when Sign In is clicked', () => {
    render(<AuthMenu loginLabel="Sign In" />);

    fireEvent.click(
      screen.getByRole('button', {
        name: "Sign In",
      })
    );

    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith(
      '/api/v1/auth/login?returnTo=%2Fhome'
    );
  });
});
