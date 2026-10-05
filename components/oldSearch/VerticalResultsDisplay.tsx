import { VerticalResultsCssClasses, CardComponent } from "./VerticalResults";
import { Result } from "@yext/search-headless-react";
import classNames from "classnames";
import { useMemo } from "react";
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  classGroups: {
    form: ['input', 'checkbox', 'textarea', 'select', 'multiselect', 'radio'].map(v => 'form-' + v)
  }
});

/**
 * useComposedCssClasses merges a component's built-in tailwind classes with custom tailwind classes.
 *
 * @remarks
 * Tailwind classes will be merged without conflict, with custom classes having higher priority
 * than built-in ones.
 *
 * @example
 * Suppose a component has built-in classes of `{ container: 'px-4 text-slate-700' }`.
 *
 * Passing in the custom classes:
 *
 * ```ts
 * { container: 'text-red-200 mb-3' }
 * ```
 *
 * results in the merged classes of:
 *
 * ```ts
 * { container: 'px-4 text-red-200 mb-3' }
 * ```
 *
 * @public
 *
 * @param builtInClasses - The component's built-in tailwind classes
 * @param customClasses - The custom tailwind classes to merge with the built-in ones
 * @returns The composed CSS classes
 */
export function useComposedCssClasses<
  ClassInterface extends Partial<Record<keyof ClassInterface & string, string>>
>(
  builtInClasses: Readonly<ClassInterface>,
  customClasses?: Partial<ClassInterface>
): ClassInterface {
  return useMemo(() => {
    const mergedCssClasses: ClassInterface = { ...builtInClasses }
    if (!customClasses) {
      return mergedCssClasses;
    }
    Object.keys(customClasses).forEach((key) => {
      const builtIn = builtInClasses[key as keyof ClassInterface];
      const custom = customClasses[key as keyof ClassInterface];
      if (!builtIn || !custom) {
        mergedCssClasses[key as keyof ClassInterface] = custom || builtIn;
      } else {
        mergedCssClasses[key as keyof ClassInterface] = twMerge(builtIn, custom) as ClassInterface[keyof ClassInterface];
      }
    });
    return mergedCssClasses;
  }, [builtInClasses, customClasses]);
}

const builtInCssClasses: Readonly<VerticalResultsCssClasses> = {
  verticalResultsLoading: "opacity-50",
};

interface VerticalResultsDisplayProps<T> {
  CardComponent: CardComponent<T>;
  isLoading?: boolean;
  results: Result<T>[];
  customCssClasses?: VerticalResultsCssClasses;
}

/**
 * A Component that displays all the search results for a given vertical.
 *
 * @param props - The props for the Component, including the results and the card type
 *                to be used.
 */
export function VerticalResultsDisplay<T>(
  props: VerticalResultsDisplayProps<T>
): JSX.Element | null {
  const { CardComponent, results, isLoading = false, customCssClasses } = props;
  const cssClasses = useComposedCssClasses(builtInCssClasses, customCssClasses);

  if (results.length === 0) {
    return null;
  }

  const resultsClassNames = classNames(cssClasses.verticalResultsContainer, {
    [cssClasses.verticalResultsLoading ?? ""]: isLoading,
  });

  return (
    <div className={resultsClassNames}>
      {results?.map((result) => renderResult(CardComponent, result))}
    </div>
  );
}

/**
 * Renders a single result using the specified card and configuration.
 *
 * @param CardComponent - The card for the vertical.
 * @param result - The result to render.
 */
function renderResult<T>(
  CardComponent: CardComponent<T>,
  result: Result<T>
): JSX.Element {
  return <CardComponent result={result} key={result.id || result.index} />;
}
