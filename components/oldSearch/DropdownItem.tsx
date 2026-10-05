import { useAPIClient } from "src/api/client";

import { useEffect, useState } from "react";
import { BsDashSquare } from "react-icons/bs";
import { BsPlusSquare } from "react-icons/bs";
import classNames from "classnames";
import useCollapse from "react-collapsed";
import "src/styles/Product.css";
import type { Part } from "src/api/types";

function mapDataToDropdown(data: Part[]): { key: string, value: any }[][] {
  return data.map(part => {
    return Object.keys(part).map(key => ({
      key,
      value: (part as any)[key]
    }))
      .filter(pair => pair.value);
  });
}

const DropdownItem = (props: DropdownItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [partsApiResponse, setPartsApiResponse] = useState<Part[] | null>(null);
  const [supersessionsApiResonse, setSupersessionsApiResponse] = useState<Part | null>(null);
  const apiClient = useAPIClient();
  const isParts = props.name === "Technical Specifications";
  const isSupersession = props.name === "Relationships";
  const supersessionHeaders = ["Supersessions", "Reverse Supersessions", "Substitutions"];

  const handleClick = () => {
    setIsOpen(!isOpen);
    setIsAnimating(true);
  };

  const handleAnimationEnd = () => {
    setIsAnimating(false);
  };

  useEffect(() => {
    const parts = async () => {
      const response = await apiClient.getAllPartsInfo(props.data);
      setPartsApiResponse(response);
    }
    const supersessions = async () => {
      const response = await apiClient.getAllSupersessionInfo(props.data);
      setSupersessionsApiResponse(response);
    };
    parts();
    supersessions();
  }, []);

  interface Part {
    BalloonNumber: any;
    Children: any;
    ComponentNumber: any;
    Description: string;
    HasImage: boolean;
    PartsListNumber: any;
    TypeOfComponentIndicator: any;
    AllowDetailView: boolean;
    Attributes: any[];
    BookPrice: string | null;
    ClassDescription: string | null;
    ComponentClass: string | null;
    ComponentParent: any;
    DeptCode: any;
    DrawingOrCodeNumber: any;
    ExternalNote: any;
    Functional: string | null;
    HasBeenSuperseded: boolean;
    HazardousMaterial: string | null;
    Height: string | null;
    ImageUrl: any;
    Length: string | null;
    ListPrice: string | null;
    Location: any;
    MSDS: any;
    MfgLocation: string;
    MfgLocationDescription: string | null;
    Note: any;
    PartCode: string | null;
    PartNumber: string;
    PartsISupersede: {
      PartsISupersede: any; PartNumber: string; SupersedeMessage: string | null;
    }[];
    PartsThatSupersedeMe: {
      PartsThatSupersedeMe: any; PartNumber: string; SupersedeMessage: string | null;
    }[];
    ProcessingCode: string | null;
    Quantity: any;
    StockReturn: any;
    SupersedeMessage: string | null;
    SupplierPartNumber: any;
    UOM: string | null;
    UnitPack: string | null;
    VendorNumber: any;
    Weight: string | null;
    Width: string | null;
    ImageNameWithPath: string | null;
    MappedModelNumber: string | null;
  }

  function formatSupersessionData(data: Part): FormattedData {
    const supersessions = data.PartsThatSupersedeMe?.map(part => {
      // Have to find deepest supersession part
      let currPart = part
      while (currPart?.PartsThatSupersedeMe?.length > 0) {
        currPart = part.PartsThatSupersedeMe[0];
      }

      const partNumber = part?.PartNumber;
      let supersedeMessage = part?.SupersedeMessage;
      let partNumberThatSupersedeMe = "";

      if (currPart.PartNumber !== partNumber) {
        partNumberThatSupersedeMe = currPart?.PartNumber;
        supersedeMessage = currPart?.SupersedeMessage
      }

      return {
        partNumber,
        supersedeMessage,
        partNumberThatSupersedeMe,
      }
    });
    const reverseSupersessions = data.PartsISupersede.map(part => ({
      partNumber: part.PartNumber,
      supersedeMessage: part.SupersedeMessage,
    }));

    return {
      Supersessions: supersessions,
      // Substitutions: substitutions, -- TODO Client not sending substitution data
      ReverseSupersessions: reverseSupersessions
    };
  }

  return (
    <div>
      <div
        className={classNames(
          "bg-brand-gray-300 py-2 px-4 font-secondary font-bold rounded flex items-center justify-between hover:cursor-pointer",
          {
            "rounded-b-none": isOpen,
            "mb-2": !isOpen,
          }
        )}
        onClick={handleClick}
      >
        <div>{props.name}</div>
        {isOpen ? <BsDashSquare /> : <BsPlusSquare />}
      </div>
      {isOpen && (
        <div className={classNames(
          "rounded rounded-t-none transition-all duration-500 border-brand-gray-300 border border-t-0 mb-2",
          {
            "slide-down-enter": isOpen && isAnimating,
            "slide-up-exit": !isOpen && isAnimating,
          }
        )}
          onAnimationEnd={handleAnimationEnd}
        >
          {isParts && partsApiResponse && (
            <PartsDropdownContent content={mapDataToDropdown(partsApiResponse)}/>
          )}
          {isSupersession && supersessionsApiResonse && ( // TODO for when API call gets working
            <SupersessionDropdownContent content={formatSupersessionData(supersessionsApiResonse)} sectionHeaders={supersessionHeaders}/>
          )}
        </div>
      )}
    </div>
  );
};

type DropdownColumn = {
  key: string;
  value: any;
};

interface DropdownItemProps {
  name: string;
  data: string;
}

interface SuperSessionItemProps {
  partNumber: string;
  supersedeMessage: string | null;
  partNumberThatSupersedeMe?: string;
}

interface FormattedData {
  Supersessions: SuperSessionItemProps[];
  ReverseSupersessions: SuperSessionItemProps[];
  //TODO @jyang - client isn't providing substitution data
  // Substitutions: { PartNumber: string; Substitutions: string[] }[];
}

interface PartsDropdownContentProps {
  content: DropdownColumn[][];
}

interface SupersessionDropdownContentProps {
  content: FormattedData;
  sectionHeaders: string[];
}

interface SupersessionSubsectionProps {
  sectionHeader: string;
  parts: SuperSessionItemProps[];
  noArrows?: boolean;
}

const PartsDropdownContent = (props: PartsDropdownContentProps) => {
  const { content } = props;
  return (
    <div className="lg:py-4 px-4 grid grid-cols-2 gap-1">
      {content[0].map((pair, pairIdx) => (
        <div key={pairIdx} className={`py-1 px-4 flex justify-between ${(pairIdx % 4 === 0 || pairIdx % 4 === 3) ? 'bg-white' : 'bg-brand-gray-200'
          }`}>
          <div key={pairIdx} className="flex justify-between w-full">
            <div className="">{pair.key}</div>
            <div className="">{pair.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
};

const SupersessionDropdownContent = (props: SupersessionDropdownContentProps) => {
  const { content, sectionHeaders } = props;
  return (
    <div className="lg:py-4 px-4 grid grid-cols-1 gap-1">
      <SupersessionSubsection
        sectionHeader={sectionHeaders[0]}
        parts={content.Supersessions}
      />
      <SupersessionSubsection
        sectionHeader={sectionHeaders[1]}
        parts={content.ReverseSupersessions}
      />
    </div>
  )
}

const SupersessionSubsection = (props: SupersessionSubsectionProps) => {
  const { sectionHeader, parts } = props;
  return (
    <div>
      <div className="font-bold py-2 pl-4">{sectionHeader}</div>
      {parts.map((part, index) => (
        <div key={index}>
          {part?.partNumber &&
            <div key={index} className={`py-1 px-4 flex flex-col justify-between ${(index % 2 === 0) ? 'bg-brand-gray-200' : 'bg-white'}`}>
              <div className="flex justify-between">
                <div className="flex whitespace-nowrap flex-row mr-8">
                  {part.partNumber}
                  {part.partNumberThatSupersedeMe && (
                    <>
                      <span className="mx-1"> &gt;&gt;&gt;&gt; </span>
                      <span>{part.partNumberThatSupersedeMe}</span>
                    </>
                  )}</div>
                {part.supersedeMessage && (
                  <div className="text-sm text-gray-500 flex flex-row">{part.supersedeMessage}</div>
                )}
              </div>
            </div>
          }
        </div>
      ))}
      {parts.length < 1 && (
        <div className="py-1 px-4 flex flex-col justify-between bg-brand-gray-200">
          <div className="flex justify-between">
            <div className="flex whitespace-nowrap flex-row mr-8">No data available</div>
          </div>
        </div>
      )}
    </div>
  );
}


export { DropdownItem };
