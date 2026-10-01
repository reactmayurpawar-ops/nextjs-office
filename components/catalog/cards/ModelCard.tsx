import { LiteratureCTA, UnitPartsCTA } from './ctas';
import type { ModelMatch } from '@/lib/types';

export function ModelCard({ model, query }: { model: ModelMatch; query: string }) {
  return (
    <article className="flex w-full flex-col items-center justify-between gap-2 rounded border border-solid border-brand-gray-200 px-4 py-4 shadow-card-shadow sm:flex-row">
      <div className="flex min-w-0 flex-col">
        <div className="break-all text-xl font-semibold">{model.model}</div>
        {model.description && <div>{model.description}</div>}
      </div>
      <div className="hidden gap-4 p-4 sm:flex">
        <UnitPartsCTA model={model.model} query={query} />
        <LiteratureCTA product={model.model} />
      </div>
      <details className="group w-full sm:hidden">
        <summary className="mt-4 flex cursor-pointer list-none items-center justify-center border-t border-brand-gray-200 p-4">
          More Details <span className="ml-2 group-open:rotate-180">⌄</span>
        </summary>
        <div className="grid grid-cols-2 gap-4 p-4">
          <UnitPartsCTA model={model.model} query={query} />
          <LiteratureCTA product={model.model} />
        </div>
      </details>
    </article>
  );
}
