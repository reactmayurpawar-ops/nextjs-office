export function Disclosure({
  title,
  children,
  defaultOpen = false,
  id,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  return (
    <details id={id} className="group" open={defaultOpen}>
      <summary className="flex w-full cursor-pointer list-none items-center justify-between rounded bg-brand-gray-300 px-4 py-2">
        <span className="font-bold font-secondary text-sm">{title}</span>
        <span className="text-xl group-open:hidden" aria-hidden="true">
          ⊞
        </span>
        <span className="hidden text-xl group-open:inline" aria-hidden="true">
          ⊟
        </span>
      </summary>
      <div className="border border-solid border-brand-gray-300">{children}</div>
    </details>
  );
}
