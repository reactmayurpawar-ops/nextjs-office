/**
 * Loading placeholders for content that arrives after its page has rendered.
 *
 * Price and availability come from the ERP gateways in a second request, so a card or a
 * detail page paints with those fields still empty. A shimmering block of roughly the right
 * size says "a number is coming" — where the alternatives both lie. Blank space reads as
 * "this product has no price", and "Price not available" is a claim about the ERP that is
 * simply false while the call is still in flight.
 *
 * Sized in the same units as the text they stand in for, so nothing jumps when the real
 * value lands.
 */

/** A shimmering block. `aria-hidden` because the live region announces the wait instead. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded bg-brand-gray-200 align-middle ${className}`}
    />
  );
}

/** Price-sized placeholder. */
export function PriceSkeleton() {
  return <Skeleton className="h-6 w-28" />;
}

/** Quantity-sized placeholder, to sit inline in "Available Qty: __". */
export function QuantitySkeleton() {
  return <Skeleton className="h-4 w-8" />;
}

/**
 * Stand-in for a detail page that has not arrived.
 *
 * Mirrors the Hero: square image, title, category link, a right-aligned price and quantity,
 * a paragraph of description and the collapsed disclosure rows beneath. Same reasoning as
 * `ResultsSkeleton` — the real content replaces these in place, so the page does not jump
 * when it lands, which a centred spinner guarantees it will.
 */
export function DetailSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1406px] flex-grow px-4 sm:px-8 lg:px-16 xl:px-20"
      role="status"
      aria-label="Loading product"
    >
      <section className="my-4 flex flex-col gap-8 sm:my-16 sm:flex-row">
        <Skeleton className="h-[240px] w-[240px] shrink-0" />
        <div className="flex w-full min-w-0 flex-col gap-2">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </section>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="my-2 flex items-center justify-between border border-brand-gray-200 p-4"
        >
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-5" />
        </div>
      ))}
    </div>
  );
}

/**
 * Stand-in rows for a listing that has not arrived.
 *
 * Shaped like the cards that replace them so the page does not reflow when results land —
 * a spinner alone would collapse the layout and then shove the header up the screen.
 */
export function ResultsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading products">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="my-4 flex w-full flex-col items-center gap-4 rounded border border-solid border-brand-gray-200 px-4 py-4 shadow-card-shadow sm:flex-row sm:items-stretch"
        >
          <Skeleton className="h-[120px] w-[120px] shrink-0" />
          <div className="flex w-full min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-24 shrink-0" />
            </div>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
