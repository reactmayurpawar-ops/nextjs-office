import { Footer } from '@/components/layout/Footer';
import { HeaderShell } from '@/components/layout/HeaderShell';
import { ProductDetailPage } from '@/components/catalog/product/ProductDetailPage';
import { footerConfig } from '@/content/footer';
import { navigation } from '@/content/navigation';
import { siteConfig } from '@/content/site.config';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <HeaderShell config={siteConfig} navItems={navigation} />
      <main className="flex flex-grow flex-col">
        <ProductDetailPage id={id} />
      </main>
      <Footer config={footerConfig} />
    </>
  );
}




