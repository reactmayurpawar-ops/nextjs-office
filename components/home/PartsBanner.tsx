import { Button } from '@/components/ui/Button';
import styles from './PartsBanner.module.css';

interface PartsBannerProps {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  backgroundSrc: string;
}

/** Full-width image banner with white copy and a red CTA. */
export function PartsBanner({ title, body, ctaLabel, ctaHref, backgroundSrc }: PartsBannerProps) {
  return (
    <section
      className={styles.banner}
      style={{ backgroundImage: `url(${backgroundSrc})` }}
      aria-label={title}
    >
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.body}>{body}</p>
        <Button href={ctaHref} variant="accent" size="lg">
          {ctaLabel}
        </Button>
      </div>
    </section>
  );
}
