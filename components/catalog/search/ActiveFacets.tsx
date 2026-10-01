import type { SearchFacet } from '@/lib/types';
export function ActiveFacets({
  facets,
  onToggle,
  onClear,
}: {
  facets: SearchFacet[];
  onToggle: (field: string, value: string) => void;
  onClear: () => void;
}) {
  const selected = facets.flatMap((facet) =>
    facet.options.filter((option) => option.selected).map((option) => ({ facet, option })),
  );
  if (!selected.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="font-semibold text-brand-primary hover:text-brand-tertiary hover:underline"
        onClick={onClear}
      >
        Clear All
      </button>
      {selected.map(({ facet, option }) => (
        <button
          type="button"
          key={`${facet.field}-${option.value}`}
          className="flex items-center justify-center rounded-full border border-solid border-brand-gray-700 bg-brand-tertiary/20 px-3 py-2"
          onClick={() => onToggle(facet.field, option.value)}
        >
          <span className="mr-1 text-xs">
            {facet.label}: {option.label}
          </span>
          <span aria-hidden="true" className="text-base leading-none text-brand-gray-400">
            ×
          </span>
        </button>
      ))}
    </div>
  );
}
