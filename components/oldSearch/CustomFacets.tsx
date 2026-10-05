import { useSearchActions, useSearchState } from "@yext/search-headless-react";

import useCollapse from "react-collapsed";
import React, { useState } from "react";
import { AiOutlineMinusSquare, AiOutlinePlusSquare } from "react-icons/ai";
import classNames from "classnames";
import { DisplayableFacet } from "@yext/search-core";

interface CustomFacetsProps {
  facetOrder: Record<string, number>;
}

export default function CustomFacets(props: CustomFacetsProps) {
  const facetOrder = props?.facetOrder || {};
  const facets = useSearchState((s) => s.filters.facets) || [];
  const filteredFacets = facets?.filter(
    (facet) =>
      !["c_productCategory.name", "c_productCategory.c_salesforceID"].includes(
        facet.fieldId
      ) && facet.options.length
  );
  const sortedFacets = filteredFacets.sort((af, bf) => {
    const a = facetOrder[af.displayName];
    const b = facetOrder[bf.displayName];
    if (!a && b) return 1;
    if (!b && a) return -1;
    if (a && b) {
      return a - b;
    }
    return af.displayName.localeCompare(bf.displayName);
  });

  return (
    <div className="CustomFacets">
      {sortedFacets.map((f, i) => {
        return (
          <React.Fragment key={f.fieldId}>
            <FilterGroup field={f} last={i === sortedFacets.length - 1} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface FilterGroupProps {
  field: DisplayableFacet;
  last: boolean;
}

function FilterGroup(props: FilterGroupProps) {
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse();
  const { field } = props;
  const [filterText, setFilterText] = useState("");
  const selectedCount = field.options.filter(
    (option) => option.selected
  ).length;

  const sortedOptions = [...field.options]
    .filter(
      (option) =>
        !filterText ||
        option.displayName.toLowerCase().includes(filterText.toLowerCase())
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const cls = classNames(
    "flex flex-col items-start border-solid border-t border-brand-gray-200",
    { "border-b": props.last }
  );
  const actions = useSearchActions();

  return (
    <div className={cls}>
      <button className="w-full" {...getToggleProps()}>
        <div className="flex items-center justify-between py-2 w-full">
          <div className="flex items-center">
            <div className="font-bold font-secondary text-left">{field.displayName}</div>
            {selectedCount !== 0 && (
              <div className="text-xs flex justify-center items-center rounded-full w-5 h-5 bg-brand-primary p-1 ml-2 text-white shrink-0">
                {selectedCount}
              </div>
            )}
          </div>
          <div>
            {isExpanded ? (
              <AiOutlineMinusSquare size={20} />
            ) : (
              <AiOutlinePlusSquare size={20} />
            )}
          </div>
        </div>
      </button>
      <div className="w-full" {...getCollapseProps()}>
        <div className="w-full">
          <input
            placeholder="Search for options"
            value={filterText}
            className="border w-full p-1"
            type="text"
            onChange={(e) => {
              setFilterText(e.target.value);
            }}
          />
          {sortedOptions.map((option) => {
            return (
              <label
                key={option.value.toString()}
                className="py-2 cursor-pointer flex"
                htmlFor={`${field.fieldId}-${option.value}`}
              >
                <input
                  onChange={(e) => {
                    actions.setFacetOption(
                      field.fieldId,
                      option,
                      e.target.checked
                    );
                    actions.executeVerticalQuery();
                  }}
                  className="cursor-pointer mr-2"
                  id={`${field.fieldId}-${option.value}`}
                  type="checkbox"
                  checked={option.selected}
                />
                <div className="font-semibold">
                  {option.displayName} ({option.count})
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
