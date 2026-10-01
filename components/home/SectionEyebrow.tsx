import styles from './SectionEyebrow.module.css';

/** Small red eyebrow label above a section title (e.g. "SHOP"). */
export function SectionEyebrow({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className={styles.wrap}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2 className={styles.title}>{title}</h2>
    </div>
  );
}
