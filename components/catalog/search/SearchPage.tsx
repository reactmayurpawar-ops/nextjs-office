'use client';
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CatalogButton } from '../CatalogButton';
import { ModelCard } from '../cards/ModelCard';
import { ProductCard } from '../cards/ProductCard';
import { SerialSilCard } from '../cards/SerialSilCard';
import { ActiveFacets } from './ActiveFacets';
import { FacetSidebar } from './FacetSidebar';
import { FilterModal } from './FilterModal';
import { Pagination } from './Pagination';
import { ResultsSkeleton } from '../Loading';
import { CatalogApiError, fetchPricing, searchProducts } from '@/lib/catalog-api';
import { mergeSearchPricing } from '@/lib/catalog';
import type { SearchRequest } from '@/lib/types';
const DEFAULT_REQUEST: Omit<SearchRequest, 'query'> = {
  facets: {},
  page: 1,
  pageSize: 10,
  sort: 'relevance',
  availableOnly: false,
  activeOnly: true,
};
function SearchTips() {
  return (
    <div className="flex flex-col">
      <div className="mb-4 font-secondary font-bold">Search Tips</div>
      <ol className="list-inside list-decimal">
        <li>Check your spelling</li>
        <li>Use a different keyword</li>
        <li>Broaden your search</li>
      </ol>
    </div>
  );
}
export function SearchPage({
  initialQuery,
  initialCategory,
}: {
  initialQuery: string;
  initialCategory: string;
}) {
  const router = useRouter();
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [request, setRequest] = useState<SearchRequest>({
    ...DEFAULT_REQUEST,
    query: initialQuery,
    facets: initialCategory ? { category: [initialCategory] } : {},
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const result = useQuery({
    queryKey: ['catalog-search', request],
    queryFn: () => searchProducts(request),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  /**
   * Pricing is a second, independent request.
   *
   * The ERP gateways cannot be asked until search has returned the SKUs, so folding this into
   * /api/v1/search made the listing wait for both upstreams before painting anything —
   * roughly 570 ms of search plus 1440 ms of P21. Now the cards render as soon as search
   * lands and the prices arrive after. Keyed by the SKUs rather than by the request so paging
   * back to a page whose prices are already cached re-uses them.
   */
  const skus = useMemo(
    () => (result.data?.products ?? []).map((product) => product.sku),
    [result.data],
  );
  const sources = useMemo(
    () =>
      Object.fromEntries(
        (result.data?.products ?? []).map((product) => [
          product.sku,
          product.orderingSources?.length ? product.orderingSources : [product.orderingSource],
        ]),
      ),
    [result.data],
  );
  const prices = useQuery({
    queryKey: ['catalog-pricing', skus],
    queryFn: () => fetchPricing(skus, sources),
    enabled: skus.length > 0,
    // Matches the server-side ERP cache TTL; refetching sooner cannot produce a new answer.
    staleTime: 60_000,
  });
  const products = useMemo(() => {
    const listed = result.data?.products ?? [];
    return prices.data ? mergeSearchPricing(listed, prices.data) : listed;
  }, [result.data, prices.data]);
  const facets = useMemo(
    () =>
      (result.data?.facets ?? []).map((facet) => ({
        ...facet,
        options: facet.options.map((option) => ({
          ...option,
          selected: request.facets?.[facet.field]?.includes(option.value) ?? false,
        })),
      })),
    [request.facets, result.data?.facets],
  );
  const activeFacetCount = Object.values(request.facets ?? {}).reduce(
    (count, values) => count + values.length,
    0,
  );
  function updateRequest(update: Partial<SearchRequest>) {
    setRequest((current) => ({ ...current, ...update, page: update.page ?? 1 }));
  }
  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = queryInput.trim();
    updateRequest({ query, facets: {} });
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    router.replace(params.size ? `/product?${params}` : '/product', { scroll: false });
  }
  function toggleFacet(field: string, value: string) {
    setRequest((current) => {
      const currentValues = current.facets?.[field] ?? [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((candidate) => candidate !== value)
        : [...currentValues, value];
      const facetsForRequest = { ...(current.facets ?? {}) };
      if (nextValues.length) facetsForRequest[field] = nextValues;
      else delete facetsForRequest[field];
      return { ...current, facets: facetsForRequest, page: 1 };
    });
  }
  function selectCategory(categoryId: string) {
    setRequest((current) => ({
      ...current,
      facets: { ...(current.facets ?? {}), category: [categoryId] },
      page: 1,
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const authError =
    result.error instanceof CatalogApiError && [401, 403].includes(result.error.statusCode);
  const browsing = !request.query && activeFacetCount === 0;
  const categoryFacet = facets.find((facet) => facet.field === 'category');
  return (
    <div className="flex-grow font-primary text-text">
      <div className="mx-auto w-full max-w-[1406px] px-4 py-8 sm:px-8 lg:px-16 xl:px-20">
        <nav
          className="mb-6 text-sm font-bold font-secondary text-brand-primary"
          aria-label="Breadcrumb"
        >
          <span className="underline underline-offset-2">Home</span>
          <span className="mx-2 text-brand-gray-600" aria-hidden="true">
            /
          </span>
          <span className="text-text">Products</span>
        </nav>
        <form
          onSubmit={submitSearch}
          className="mb-8 flex flex-col gap-3 sm:flex-row"
          role="search"
        >
          <label className="sr-only" htmlFor="catalog-query">
            Search products
          </label>
          <input
            id="catalog-query"
            type="search"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search by part number, model, or description"
            className="min-h-11 flex-1 rounded-sm border border-brand-gray-700 px-4 py-2 outline-none focus:border-brand-tertiary focus:ring-2 focus:ring-brand-secondary"
          />
          <CatalogButton type="submit" className="min-h-11 sm:min-w-36">
            Search
          </CatalogButton>
        </form>
        {/* Card-shaped placeholders rather than a bare spinner: results replace them in
            place, so the page does not reflow when they land. */}
        {result.isPending && <ResultsSkeleton />}
        {result.isError && (
          <div className="rounded border border-red bg-red/5 p-6" role="alert">
            <h1 className="mb-2 text-xl font-semibold text-brand-primary">
              {authError ? 'Sign in to browse the catalog' : 'Products are temporarily unavailable'}
            </h1>
            <p>
              {authError
                ? 'Use the account control in the header, then return to this page.'
                : result.error.message}
            </p>
          </div>
        )}
        {result.data && (
          <>
            <FilterModal
              open={filterOpen}
              facets={facets}
              onToggle={toggleFacet}
              onClear={() => updateRequest({ facets: {} })}
              onClose={() => setFilterOpen(false)}
            />
            <div className="mb-6 flex items-center justify-between gap-4 md:hidden">
              <div>
                {result.data.total} result(s)
                {request.query ? ` for: ${request.query}` : ''}
              </div>
              <CatalogButton type="button" variant="secondary" onClick={() => setFilterOpen(true)}>
                Filters {activeFacetCount > 0 ? `(${activeFacetCount})` : ''} <span>≡</span>
              </CatalogButton>
            </div>
            <div className="flex flex-col gap-8 md:flex-row">
              <aside className="hidden w-1/5 shrink-0 md:block">
                <h1 className="mb-4 text-xl font-semibold text-black">
                  {result.data.total} Product Result(s)
                  {request.query && (
                    <span>
                      {' '}
                      for <span className="break-all">{request.query}</span>
                    </span>
                  )}
                </h1>
                <FacetSidebar facets={facets} onToggle={toggleFacet} />
              </aside>
              <div
                className={`min-w-0 flex-grow transition-opacity ${result.isFetching ? 'opacity-55' : ''}`}
              >
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <ActiveFacets
                    facets={facets}
                    onToggle={toggleFacet}
                    onClear={() => updateRequest({ facets: {} })}
                  />
                </div>
                {browsing && categoryFacet && (
                  <section className="mb-8">
                    <h2 className="mb-4 text-xl font-semibold">Popular Categories</h2>
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {categoryFacet.options.slice(0, 8).map((category) => (
                        <li key={category.value} className="rounded shadow-card-shadow">
                          <button
                            type="button"
                            onClick={() => selectCategory(category.value)}
                            className="w-full p-4 font-bold font-secondary text-brand-primary"
                          >
                            {category.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {result.data.serialMatches.length > 0 && (
                  <section className="mb-8">
                    <div className="mb-2 rounded-t bg-brand-tertiary/20 px-4 py-2 text-sm font-semibold">
                      Exact match for Serial Number: {request.query}
                    </div>
                    <div className="flex flex-col gap-1 bg-brand-tertiary/20">
                      {result.data.serialMatches.map((serial) => (
                        <SerialSilCard
                          key={serial.serialNumber}
                          serial={serial}
                          query={request.query ?? ''}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {products.length > 0 && (
                  <section>
                    <h2 className="mb-1 text-xl font-semibold">Orderable Products</h2>
                    {products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        pricePending={prices.isPending || prices.isFetching}
                        onCategorySelect={selectCategory}
                      />
                    ))}
                  </section>
                )}
                {result.data.relatedModels.length > 0 && (
                  <section className="mt-8">
                    <h2 className="mb-4 text-xl font-semibold">Serviceable Models</h2>
                    <div className="flex flex-col gap-4">
                      {result.data.relatedModels.map((model) => (
                        <ModelCard key={model.model} model={model} query={request.query ?? ''} />
                      ))}
                    </div>
                  </section>
                )}
                {result.data.total === 0 &&
                  result.data.relatedModels.length === 0 &&
                  result.data.serialMatches.length === 0 && <SearchTips />}
                <Pagination
                  page={request.page}
                  totalPages={result.data.totalPages}
                  onPageChange={(page) => {
                    updateRequest({ page });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
