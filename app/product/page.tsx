import { Footer } from '@/components/layout/Footer';
import { HeaderShell } from '@/components/layout/HeaderShell';
import { SearchPage } from '@/components/catalog/search/SearchPage';
import { footerConfig } from '@/content/footer';
import { navigation } from '@/content/navigation';
import { siteConfig } from '@/content/site.config';

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function ProductListingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      <HeaderShell config={siteConfig} navItems={navigation} />
      <main className="flex flex-grow flex-col">
        <SearchPage
          initialQuery={first(params.q ?? params.query)}
          initialCategory={first(params.category)}
        />
      </main>
      <Footer config={footerConfig} />
    </>
  );
}
