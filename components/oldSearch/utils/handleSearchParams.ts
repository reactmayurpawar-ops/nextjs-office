import { useEffect } from "react";

import { useSearchParams } from "react-router-dom";

export function useLoadInitialSearchParams(
  callback: (q: URLSearchParams) => void,
  deps: unknown[],
) {
  const [searchParams] = useSearchParams();
  useEffect(() => {
    callback(searchParams);
  }, [searchParams, ...deps]);
  return [searchParams];
}
