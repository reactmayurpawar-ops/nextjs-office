'use client';
import { useState } from 'react';
import type { SearchFacet } from '@/lib/types';
function FacetGroup({
  facet,
  onToggle,
}: {
  facet: SearchFacet;
  onToggle: (field: string, value: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const options = facet.options.filter((option) =>
    option.label.toLowerCase().includes(filter.toLowerCase()),
  );
  const selectedCount = facet.options.filter((option) => option.selected).length;
  return (
    <details className="group border-t border-solid border-brand-gray-200" open>
      <summary className="flex cursor-pointer list-none items-center justify-between py-2">
        <span className="flex items-center font-secondary font-bold">
          {facet.label}
          {selectedCount > 0 && (
            <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary p-1 text-xs text-white">
              {selectedCount}
            </span>
          )}
        </span>
        <span className="text-xl group-open:hidden" aria-hidden="true">
          ⊞
        </span>
        <span className="hidden text-xl group-open:inline" aria-hidden="true">
          ⊟
        </span>
      </summary>
      <div className="pb-4">
        {facet.options.length > 6 && (
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search for options"
            aria-label={`Search ${facet.label} options`}
            className="mb-2 w-full border border-brand-gray-700 p-2"
          />
        )}
        <div className="flex flex-col">
          {options.map((option) => {
            const id = `facet-${facet.field}-${option.value}`.replace(/[^a-zA-Z0-9_-]/g, '-');
            return (
              <label key={option.value} htmlFor={id} className="flex cursor-pointer py-2">
                <input
                  id={id}
                  type="checkbox"
                  checked={option.selected}
                  onChange={() => onToggle(facet.field, option.value)}
                  className="mr-2 accent-brand-primary"
                />
                <span className="font-semibold">
                  {option.label} ({option.count})
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}

/**
 * The "active only" / "available in your area" filters are gone: the search service has no
 * way to honour them. `options.filters.aq` is forwarded to Coveo but ignored, availability
 * isn't in the index at all, and neither ec_ts_status__c nor ec_ts_isactive is configured as
 * a facet. Filtering the returned page client-side would be worse than absent — it corrupts
 * `total` and yields pages shorter than pageSize. The request fields are still accepted and
 * ignored, so nothing 400s on a stale cached body.
 */
export function FacetSidebar({
  facets,
  onToggle,
}: {
  facets: SearchFacet[];
  onToggle: (field: string, value: string) => void;
}) {
  return (
    <div className="text-sm">
      <div className="mb-8 border-b border-solid border-brand-gray-700 pb-4 font-secondary font-bold">
        Refine your search
      </div>
      <div className="mb-4 font-secondary font-bold">Categories</div>
      {facets.map((facet) => (
        <FacetGroup key={facet.field} facet={facet} onToggle={onToggle} />
      ))}
    </div>
  );
}
