import type { Part } from "src/api/types";

import classNames from "classnames";
import { DropdownItem } from "./DropdownItem";


interface NonCurrentResultProps {
  part: Part;
  className?: string;
}

function NonCurrentResult(props: NonCurrentResultProps) {
  const cls = classNames(
    "border border-solid border-brand-gray-300 shadow-card-shadow p-4 text-black rounded",
    props.className
  );
  const { part } = props;
  
  return (
    <div className={cls} key={part.PartNumber}>
      <div className="font-semibold text-xl mb-2">{part.PartNumber}</div>
      <div>{part.Description}</div>
      <div className="dropdownContainer pt-4">
        <DropdownItem data={part.PartNumber} name="Technical Specifications" />
        <DropdownItem data={part.PartNumber} name="Relationships" />
        {/* TODO: Below is (allegedly) coming soon... */}
        {/* <DropdownItem name="More Info"/> */}
      </div>
    </div>
  );
}

export { NonCurrentResult };
