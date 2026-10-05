import { useSearchState } from "@yext/search-headless-react";

import { useAnalytics } from "@yext/search-ui-react";

type CategoriesProps = {
  title?: string;
  categories?: {
    name?: string;
    id?: string;
  }[];
  updateVertical: Function;
  addSearchAnalytics?: boolean;
};

const Categories = (props: CategoriesProps) => {
  const analytics = useAnalytics();
  const queryID = useSearchState((s) => s.query.queryId);

  return (
    <>
      <h2 className="text-xl mb-4 font-semibold">{props.title}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {props.categories?.map((category) => (
          <li
            key={category.id}
            className="flex items-center justify-center shadow-card-shadow rounded"
          >
            <button
              onClick={() => {
                props.updateVertical(category.id || "");
                if (props.addSearchAnalytics) {
                  analytics?.report({
                    type: "TITLE_CLICK",
                    verticalKey: "categories",
                    entityId: category.id || "",
                    searcher: "VERTICAL",
                    queryId: queryID || "",
                  });
                }
              }}
              className="text-brand-primary font-bold font-secondary p-4 w-full"
            >
              {category.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};

export { Categories };
