import { useSearchState } from "@yext/search-headless-react";
import { VerticalResultsDisplay } from "./VerticalResultsDisplay";

import { Result } from "@yext/search-headless-react";
import { R12PricingResponse } from "src/api/client";
import { getPriceAndQty2 } from "src/components/search/utils/helpers";
import { StoreInfo } from "../modals/components/StoreList";
import { useUserInfo } from "src/components/common/UserInfoContext";
import { Trans } from "react-i18next";
import { useIsIWDDistributor } from "src/common/useUserRole";

/**
 * The default type for "rawData" field of type Result.
 *
 * @public
 */
export type DefaultRawDataType = Record<string, unknown>;

/**
 * The props provided to every {@link CardComponent}.
 *
 * @public
 */
export interface CardProps<T = DefaultRawDataType> {
  /** The result data provided to the card for rendering. */
  result: Result<T>;
}

/**
 * A functional component that can be used to render a result card.
 *
 * @public
 */
export type CardComponent<T = DefaultRawDataType> = (
  props: CardProps<T>
) => JSX.Element;

/**
 * The CSS class interface used for {@link VerticalResults}.
 *
 * @public
 */
export interface VerticalResultsCssClasses {
  verticalResultsContainer?: string;
  verticalResultsLoading?: string;
}

/**
 * Props for the VerticalResults component.
 *
 * @public
 */
export interface VerticalResultsProps<T> {
  /** {@inheritDoc CardComponent} */
  CardComponent: CardComponent<T>;
  /**
   * Whether or not all results should be displayed when there are none returned from the search.
   * Defaults to true.
   */
  displayAllOnNoResults?: boolean;
  showingAvailable?: boolean;
  /** CSS classes for customizing the component styling. */
  customCssClasses?: VerticalResultsCssClasses;
  r12PriceInfo: R12PricingResponse | null;
  r12Availability?: Record<string, StoreInfo[]> | null;
}

/**
 * A component that renders search results for a vertical page.
 *
 * @public
 *
 * @param props - {@link VerticalResultsProps}
 * @returns A React element for the results, or null if no results should be displayed
 */
export function VerticalResults<T>(
  props: VerticalResultsProps<T>
): JSX.Element | null {
  const { displayAllOnNoResults = true, ...otherProps } = props;
  const verticalResults =
    useSearchState((state) => state.vertical.results) || [];
  const allResultsForVertical =
    useSearchState(
      (state) => state.vertical?.noResults?.allResultsForVertical.results
    ) || [];
  const isLoading = useSearchState((state) => state.searchStatus.isLoading);

  if ((!props.r12PriceInfo) && props.showingAvailable) return <></>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results = verticalResults as any;
  if (verticalResults.length === 0 && displayAllOnNoResults) {
    results = allResultsForVertical;
  }

  const { dsoProfile } = useUserInfo();
  const isIWDDistributor = useIsIWDDistributor();

  const res = [...results];
  if (props.showingAvailable) {
    const filteredResults = results.filter(  
      (result: any) => {
        const { qty } = getPriceAndQty2(result.id || '', props.r12PriceInfo, props.r12Availability, dsoProfile?.warehouses || {}, isIWDDistributor);
        return (!!Number(qty))
      }
    );


    if (
      !isLoading &&
      props.showingAvailable &&
      res.length === 0 &&
      props.r12PriceInfo
    ) {
      return (
        <div className="">
          <Trans>The most relevant results are not available in your area. Unselect the
          filter to view results available from locations farther away.</Trans>
        </div>
      );
    }

    return (
      <VerticalResultsDisplay
        results={filteredResults}
        isLoading={isLoading}
        {...otherProps}
      />
    );
  }

  return (
    <VerticalResultsDisplay
      results={res}
      isLoading={isLoading}
      {...otherProps}
    />
  );
}
