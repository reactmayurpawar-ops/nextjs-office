import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'link';
type Size = 'default' | 'tight';
interface CommonProps {
  children: ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
}
type CatalogButtonProps = CommonProps &
  (
    | ({ href: string; download?: string } & Omit<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        'className' | 'href' | 'children'
      >)
    | ({ href?: never } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>)
  );
function buttonClass(variant: Variant, size: Size, extra?: string): string {
  const base =
    variant === 'link'
      ? 'inline-flex items-center gap-2 text-sm text-brand-primary underline decoration-1 underline-offset-2 hover:text-brand-tertiary hover:no-underline'
      : 'inline-flex items-center justify-center rounded-[2px] border-2 px-6 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:border-brand-gray-400 disabled:bg-brand-gray-400 disabled:text-white';
  const color =
    variant === 'primary'
      ? 'border-brand-primary bg-brand-primary text-white hover:border-brand-tertiary hover:bg-brand-tertiary'
      : variant === 'secondary'
        ? 'border-brand-primary bg-white text-brand-primary hover:border-brand-gray-300 hover:bg-brand-gray-300'
        : '';
  const spacing = size === 'tight' && variant !== 'link' ? 'px-7 py-1' : '';
  return [base, color, spacing, extra].filter(Boolean).join(' ');
}
export function CatalogButton({
  children,
  className,
  variant = 'primary',
  size = 'default',
  ...props
}: CatalogButtonProps) {
  const classes = buttonClass(variant, size, className);
  if ('href' in props && props.href) {
    const { href, ...anchorProps } = props;
    if (/^https?:/.test(href) || href.startsWith('data:')) {
      return (
        <a href={href} className={classes} {...anchorProps}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    );
  }
  const buttonProps = props as Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'className' | 'children'
  >;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
