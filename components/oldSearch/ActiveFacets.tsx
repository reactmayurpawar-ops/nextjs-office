import { useSearchActions, useSearchState } from "@yext/search-headless-react";

import { MdOutlineClose } from "react-icons/md";
import { useTranslation } from "src/i18n";

type ActiveFacetsProps = {};

const ActiveFacets = (props: ActiveFacetsProps) => {
  const actions = useSearchActions();
  const facets = useSearchState((s) => s.filters.facets);
  const facetSelected =
    (facets || [])?.flatMap((x) => x.options).filter((x) => x.selected)
      ?.length > 0;
  const { t } = useTranslation();

  return (
    <>
      {facetSelected && (
        <button
          className="Link Link--primary Link--underlineInverse font-semibold"
          onClick={() => {
            actions.resetFacets();
            actions.executeVerticalQuery();
          }}
        >
          {t("Clear All")}
        </button>
      )}
      {facets?.map((facet) =>
        facet.options.map((option) => {
          if (!option.selected) return null;
          return (
            <button
              onClick={() => {
                actions.setFacetOption(facet.fieldId, option, false);
                actions.executeVerticalQuery();
              }}
              key={`${facet.displayName}-${option.displayName}`}
              className="bg-brand-tertiary/20 rounded-full flex items-center justify-center py-2 px-3 border border-solid border-brand-gray-700"
            >
              <div className="mr-1 text-xs">
                {facet.displayName}: {option.displayName}
              </div>
              <MdOutlineClose color="#555" size={16} />
            </button>
          );
        })
      )}
    </>
  );
};

export { ActiveFacets };
