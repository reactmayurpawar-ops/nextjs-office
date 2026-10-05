import { useTranslation } from "src/i18n";

type NoResultsProps = {};

const NoResults = (props: NoResultsProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      <div className="font-bold font-secondary mb-4">{t("Search Tips")}</div>
      <ol className="flex flex-col list-decimal list-inside">
        <li>{t("Check your spelling")}</li>
        <li>{t("Use a different keyword")}</li>
        <li>{t("Broaden your search")}</li>
      </ol>
    </div>
  );
};

export { NoResults };
