import {
  Node,
  categoryResultCount,
} from "src/components/search/utils/treeHelpers";
import { FiChevronLeft } from "react-icons/fi";
import { TreeView } from '@mui/x-tree-view/TreeView';
import {
  CustomTreeItem,
  MinusSquare,
  PlusSquare,
} from "src/components/common/Tree";
import classNames from "classnames";
import { useSearchState } from "@yext/search-headless-react";

function RecursiveItem(props: {
  cat: Node;
  root: Node;
  counts: Record<string, number>;
}) {
  const { cat, root } = props;
  const categoryCount = categoryResultCount(cat, props.counts);
  const isRoot = cat.id === root.id;
  const cls = classNames({
    "font-primary": categoryCount,
    "cursor-default": !categoryCount,
    "text-brand-primary": !isRoot,
  });

  return (
    <CustomTreeItem
      className={classNames({ rootlabel: isRoot })}
      disabled={categoryCount === 0}
      classes={{
        iconContainer: classNames("p-1 h-full", { hidden: isRoot }),
        label: classNames("font-semibold", isRoot ? "text-lg" : "text-sm"),
      }}
      key={cat.id}
      nodeId={cat.id}
      label={
        <div className={cls}>
          {cat.name} <span className="font-normal ml-1">({categoryCount})</span>
        </div>
      }
    >
      {(
        cat?.c_subcategories?.sort((a, b) => {
          if (a.name === b.name)
            return (a?.c_subcategories?.length || 0) <
              (b?.c_subcategories?.length || 0)
              ? 1
              : -1;
          return a.name < b.name ? -1 : 1;
        }) || []
      )
        .filter((cat3) => categoryResultCount(cat3, props.counts) != 0)
        .map((cat2) => (
          <RecursiveItem
            key={cat2.id}
            cat={cat2}
            root={root}
            counts={props.counts}
          />
        ))}
    </CustomTreeItem>
  );
}

type CategoryTreeProps = {
  verticalKey?: string;
  updateVertical: Function;
  sidebarTreeRoot: Node | null;
  sidebarTreeParents: Node[];
};

const CategoryTree = (props: CategoryTreeProps) => {
  const { verticalKey, updateVertical, sidebarTreeRoot, sidebarTreeParents } =
    props;
  const facets = useSearchState((s) => s.filters.facets);
  const facetsBase = facets;
  const rawCategoryCounts =
    facetsBase
      ?.find((facet) => facet.fieldId === "c_productCategory.c_salesforceID")
      ?.options?.reduce<Record<string, number>>((all, option) => {
        all[option.displayName] = option.count;
        return all;
      }, {}) || {};

  return (
    <>
      <div className="font-bold font-secondary mb-5">Categories</div>
      <div className="mb-10">
        {sidebarTreeParents.length !== 0 && (
          <div>
            <button
              onClick={() => {
                updateVertical(
                  sidebarTreeParents[sidebarTreeParents.length - 1].id
                );
              }}
              className="flex items-center Link Link--primary font-semibold my-4"
            >
              <FiChevronLeft size={20} /> Back to{" "}
              {sidebarTreeParents[sidebarTreeParents.length - 1].name}
            </button>
          </div>
        )}
        {sidebarTreeRoot && (
          <TreeView
            defaultCollapseIcon={<MinusSquare />}
            defaultExpandIcon={<PlusSquare />}
            onNodeToggle={(e, x) => {
              const newX = [
                ...x.filter((id) => id !== sidebarTreeRoot?.id),
                sidebarTreeRoot?.id || "",
              ];
            }}
            onNodeSelect={(e: any, x: string) => {
              if (x === verticalKey) return;
              updateVertical(x);
            }}
          >
            {!!sidebarTreeRoot && !!sidebarTreeRoot.c_subcategories && (
              <>
                {sidebarTreeRoot.c_subcategories.map((subcategory) => (
                  <RecursiveItem
                    key={subcategory.id}
                    cat={subcategory}
                    root={sidebarTreeRoot}
                    counts={rawCategoryCounts}
                  />
                ))}
              </>
            )}
          </TreeView>
        )}
      </div>
    </>
  );
};

export { CategoryTreeProps, CategoryTree };
