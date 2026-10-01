import { CatalogButton } from '../CatalogButton';

function Glyph({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="text-lg leading-none no-underline">
      {children}
    </span>
  );
}

export function UnitPartsCTA({ model, query = '' }: { model: string; query?: string }) {
  const params = new URLSearchParams({ query: model });
  if (query) params.set('searchedTerm', query);
  return (
    <CatalogButton href={`/unitparts?${params}`} variant="link">
      <Glyph>☷</Glyph> Unit Parts List
    </CatalogButton>
  );
}

export function LiteratureCTA({ product, local = false }: { product: string; local?: boolean }) {
  return (
    <CatalogButton
      href={local ? '#literature' : `/elibrary?query=${encodeURIComponent(product.slice(0, 7))}`}
      variant="link"
    >
      <Glyph>▤</Glyph> Product Literature
    </CatalogButton>
  );
}

export function WarrantyCTA({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <CatalogButton type="button" variant="link" onClick={onClick}>
      <Glyph>✓</Glyph> Warranty Info
    </CatalogButton>
  );
}
