'use client';
import { useEffect } from 'react';
import { CatalogButton } from '../CatalogButton';
import { ActiveFacets } from './ActiveFacets';
import { FacetSidebar } from './FacetSidebar';
import type { SearchFacet } from '@/lib/types';
interface FilterModalProps {
  open: boolean;
  facets: SearchFacet[];
  onToggle: (field: string, value: string) => void;
  onClear: () => void;
  onClose: () => void;
}
export function FilterModal(props: FilterModalProps) {
  const { open, onClose } = props;
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex h-full w-full flex-col bg-white md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-modal-title"
    >
      <div className="relative flex flex-col gap-4 border-b border-brand-gray-700 p-4">
        <h2 id="filter-modal-title" className="text-lg font-semibold">
          Select Filters:
        </h2>
        <button
          type="button"
          className="absolute top-4 right-4 p-2 text-2xl leading-none"
          onClick={onClose}
          aria-label="Close filters"
        >
          ×
        </button>
        <ActiveFacets facets={props.facets} onToggle={props.onToggle} onClear={props.onClear} />
      </div>
      <div className="flex-grow overflow-y-auto p-4">
        <FacetSidebar facets={props.facets} onToggle={props.onToggle} />
      </div>
      <div className="p-4">
        <CatalogButton type="button" className="w-full" onClick={onClose}>
          View Results
        </CatalogButton>
      </div>
    </div>
  );
}
