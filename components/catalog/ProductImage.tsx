export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex aspect-square items-center justify-center bg-brand-gray-100 text-center text-xs text-brand-gray-600 ${className ?? ''}`}
        role="img"
        aria-label={`No image available for ${alt}`}
      >
        Image not available
      </div>
    );
  }
  return (
    // Product media hosts are administered in Salesforce, so the hostname cannot be
    // safely enumerated in next.config without coupling deployment to catalog content.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`object-contain ${className ?? ''}`} />
  );
}
