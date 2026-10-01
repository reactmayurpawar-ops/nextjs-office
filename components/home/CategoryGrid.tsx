'use client';

import { useQuery } from '@tanstack/react-query';
import type { FeaturedCategory } from '@/lib/cms';
import type { RestResponse } from '@/lib/types';
import { CategoryCard } from './CategoryCard';
import styles from './CategoryGrid.module.css';

async function fetchFeaturedCategories(): Promise<FeaturedCategory[]> {
  const res = await fetch('/api/v1/cms/featured-categories', { credentials: 'same-origin' });
  const body = (await res.json()) as RestResponse<FeaturedCategory[]>;
  if (!body.success || !body.data) {
    throw new Error(body.errorMessage ?? 'Failed to load categories');
  }
  return body.data;
}

/**
 * Featured-category grid. Pulls from the BFF (`/api/v1/cms/featured-categories`), which
 * emulates the Salesforce CMS managed-content path. Responsive 3 / 2 / 1 columns.
 */
export function CategoryGrid() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['featured-categories'],
    queryFn: fetchFeaturedCategories,
    // Self-heal if the upstream blips (e.g. during a dev hot-rebuild) without storming it.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 5 * 60 * 1000,
  });

  if (isPending) {
    return (
      <ul className={styles.grid} aria-busy="true" aria-label="Loading categories">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className={styles.cell}>
            <div className={styles.skeleton} />
          </li>
        ))}
      </ul>
    );
  }

  if (isError || !data?.length) {
    return <p className={styles.empty}>Categories are currently unavailable.</p>;
  }

  return (
    <ul className={styles.grid}>
      {data.map((category) => (
        <li key={category.id} className={styles.cell}>
          <CategoryCard category={category} />
        </li>
      ))}
    </ul>
  );
}
