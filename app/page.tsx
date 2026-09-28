import { HeaderShell } from '@/components/layout/HeaderShell';
import { Footer } from '@/components/layout/Footer';
import { SectionEyebrow } from '@/components/home/SectionEyebrow';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { PartsBanner } from '@/components/home/PartsBanner';
import { siteConfig } from '@/content/site.config';
import { navigation } from '@/content/navigation';
import { footerConfig } from '@/content/footer';
import styles from './page.module.css';
import { redis } from '@/lib/redis';

/**
 * Homepage — Trane Supply styling with uatstore content/layout. Server
 * component: imports static config and passes it to presentational sections.
 */
export default async function HomePage() {





  await redis.set(
    `session:123`,
    JSON.stringify({
      "name": "kamlesh",
      "age": 45,
    }),
  );

  const session = await redis.get(`session:123`);

  if (session) {
    const data = JSON.parse(session);
    console.log(data.name);
  }
  return (
    <>


      <HeaderShell config={siteConfig} navItems={navigation} />

      <main className={styles.main}>
        <section className={`ts-container ${styles.shop}`}>
          <SectionEyebrow eyebrow="Shop" title="HVAC Equipment and Accessories" />
          <CategoryGrid />
        </section>

        <PartsBanner
          title="Parts and Supply"
          body="Explore and buy parts and supplies, discover our Trane Supply programs, learn how to become a Trane Supply customer, and much more."
          ctaLabel="Get Started Now"
          ctaHref="/parts-and-supply"
          backgroundSrc="/images/parts-banner.svg"
        />
      </main>

      <Footer config={footerConfig} />
    </>
  );
}
