import { LiteratureCTA, UnitPartsCTA, WarrantyCTA } from './ctas';
import type { SerialMatch } from '@/lib/types';

function InfoBox({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-row border-b border-brand-gray-700 md:flex-col md:border-r md:border-b-0">
      <div className="min-w-[145px] border-r border-brand-gray-700 px-4 py-2 font-secondary font-semibold md:border-r-0 md:border-b">
        {title}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-2">
        <div className="break-words">{value}</div>
        {children}
      </div>
    </div>
  );
}

export function SerialSilCard({ serial, query }: { serial: SerialMatch; query: string }) {
  return (
    <article className="grid w-full grid-cols-1 bg-white md:grid-cols-6">
      <InfoBox title="Serial No." value={serial.serialNumber}>
        <WarrantyCTA />
      </InfoBox>
      <div className="md:col-span-2">
        <InfoBox title="Model No." value={serial.modelNumber}>
          <div className="flex flex-wrap justify-between gap-3">
            <UnitPartsCTA model={serial.modelNumber} query={query} />
            <LiteratureCTA product={serial.modelNumber} />
          </div>
        </InfoBox>
      </div>
      <InfoBox title="Ship Date" value={serial.shipDate} />
      <InfoBox title="Job Name" value={serial.jobName} />
      <InfoBox title="Sales Order No." value={serial.salesOrderNumber} />
    </article>
  );
}
