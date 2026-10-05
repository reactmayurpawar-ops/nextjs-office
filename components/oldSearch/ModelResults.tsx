import { Model } from "src/api/types";

import { ExactMatch } from "src/components/common/ExactMatch";
import { ModelCard } from "../cards/ModelCard";

interface ModelResultsProps {
  models: Model[];
}
function ModelResults(props: ModelResultsProps) {
  return (
    <>
      {props.models.map((model) => {
        if (model.SearchedModel === model.Model) {
          return (
            <ExactMatch key={model.Model} matchField="Model Number">
              <ModelCard model={model} />
            </ExactMatch>
          );
        }

        return <ModelCard key={model.Model} model={model} />;
      })}
    </>
  );
}

export { ModelResults };
