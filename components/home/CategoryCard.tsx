import Image from 'next/image';
import Link from 'next/link';
import type { FeaturedCategory } from '@/lib/cms';
import styles from './CategoryCard.module.css';

export function CategoryCard({ category }: { category: FeaturedCategory }) {
  return (
    <Link href={category.href} className={styles.card}>
      <div className={styles.imageWrap}>
        <Image
          src={category.imageUrl}
          alt={category.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 900px) 50vw, 33vw"
          className={styles.image}
        />
      </div>
      <span className={styles.label}>{category.title}</span>
    </Link>
  );
}
