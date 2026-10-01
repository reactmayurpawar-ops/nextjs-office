import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'accent';
type Size = 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<'button'>, 'className'> & { href?: undefined };
type ButtonAsLink = CommonProps & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function classes(variant: Variant, size: Size, extra?: string) {
  return [styles.btn, styles[variant], styles[size], extra].filter(Boolean).join(' ');
}

/**
 * Single source of truth for the Trane button styles (16px radius).
 * Renders an anchor (next/link) when `href` is provided, otherwise a <button>.
 */
export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', children, className } = props;
  const cls = classes(variant, size, className);

  if ('href' in props && props.href !== undefined) {
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props as ButtonAsButton;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
