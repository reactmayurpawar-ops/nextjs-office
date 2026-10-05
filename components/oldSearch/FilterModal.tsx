import classNames from "classnames";

import { useSearchState } from "@yext/search-headless-react";
import { disableScroll, enableScroll } from "src/common/helpers";
import { useEffect } from "react";
import { MdOutlineClose } from "react-icons/md";
import { ActiveFacets } from "src/components/search/ActiveFacets";
import {
  ActiveProductsStaticFilter,
  AvailableItemsFilter,
  AvailableItemsFilterProps,
} from "src/components/search/NavBar";
import {
  CategoryTree,
  CategoryTreeProps,
} from "src/components/search/CategoryTree";
import CustomFacets from "src/components/search/CustomFacets";
import { useTemplateData } from "src/common/useTemplateData";
import { useTranslation } from "src/i18n";

type FilterModalProps = {
  isOpen: boolean;
  closeFn: Function;
  facetOrder: Record<string, number> | null;
} & AvailableItemsFilterProps &
  CategoryTreeProps;

const FilterModal = (props: FilterModalProps) => {
  const { isOpen, closeFn, facetOrder } = props;
  const { isPublicDomain } = useTemplateData();
  const facets = useSearchState((s) => s.filters.facets);
  const facetSelected =
    (facets || [])?.flatMap((x) => x.options).filter((x) => x.selected)
      ?.length > 0;
  const { t } = useTranslation();

  useEffect(() => {
    isOpen ? disableScroll() : enableScroll();
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }
  return (
    <div className="sm:hidden fixed w-full h-full z-20 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-700 relative flex flex-col gap-4">
        <div className="text-lg font-semibold">Select Filters:</div>
        <button className="absolute top-5 right-4" onClick={() => closeFn()}>
          <span className="sr-only">Close Modal</span>
          <MdOutlineClose size={16} />
        </button>
        {facetSelected && (
          <div className="flex gap-2 flex-wrap">
            <ActiveFacets />
          </div>
        )}
      </div>
      <div className="p-4 overflow-y-auto flex-grow">
        {!isPublicDomain && <ActiveProductsStaticFilter />}
        <AvailableItemsFilter {...props} />
        <CategoryTree {...props} />
        {facets && <CustomFacets facetOrder={facetOrder || {}} />}
      </div>
      <div className="p-4">
        <button
          className="Button Button--primary w-full"
          onClick={() => closeFn()}
        >
          {t("View Results")}
        </button>
      </div>
    </div>
  );
};

export { FilterModal };
