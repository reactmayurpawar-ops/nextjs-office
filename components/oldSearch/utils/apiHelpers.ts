import {
  encodeStringForServerless,
  SEARCH_API_KEY,
  SERVERLESS_BASE_URL,
} from "src/util";
import { provideCore } from "@yext/search-core";
import type { CategoryProfile } from "src/types/entities";
import { InventoryResponse } from "src/api/types";

async function getFacetOrdering(verticalKey?: string) {
  if (!verticalKey || verticalKey === "products") {
    return;
  }

  const params = new URLSearchParams({
    api_key: SEARCH_API_KEY,
    v: "20230101",
    limit: "50",
    id: verticalKey,
  });

  const docs: CategoryProfile[] = await fetch(
    `https://streams.yext.com/v2/accounts/me/api/categoryLookup?${params.toString()}`
  )
    .then((r) => r.json())
    .then((r) => r?.response?.docs || []);

  if (!docs || !docs.length) {
    return;
  }

  return (docs[0].c_facetOrdering || []).reduce<Record<string, number>>(
    (m, cur) => {
      m[cur.name] = Number(cur.order);
      return m;
    },
    {}
  );
}

function locationSearch(location: string) {
  const core = provideCore({
    apiKey: SEARCH_API_KEY,
    experienceKey: "products",
    locale: "en",
    experienceVersion: "PRODUCTION",
  });

  return core.verticalSearch({
    query: location,
    limit: 50,
    verticalKey: "locations",
  });
}

function getInventory(
  id: string,
  locId = "",
  relativePrefixToRoot: string
): Promise<InventoryResponse> {
  const cleanQuery = encodeStringForServerless(id);
  return fetch(
    `${SERVERLESS_BASE_URL(
      relativePrefixToRoot
    )}${cleanQuery}/inventory?location=${locId}`
  ).then((resp) => resp.json());
}

export { getInventory, getFacetOrdering, locationSearch };
