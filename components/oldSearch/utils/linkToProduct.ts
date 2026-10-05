import { Result } from "@yext/search-core";


const dev = import.meta.env.DEV;

interface Profile {
  id: string;
  c_salesforceID?: string;
}

export default function linkToProduct(profile: Result<Profile> | Profile) {
  if (dev) return `product/${profile.id}`;
  if ("rawData" in profile) return `product/${profile.rawData.c_salesforceID}`;
  return `product/${profile.c_salesforceID}`;
}
