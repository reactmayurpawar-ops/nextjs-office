import Link from 'next/link';
import { CatalogButton } from '../CatalogButton';
import { ProductImage } from '../ProductImage';
import { LiteratureCTA, UnitPartsCTA } from './ctas';
import { PriceSkeleton, QuantitySkeleton } from '../Loading';
import type { ProductSummary } from '@/lib/types';

function formatPrice(product: ProductSummary): string {
  if (product.price === 0) return 'Call Your Local Sales Office for Information';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: product.currencyCode,
  }).format(product.price as number);
}

/**
 * `pending` matters: price arrives in a second request after the card has rendered, and
 * "Price not available" is a statement about the ERP that is false while the call is still
 * in flight.
 *
 * Discontinued is checked first and ignores `pending`, because `status` comes from the
 * catalogue record that is already here — only `discontinued` waits on the ERP.
 */
function Price({ product, pending }: { product: ProductSummary; pending: boolean }) {
  if (product.discontinued || product.status === 'discontinued') return <>Item Discontinued</>;
  if (product.price === null) return pending ? <PriceSkeleton /> : <>Price not available</>;
  return <>{formatPrice(product)}</>;
}

function Quantity({ product, pending }: { product: ProductSummary; pending: boolean }) {
  if (product.availableQuantity !== null) return <strong>{product.availableQuantity}</strong>;
  return pending ? <QuantitySkeleton /> : <strong>n/a</strong>;
}

function ReplacementBadges({ product }: { product: ProductSummary }) {
  return (
    <>
      {product.hasSupersession && (
        <span className="rounded-sm bg-brand-gray-300 px-2 py-1.5 text-[10px] leading-none text-black">
          Supersession Available
        </span>
      )}
      {product.hasSubstitution && (
        <span className="rounded-sm bg-brand-gray-300 px-2 py-1.5 text-[10px] leading-none text-black">
          Substitutions Available
        </span>
      )}
    </>
  );
}

export function ProductCard({
  product,
  pricePending = false,
  onCategorySelect,
}: {
  product: ProductSummary;
  /** True while the separate pricing request is still in flight. */
  pricePending?: boolean;
  onCategorySelect?: (categoryId: string) => void;
}) {
  const href = `/product/${encodeURIComponent(product.id)}`;
  return (
    <article className="my-4 flex w-full flex-col items-center rounded border border-solid border-brand-gray-200 px-4 py-4 shadow-card-shadow sm:flex-row sm:items-stretch">
      <Link
        href={href}
        className="flex shrink-0 items-center justify-center"
        aria-label={product.name}
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="mr-4 h-[150px] w-[180px]"
        />
      </Link>
      <div className="flex min-w-0 w-full flex-col">
        <div className="flex items-start justify-between gap-4 text-xl font-semibold">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link className="break-words text-brand-primary hover:text-brand-tertiary" href={href}>
              {product.name.replace('*', '').trim()}
            </Link>
            <ReplacementBadges product={product} />
          </div>
          <div className="hidden shrink-0 text-black xl:block">
            <Price product={product} pending={pricePending} />
          </div>
        </div>

        <div className="flex justify-between gap-4 text-sm">
          <button
            type="button"
            className="text-left text-brand-primary underline underline-offset-2 hover:text-brand-tertiary hover:no-underline"
            onClick={() => onCategorySelect?.(product.category.id)}
          >
            {product.category.name}
          </button>
          <div className="hidden text-black xl:block">
            Available Qty in your Area: <Quantity product={product} pending={pricePending} />
          </div>
        </div>

        <div className="mt-4 text-xl font-semibold text-black xl:hidden">
          <Price product={product} pending={pricePending} />
        </div>
        <div className="text-sm text-black xl:hidden">
          Available Qty in your Area: <Quantity product={product} pending={pricePending} />
        </div>

        <p className="my-4 text-sm text-black">{product.description}</p>
        {product.availabilityMessage && !product.available && (
          <p className="mb-4 text-sm font-semibold text-brand-gray-600">
            {product.availabilityMessage}
          </p>
        )}

        <div className="mt-auto hidden items-center justify-between gap-4 text-sm xl:flex">
          <div className="flex flex-wrap items-center gap-4">
            {product.hasUnitPartsList && <UnitPartsCTA model={product.sku} />}
            <LiteratureCTA product={product.sku} />
          </div>
          <CatalogButton href={`${href}#availability`} size="tight">
            View Availability
          </CatalogButton>
        </div>

        <details className="group mt-auto xl:hidden">
          <summary className="-mx-4 flex cursor-pointer list-none items-center justify-center border-t border-brand-gray-200 p-4 pb-0 text-brand-primary">
            More Details <span className="ml-2 group-open:rotate-180">⌄</span>
          </summary>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {product.hasUnitPartsList && <UnitPartsCTA model={product.sku} />}
            <LiteratureCTA product={product.sku} />
            <CatalogButton href={`${href}#availability`} className="col-span-2 w-full">
              View Availability
            </CatalogButton>
          </div>
        </details>
      </div>
    </article>
  );
}
