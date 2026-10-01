export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index);
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Product results pages">
      <button
        type="button"
        className="rounded border border-brand-gray-700 px-3 py-2 text-brand-primary disabled:opacity-40"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      {pages.map((number) => (
        <button
          type="button"
          key={number}
          aria-current={number === page ? 'page' : undefined}
          className={`h-10 min-w-10 rounded border px-3 ${
            number === page
              ? 'border-brand-primary bg-brand-primary text-white'
              : 'border-brand-gray-700 text-brand-primary'
          }`}
          onClick={() => onPageChange(number)}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        className="rounded border border-brand-gray-700 px-3 py-2 text-brand-primary disabled:opacity-40"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
