import { useSearchActions, useSearchState } from "@yext/search-headless-react";

import { Matcher } from "@yext/search-core";
import {
  CategoryTree,
  CategoryTreeProps,
} from "src/components/search/CategoryTree";
import CustomFacets from "src/components/search/CustomFacets";
import { getRuntime } from "@yext/pages/util";
import { ErrorBoundary } from "react-error-boundary";
import { useTemplateData } from "src/common/useTemplateData";
import { useTranslation } from "src/i18n";
import { Trans } from "react-i18next";

type NavBarProps = {
  facetOrder: Record<string, number> | null;
} & NavBarSummaryProps &
  ActiveProductsStaticFilterProps &
  AvailableItemsFilterProps &
  CategoryTreeProps;

type NavBarSummaryProps = {
  showingAvailable?: boolean;
};

const NavBarSummary = (props: NavBarSummaryProps) => {
  const { showingAvailable } = props;
  const resultCount = useSearchState((s) => s.vertical.resultsCount);
  const mostRecentSearch =
    useSearchState((s) => s.query.mostRecentSearch) || "";
  const { t } = useTranslation();

  return (
    <div className="flex items-center mb-4">
      <div className="flex flex-col max-w-full">
        <div className="text-xl text-black font-semibold mr-8">
          {t("{{results}}Product Result(s)", {results: (!showingAvailable ? `${resultCount} ` : " ")})}
          {mostRecentSearch && (
            <span>
              <Trans mostRecentSearch={mostRecentSearch}> for <span className="break-all">{{mostRecentSearch}}</span></Trans>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

type ActiveProductsStaticFilterProps = {};

const ActiveProductsStaticFilter = (props: ActiveProductsStaticFilterProps) => {
  const actions = useSearchActions();
  const staticFilters = useSearchState((s) => s.filters.static) || [];
  const statusFilterActive = staticFilters?.find(filter => 'fieldId' in filter.filter && filter.filter?.fieldId === "c_product2Status")
  const { t } = useTranslation();
  return (
    <label className="flex items-center mb-8" htmlFor="terminatedItemFilter">
      <input
        className="mr-2"
        id="terminatedItemFilter"
        type="checkbox"
        checked={!!statusFilterActive}
        onChange={(e) => {
          if (e.target.checked) {
            actions.setStaticFilters([
              ...staticFilters,
              {
                filter: {
                  kind: "fieldValue",
                  fieldId: "c_product2Status",
                  matcher: Matcher.Equals,
                  value: "ACTIVE",
                },
                selected: true,
                displayName: "c_product2Status",
              },
            ]);
          } else {
            const otherFilters = staticFilters?.filter(filter => !('fieldId' in filter.filter && filter.filter.fieldId === "c_product2Status")) || []
            actions.setStaticFilters(otherFilters);
          }
          actions.executeVerticalQuery();
        }}
      />
      <div>{t("Show only active products")}</div>
    </label>
  );
};

type AvailableItemsFilterProps = {
  showingAvailable?: boolean;
  setShowingAvailable?: Function;
};

const AvailableItemsFilter = (props: AvailableItemsFilterProps) => {
  const { showingAvailable, setShowingAvailable } = props;
  const actions = useSearchActions();
  const { t } = useTranslation();

  return (
    <label className="flex items-center mb-8" htmlFor="availableItemsFilter">
      <input
        className="mr-2"
        id="availableItemsFilter"
        type="checkbox"
        checked={showingAvailable}
        onChange={(e) => {
          const available = e.target.checked;
          setShowingAvailable && setShowingAvailable(available);

          if (available) {
            actions.setVerticalLimit(40);
          } else {
            actions.setVerticalLimit(10);
          }

          actions.executeVerticalQuery();
        }}
      />
      <div>{t("Show only items available in your area")}</div>
    </label>
  );
};

const NavBar = (props: NavBarProps) => {
  const { facetOrder } = props;
  const facets = useSearchState((s) => s.filters.facets);
  const runtime = getRuntime();
  const { isPublicDomain } = useTemplateData();
  const { t } = useTranslation();

  return (
    <div className="hidden md:block w-[20%] shrink-0 text-sm">
      <NavBarSummary {...props} />
      <div className="font-bold font-secondary pb-4 mb-8 border-b border-solid border-brand-gray-700">
        {t("Refine your search")}
      </div>
      {!isPublicDomain && <ActiveProductsStaticFilter />}
      <AvailableItemsFilter {...props} />

      {runtime.name === "browser" &&
        !!props.sidebarTreeRoot &&
        !!props.sidebarTreeParents && (
          <ErrorBoundary
            onError={(e) => console.log("Category tree error: ", e)}
            fallback={<></>}
          >
            <CategoryTree {...props} />
          </ErrorBoundary>
        )}
      {facets && <CustomFacets facetOrder={facetOrder || {}} />}
    </div>
  );
};

export {
  ActiveProductsStaticFilter,
  AvailableItemsFilter,
  AvailableItemsFilterProps,
  NavBar,
};
