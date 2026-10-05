import { ProductProfile } from "src/types/entities";

import { Matcher } from "@yext/search-core";


function getExactMatchInfo(
  mostRecentSearch: string,
  results: ProductProfile[]
): Record<string, { data: ProductProfile; field: string }> {
  const exactMatchInfo: Record<
    string,
    { data: ProductProfile; field: string }
  > = {};

  const lowerSearch = mostRecentSearch.toLowerCase();
  for (const result of results) {
    if (
      result.name?.toLowerCase() === lowerSearch ||
      (
        result.c_drawingNumbers?.map((x) => x.toLowerCase()) || []
      ).includes(lowerSearch) ||
      (
        result.c_vendorPartNumbers?.map((x) => x.toLowerCase()) || []
      ).includes(lowerSearch) ||
      result.c_vendoritemno?.toLowerCase() === lowerSearch ||
      result.c_tranemfgnumber?.toLowerCase() === lowerSearch ||
      [...(result?.c_aHRINumbers || []), ...(result?.c_unitModelAHRINumbers2 || [])].includes(lowerSearch)
    ) {
      let exactMatchFieldName = "Drawing Number / X Numbers";
      if (result?.id?.toLowerCase() === lowerSearch) {
        exactMatchFieldName = "SKU";
      } else if (
        (
          result?.c_vendorPartNumbers?.map((x) => x.toLowerCase()) ||
          []
        ).includes(lowerSearch)
      ) {
        exactMatchFieldName = "Vendor Part Number";
      } else if (
        result?.c_vendoritemno?.toLowerCase() === lowerSearch
      ) {
        exactMatchFieldName = "Vendor Item No";
      } else if (
        result?.c_tranemfgnumber?.toLowerCase() === lowerSearch
      ) {
        exactMatchFieldName = "Trane MFG Number";
      } else if (
        [...(result?.c_aHRINumbers || []), ...(result?.c_unitModelAHRINumbers2 || [])].includes(lowerSearch)
      ) {
        exactMatchFieldName = "AHRI Number"
      }

      exactMatchInfo[result.id || ""] = {
        data: result,
        field: exactMatchFieldName,
      };
    }
  }

  return exactMatchInfo;
}


// TODO: this function is a replacement for getPriceAndQty that supports r12
// replace all usages of the other function
function getPriceAndQty2(id: string, r12PriceInfo?: any | null, r12Availability?: Record<string, {qty: string, orgCode: string}[]> | null, warehouses?: Record<string, {orgCode: string}>, useAllR12Warehouses = false): {price?: number | null, qty?: number, discontinued?: boolean, orderingSource?: string, missingId?: boolean } {
  if (!r12PriceInfo?.[id]) return {missingId: true};

  const availableWarehouses = r12Availability?.[id] || [];
  const warehouseCodes = Object.keys(warehouses || {});
  const filteredAvailability = (useAllR12Warehouses || warehouseCodes.length === 0)
    ? availableWarehouses
    : availableWarehouses.filter(details => warehouseCodes.includes(details.orgCode));

  const r12AvailabilityNumber = filteredAvailability
    .map(details => (Number(details.qty) >= 0 ? Number(details.qty) : 0))
    .reduce((sum, qty) => sum + qty, 0);

  const r12Price = r12PriceInfo?.[id]?.unitPrice != "" ? r12PriceInfo?.[id]?.unitPrice : null;

  return {price: r12Price, qty: r12AvailabilityNumber, discontinued: false, orderingSource: "R12"};
}

export { getExactMatchInfo, getPriceAndQty2 };
