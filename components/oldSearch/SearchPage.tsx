import { useEffect, useMemo, useState } from "react";
import "react-tooltip/dist/react-tooltip.css";
import {
  useSearchActions,
  useSearchState,
  VerticalSearchResponse,
} from "@yext/search-headless-react";
import { ProductProfile } from "src/types/entities";
import { VerticalResults } from "./VerticalResults";
import {
  AnalyticsProvider,
  CardProps,
  Pagination,
} from "@yext/search-ui-react";
import { FilterCombinator, Matcher, provideCore, Result, Source } from "@yext/search-core";
import { useAnalytics } from "@yext/pages/components";
import type {
  ProductSearchProfile,
  SiteProfile,
  TemplateRenderProps,
} from "src/types/entities";
import { Header } from "src/components/common/Header/Header";

import Breadcrumbs from "src/components/common/Breadcrumbs";
import { useLoadInitialSearchParams } from "src/components/search/utils/handleSearchParams";
import { useSearchParams } from "react-router-dom";
import classNames from "classnames";
import type {
  Model,
  Order,
  Part,
  SerialResponse,
} from "src/api/types";
import {
  BUSINESS_ID,
  EXPERIENCE_VERSION,
  SEARCH_API_KEY,
  SF_BASE_URL,
  STREAMS_API_KEY,
} from "src/util";
import { useSILClient } from "src/api/sil";
import { ExactMatch } from "src/components/common/ExactMatch";
import { ProductCard } from "src/components/cards/ProductCard";
import {
  Node,
  findNode,
  pruneTree,
  isInTree,
} from "src/components/search/utils/treeHelpers";
import { ModelResults } from "src/components/search/ModelResults";
import { NonCurrentResult } from "src/components/search/NonCurrentResult";
import { getFacetOrdering } from "src/components/search/utils/apiHelpers";
import { getExactMatchInfo } from "src/components/search/utils/helpers";
import { NoResults } from "src/components/search/NoResults";
import { Categories } from "src/components/search/Categories";
import { ActiveFacets } from "src/components/search/ActiveFacets";
import { NavBar } from "src/components/search/NavBar";
import { BiSlider } from "react-icons/bi";
import { FilterModal } from "src/components/search/FilterModal";
import { CartModal } from "src/components/modals/CartModal";
import { ListModal } from "src/components/modals/ListModal";
import { useUserInfo } from "src/components/common/UserInfoContext";
import { useTemplateData } from "src/common/useTemplateData";
import { WarrantyModal } from "src/components/modals/WarrantyModal";
import SerialSilCard from "src/components/cards/SerialSilCard";
import { fetchExactMatches } from "src/api/yext";
import { R12PricingResponse, useAPIClient } from "src/api/client";
import { useAccountNo, useBrand, useIsDSO, useIsDSOOnly, useShipTo, useSoldToSite, useIsIWD, useIsIWDDistributor, useHasUPLAccess } from "src/common/useUserRole";
import { getBrandedLogo, getBrandName, getTraneSupplyUrl } from "src/common/helpers";
import { StoreInfo } from "src/components/modals/components/StoreList";
import { brandMappings, siteBrandMappings } from "src/common/helpers";
import { Trans } from "react-i18next";
import { useTranslation } from "src/i18n";
import CustomBanner from "./CustomBanner";
import { ProductType } from "../modals/helpers";
import NotificationBanner from "../modals/NotificationBanner";
import TraneSupplyWarningLink from "../common/TraneSupplyWarningLink";

interface SearchPageProps {
  verticalKey: string;
  categorySearch?: boolean;
  data: TemplateRenderProps;
}

const core = provideCore({
  apiKey: SEARCH_API_KEY,
  experienceKey: "products",
  locale: "en",
  experienceVersion: EXPERIENCE_VERSION,
});

export default function SearchPage(props: SearchPageProps) {
  const _site = props.data.document._site as SiteProfile;
  const showCategory = props.verticalKey === "products";
  const [modelResults, setModelResults] = useState<Model[] | null>(null);
  const [silResults, setSILResults] = useState<Order[] | null>(null);
  const [serialAddInfoResults, setSerialAddInfoResults] = useState<Order[] | null>(null);
  const [serialResult, setSerialResults] = useState<SerialResponse[] | null>(
    null
  );
  const [exactMatchResults, setExactMatchResults] = useState<Record<string, { data: ProductProfile; field: string }>>({});
  const [allPartsResults, setAllPartsResults] = useState<Part[] | null>(null);
  const [r12PriceInfo, setR12PriceInfo] = useState<R12PricingResponse | null>(null);
  // Unlike p21, r12 pricing endpoint doesn't include availability, we need to fetch it separately
  const [r12Availability, setR12Availability] = useState<Record<string, StoreInfo[]> | null>(null);
  const [r12UPLResults, setR12UPLResults] = useState<Record<string, boolean> | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listModalType, setListModalType] = useState<
    "saved-list" | "stocking-list"
  >("stocking-list");
  const [activeWarrantyInfo, setActiveWarrantyInfo] = useState<{
    model: string;
    serial: string;
  } | null>(null);
  const apiClient = useAPIClient();
  const silClient = useSILClient();
  const hasUPLAccess = useHasUPLAccess();

  async function getFilteredModelInfo(model: string): Promise<Model[]> {
    const info = await apiClient.getModelInfo(model);
    return (info || []).filter((r) => !r.Model.includes("%"));
  }

  const facets = useSearchState((s) => s.filters.facets);
  const resultsState = useSearchState(
    (s) => s.vertical.results
  ) as unknown as Result<ProductSearchProfile>[];
  const noResults = useSearchState(
    (s) => s.vertical.noResults != undefined
  ) as unknown as Result<ProductSearchProfile>[];
  const results = resultsState || [];
  //Checking for results or if results are empty the noresults field to be filled out to show finished results
  const resultsLoaded = resultsState?.length > 0 || noResults;

  const resultCount = useSearchState((s) => s.vertical.resultsCount);
  const mostRecentSearch =
    useSearchState((s) => s.query.mostRecentSearch) || "";
  const uuid = useSearchState((s) => s.meta.uuid);
  const initialSearchComplete = !!uuid;
  const isLoading = useSearchState((s) => s.searchStatus.isLoading);
  const actions = useSearchActions();
  const [facetOrder, setFacetOrder] = useState<Record<string, number> | null>(
    null
  );
  const [, setSearchParams] = useSearchParams();
  const [categoryTree, setCategoryTree] = useState<Node | null>(null);
  const vertical = useSearchState((s) => s.vertical.verticalKey);
  const [categoryResults, setCategoryResults] =
    useState<VerticalSearchResponse | null>(null);
  const [categorySearchResults, setCategorySearchResults] =
    useState<VerticalSearchResponse | null>(null);
  let verticalKey = useSearchState((s) => s.vertical.verticalKey);
  const staticFilters = useSearchState((s) => s.filters.static);
  const { sharedProfile, dsoProfile, loaded } = useUserInfo();
  const [seenResultIds, setSeenResultIds] = useState<string[]>([]);
  const [showingAvailable, setShowingAvailable] = useState(false);
  const analytics = useAnalytics();
  const accountNumber = useAccountNo();
  const shipTo = useShipTo();
  const soldToSite = useSoldToSite();
  const { relativePrefixToRoot, isPublicDomain  } = useTemplateData();
  const [pricingPromise, setPricingPromise] = useState(Promise.resolve())
  const categoryIdToName = useMemo(() => {
    const m = new Map<string, string>();
    function visit(node: Node) {
      m.set(node.id, node.name);
      for (const child of node.c_subcategories || []) {
        visit(child);
      }
    }
    if (categoryTree) visit(categoryTree);
    return m;
  }, [categoryTree]);

  const brand = useBrand();
  const isDSO = useIsDSO();
  const isDSOOnly = useIsDSOOnly();
  const isIWDDistributor = useIsIWDDistributor();
  const isIWD = useIsIWD();
  const logo = getBrandedLogo(brand, !isDSO, isPublicDomain);

  // Remove solitary numeric tokens from queries when searching categories.
  function sanitizeCategoryQuery(q: string) {
    if (!q) return "";
    const withoutNumbers = q.replace(/\b\d+\b/g, "");
    return withoutNumbers.replace(/\s{2,}/g, " ").trim();
  }

  useEffect(() => {
    actions.setReferrerPageUrl(window.document.referrer);
  }, [actions]);

  useEffect(() => {
    actions.setContext({ storeId: sharedProfile.locationId || "" });
  }, [sharedProfile.locationId]);

  const resultIds = results.map((result) => result.id || "");
  useEffect(() => {
    const resultIds = results.map((result) => result.id || "");
    setSeenResultIds((old) => [...old, ...resultIds]);
  }, [results?.[0]?.id]);

  const filteredAllPartsResults = (allPartsResults || []).filter(
    (res) =>
      !resultIds.includes(res.PartNumber) &&
      !seenResultIds.includes(res.PartNumber)
  );
  const exactAllPartMatch = filteredAllPartsResults.find(
    (res) => res.PartNumber.toLowerCase() === mostRecentSearch.toLowerCase()
  );

  let sidebarTreeRoot = categoryTree;
  let sidebarTreeParents: Node[] = [];
  if (verticalKey !== "products" && categoryTree && verticalKey) {
    [sidebarTreeRoot, sidebarTreeParents] = findNode(
      categoryTree,
      [],
      verticalKey
    );
  }

  function updateVertical(newVertical: string, isSearchResult?: boolean) {
    if (newVertical === verticalKey) return;
    const categoryResult = categorySearchResults?.verticalResults?.results[0]?.id;
    // Clear query if making a category update after a search term matched a category
    if (categoryResult && !isSearchResult) {
      setSearchParams((prev) => ({
        ...Object.fromEntries(prev),
        category: newVertical,
        query: ""
      }));
    } else {
      setSearchParams((prev) => ({
        ...Object.fromEntries(prev),
        category: newVertical,
      }));
    }
    actions.setVerticalLimit(showingAvailable ? 40 : 10);
    const sanitizedForCategories = sanitizeCategoryQuery(mostRecentSearch || "");
    if (sanitizedForCategories) {
      core
        .verticalSearch({
          query: sanitizedForCategories,
          verticalKey: "categories",
        })
        .then((r) => setCategoryResults(r));
    }

    const filtersActive = staticFilters && staticFilters.length;

    actions.setVertical(newVertical);
    if (filtersActive) {
      // Preserve any filters applied to previous vertical
      actions.setStaticFilters(staticFilters);
    }

    actions.executeVerticalQuery();
  }

  useEffect(() => {
    fetch(
      `https://streams.yext.com/v2/accounts/me/api/categoryTree?api_key=${STREAMS_API_KEY}&v=20230101`
    )
      .then((r) => r.json())
      .then((r) =>
        setCategoryTree(
          pruneTree({
            id: "products",
            name: "All Products",
            c_subcategories: r.response.docs,
            c_isActive: true,
          })
        )
      );
  }, []);

  useLoadInitialSearchParams((params) => {
    // Wait until user profile is loaded to perform initial search
    // so that correct filters are applied
    if (!loaded && !isPublicDomain) return;

    const q = params.get("query") || "";
    actions.setQuery(q);

    const cat = params.get("category") || "products";
    if (cat) actions.setVertical(cat);
    setModelResults(null);
    setR12PriceInfo(null);
    setSeenResultIds([]);
    setAllPartsResults(null);
    setCategorySearchResults(null);
    setCategoryResults(null);
    if (q) {
      getModelResults(q);
      getAllPartsResults(q);
      getSerialResults(q);
      getSILResults(q);
      getSerialAdditionalResults(q);
      getExactMatchResults(q);
      const sanitizedForCategories = sanitizeCategoryQuery(q);
      if (sanitizedForCategories) {
        core
          .verticalSearch({ query: sanitizedForCategories, verticalKey: "categories" })
          .then((r) => setCategoryResults(r));
        core
          .verticalSearch({
            query: sanitizedForCategories,
            verticalKey: "all_categories",
          })
          .then((r) => setCategorySearchResults(r));
      }
    }
    if (!q && cat === "products") {
      actions.setVerticalLimit(0);
    }

    const r12OrderingSourceFilter = {
        kind: 'fieldValue' as const,
        fieldId: 'c_orderingSource',
        matcher: Matcher.Equals,
        value: 'R12',
        selected: true,
    }

    const warehouseRankFiltered = (Object.values(dsoProfile?.warehouses || {})).filter((warehouse) => (warehouse.rank !== "3"))

    const warehouseFilters = [
      ...warehouseRankFiltered.map((warehouse) =>
      ({
        kind: "fieldValue" as const,
        fieldId: 'c_tt_Inventory_Org__c',
        matcher: Matcher.Equals,
        value: warehouse.orgCode,
      }))
    ];

    const siteBrand = getBrandName();

    const brandFilterSite = [
      ...(siteBrand ? siteBrandMappings[siteBrand] : []).map((siteBrandFilter: string) =>
      ({
        kind: "fieldValue" as const,
        fieldId: 'c_product2Brand',
        matcher: Matcher.Equals,
        value: siteBrandFilter
      }))
    ];

    const excludeLocalItemsFilter = [
      ({
        kind: "fieldValue" as const,
        fieldId: 'c_tT_Local_Item__c',
        matcher: Matcher.Equals,
        value: false,
      })
    ];

    const filtersWithoutDSOFilter = staticFilters?.filter(filter => filter.displayName !== 'dsoFilteringKey') || [];
    const filters = [...filtersWithoutDSOFilter];
    if (isDSOOnly) {
      filters.push({selected: true, displayName: 'dsoFilteringKey', filter: r12OrderingSourceFilter})
      if (!isIWDDistributor && warehouseFilters.length) {
        filters.push({
          selected: true,
          displayName: "dsoFilteringKey",
          filter: {
            kind: 'disjunction' as const,
            combinator: FilterCombinator.OR,
            filters: warehouseFilters,
          }
        })
      }
      filters.push({
        selected: true,
        displayName: "dsoFilteringKey",
        filter: {
          kind: 'disjunction' as const,
          combinator: FilterCombinator.OR,
          filters: excludeLocalItemsFilter,
        }
      })
    } else if (isDSO) {
      filters.push({selected: true, displayName: 'dsoFilteringKey', filter: r12OrderingSourceFilter})
      if (!isIWDDistributor && warehouseFilters.length) {
        filters.push({
          selected: true,
          displayName: 'dsoFilteringKey',
          filter: {
            kind: "disjunction" as const,
            combinator: FilterCombinator.OR,
            filters: [
              ...warehouseFilters,
            ],
          }
        })
      }
      filters.push({
        selected: true,
        displayName: "dsoFilteringKey",
        filter: {
          kind: 'disjunction' as const,
          combinator: FilterCombinator.OR,
          filters: excludeLocalItemsFilter,
        }
      })
    } else {
      filters.push({selected: true, displayName: 'dsoFilteringKey', filter: r12OrderingSourceFilter})
    }
    if (siteBrand) {
      filters.push({
        selected: true,
        displayName: "brandFilter",
        filter: {
          kind: 'disjunction' as const,
          combinator: FilterCombinator.OR,
          filters: brandFilterSite,
        }
      })
    }
   
    actions.setStaticFilters(filters);

    actions.executeVerticalQuery();
    actions.setVerticalLimit(showingAvailable ? 40 : 10)
    if (analytics && sharedProfile.locationId) {
      analytics.track(`search_loc_${sharedProfile.locationId}`);
    }
  }, [loaded, isPublicDomain]);

  // Redirect query to the vertical specific page if the results only include results from one vertical
  //  this is so that the user can see the vertical-specific facets if it is applicable
  useEffect(() => {
    if (!facets || !results) {
      return;
    } // Do nothing if no facets or no results
    const productCategoryFacets = facets.find(
      (facet) => facet.fieldId === "c_productCategory.c_salesforceID"
    );
    if (!productCategoryFacets) {
      return;
    } // Do nothing if no "c_productCategory.c_salesForceID" facet
    const onlyOneCategory = productCategoryFacets.options?.length === 1;
    const categoryIncludesAllResults =
      productCategoryFacets.options[0]?.count === results.length;

    // Only redirect to a sub-category if no other facets are actively selected.
    // This prevents losing the facet context when a selected facet narrows results to a single category.
    if (onlyOneCategory && categoryIncludesAllResults && !facetSelected) {
      verticalKey = productCategoryFacets.options[0].displayName;
      updateVertical(productCategoryFacets.options[0].displayName);
    }
  }, [facets, results]);

  useEffect(() => {
    async function loadFacetOrdering() {
      const facetOrdering = await getFacetOrdering(verticalKey);
      if (facetOrdering) {
        setFacetOrder(facetOrdering);
      }
    }
    loadFacetOrdering();
  }, [facets]);

  useEffect(() => {
    if (categorySearchResults?.verticalResults?.results[0]?.id) {
      updateVertical(categorySearchResults?.verticalResults?.results[0].id, true)
    }
  }, [categorySearchResults])

  useEffect(() => {
    async function getPricing(currentQuery: string) {
      if (!resultsLoaded) return;
      if ((!results || results.length === 0) && Object.keys(exactMatchResults).length === 0) return;
      const r12Items = results.filter(product => (product.rawData.c_orderingSource || []).includes("R12")).map(product => product.id || '');

      for (const [id, details] of Object.entries(exactMatchResults)) {
        const orderingSources = details?.data?.c_orderingSource || [];
        if (orderingSources.includes("R12")) {
          if (!r12Items.includes(id)) {
            r12Items.push(id)
          }
        }
      }
      let r12PriceInfoSet = null;
      let r12PriceAvailSet= null;

      if (isDSO) {
        const r12Info = await apiClient.getR12PriceInfo(r12Items, accountNumber, soldToSite);
        r12PriceInfoSet = r12Info;

        const r12AvailInfo = await apiClient.getR12Availability(r12Items, accountNumber, shipTo).then(r => r.json());
        r12PriceAvailSet = r12AvailInfo;
      }
      if (currentQuery === mostRecentSearch){
        setR12PriceInfo(r12PriceInfoSet);
        setR12Availability(r12PriceAvailSet);
      } else {
        setR12PriceInfo(null);
        setR12Availability(null);
      }
    }

    setPricingPromise((old) => old.then(() =>
      getPricing(mostRecentSearch)
    ))
  }, [isLoading,mostRecentSearch, JSON.stringify(results), sharedProfile.enterpriseId, sharedProfile.locationId, JSON.stringify(exactMatchResults), accountNumber, shipTo, resultsLoaded]);

  useEffect(() => {
    async function getUPLAvailability(currentQuery: string) {
      if (!resultsLoaded || !hasUPLAccess) return;
      if ((!results || results.length === 0) && Object.keys(exactMatchResults).length === 0) return;

      const r12Products = results
        .filter(product => (product.rawData.c_orderingSource || []).includes("R12"))
        .map(product => ({ id: product.id || "", name: product.name || product.id || "" }));

      for (const [id, details] of Object.entries(exactMatchResults)) {
        const orderingSources = details?.data?.c_orderingSource || [];
        if (orderingSources.includes("R12") && !r12Products.some(p => p.id === id)) {
          r12Products.push({ id, name: details.data.name || id });
        }
      }

      const uplChecks = await Promise.all(
        r12Products.map(async ({ id, name }): Promise<[string, boolean]> => {
          if (!id || !name) return [id, false];
          try {
            const filtered = await getFilteredModelInfo(name);
            return [id, filtered.length > 0];
          } catch {
            return [id, false];
          }
        })
      );

      if (currentQuery === mostRecentSearch) {
        setR12UPLResults(Object.fromEntries(uplChecks));
      } else {
        setR12UPLResults(null);
      }
    }

    getUPLAvailability(mostRecentSearch);
  }, [isLoading, mostRecentSearch, JSON.stringify(results), JSON.stringify(exactMatchResults), resultsLoaded, hasUPLAccess]);

  async function getModelResults(model: string) {
    setModelResults(await getFilteredModelInfo(model));
  }

  async function getSILResults(orderNumber: string) {
    const info = await silClient.fetchSILResults(orderNumber,null);
    setSILResults(info?.results || []);
  }

  async function getSerialAdditionalResults(serialNumber: string) {
    const info = await silClient.fetchSILResults(null,serialNumber);
    setSerialAddInfoResults(info?.results || []);
  }

  async function getExactMatchResults(query: string) {
    const profiles = await fetchExactMatches(query) || [];
    const info = getExactMatchInfo(query, profiles)
    setExactMatchResults(info);
  }

  async function getSerialResults(serial: string) {
    const info: SerialResponse = await apiClient.getSerialInfo(serial);
    if (info?.Model) {
      setSerialResults([info]);
    } else {
      setSerialResults([]);
    }
  }

  async function getAllPartsResults(query: string) {
    const info = await apiClient.getAllPartsInfo(query);
    if (Array.isArray(info)) {
      setAllPartsResults(info || []);
    }
  }

  function openCartModal(partNumber: string) {
    setSelectedProduct(partNumber);
    setCartModalOpen(true);
  }

  function openSavedListModal(partNumber: string) {
    setSelectedProduct(partNumber);
    setListModalType("saved-list");
    setListModalOpen(true);
    analytics?.track("favoriteslist");
  }

  function openStockingListModal(partNumber: string) {
    setSelectedProduct(partNumber);
    setListModalType("stocking-list");
    setListModalOpen(true);
    analytics?.track("stockinglist");
  }

  const selectedProductDetails = results?.find((p) => p.id === selectedProduct) || (exactMatchResults[selectedProduct] ? { id: exactMatchResults[selectedProduct].data.id, rawData: exactMatchResults[selectedProduct].data, source: Source.KnowledgeManager } : null);
  const _selectedFirstCategory = selectedProductDetails?.rawData?.c_productCategory?.[0];
  const _selectedFirstCategoryId = typeof _selectedFirstCategory === "string" ? _selectedFirstCategory : (_selectedFirstCategory?.id || "");
  const selectedProductCategory = categoryIdToName.get(_selectedFirstCategoryId || "");

  const facetSelected =
    (facets || [])
      .filter(
        (facet) =>
          ![
            "c_productCategory.name",
            "c_productCategory.c_salesforceID",
          ].includes(facet.fieldId)
      )
      ?.flatMap((x) => x.options)
      .filter((x) => x.selected)?.length > 0;

  const exactModelMatchModel = (modelResults || []).find(
    (model) => model.Model.toLowerCase() === model.SearchedModel.toLowerCase()
  );
  const exactModelMatch = !!exactModelMatchModel;

  const activeFacetCount =
    facets
      ?.filter(
        (facet) =>
          ![
            "c_productCategory.name",
            "c_productCategory.c_salesforceID",
          ].includes(facet.fieldId) && facet.options.length
      )
      .flatMap((x) => x.options)
      .filter((x) => x.selected).length || 0;

  const HeaderOnSearch = (q: {query?: string, verticalKey?: string}) => {
    if (q.query && q.query === mostRecentSearch) return;
    const query = (q.query || "").replace("*", "").trim();

    setModelResults(null);
    setR12PriceInfo(null);
    setSeenResultIds([]);
    setAllPartsResults(null);
    setSerialResults(null);
    setCategoryResults(null);
    setCategorySearchResults(null);
    actions.setVerticalLimit(showingAvailable ? 40 : 10);
    actions.setVertical("products");

    setSearchParams(new URLSearchParams({ query }));

    if (query) {
      const sanitizedForCategories = sanitizeCategoryQuery(query);
      if (sanitizedForCategories) {
        core
          .verticalSearch({ query: sanitizedForCategories, verticalKey: "categories" })
          .then((r) => setCategoryResults(r));
        core
          .verticalSearch({
            query: sanitizedForCategories,
            verticalKey: "all_categories",
          })
          .then((r) => setCategorySearchResults(r));
      }
    }
    getModelResults(query);
    getSerialResults(query);
    getAllPartsResults(query);
    getSILResults(query);
    getSerialAdditionalResults(query);
    getExactMatchResults(query);

    actions.executeVerticalQuery();
    if (analytics && sharedProfile.locationId) {
      analytics.track(`search_loc_${sharedProfile.locationId}`);
    }
  };
  const { t } = useTranslation();
  const alertBanner = (_site.c_cCEBannerAlert1 && _site.c_cCEBannerAlert1.length > 0) ? _site.c_cCEBannerAlert1.at(0)?.c_alertBanner : "";

  const notificationBannerUrl = getTraneSupplyUrl();
  const notificationBannerMessage = <>
    Looking for Parts or Supplies?{' '}
    <TraneSupplyWarningLink
      href={notificationBannerUrl}
      className="text-orange underline font-medium"
      onNavigate={() => analytics?.track("supplylink")}
    >
      Click here
    </TraneSupplyWarningLink>
    {' '}to visit TRANE Supply
  </>;

  return (
    <AnalyticsProvider
      experienceKey="products"
      experienceVersion={EXPERIENCE_VERSION}
      businessId={BUSINESS_ID}
    >
      <FilterModal
        isOpen={filterModalOpen}
        closeFn={() => setFilterModalOpen(false)}
        showingAvailable={showingAvailable}
        setShowingAvailable={setShowingAvailable}
        verticalKey={verticalKey}
        updateVertical={updateVertical}
        sidebarTreeParents={sidebarTreeParents}
        sidebarTreeRoot={sidebarTreeRoot}
        facetOrder={facetOrder}
      />
      {cartModalOpen && selectedProductDetails && (
        <CartModal
          selectedProduct={selectedProductDetails as ProductType}
          selectedCategory={selectedProductCategory}
          r12PriceInfo={r12PriceInfo}
          r12Availability={r12Availability}
          onClose={() => setCartModalOpen(false)}
          pageName="PLP"
        />
      )}
      {listModalOpen && selectedProductDetails && (
        <ListModal
          selectedProduct={selectedProductDetails}
          selectedCategory={selectedProductCategory}
          onClose={() => setListModalOpen(false)}
          listType={listModalType}
        />
      )}
      {activeWarrantyInfo && (
        <WarrantyModal
          model={activeWarrantyInfo.model}
          serial={activeWarrantyInfo.serial}
          onClose={() => setActiveWarrantyInfo(null)}
        />
      )}

      <Header
        logo={logo}
        onSearch={HeaderOnSearch}
        updateVertical={updateVertical}
      />
      {(alertBanner && alertBanner.liveOnCCESearchPages) && (<CustomBanner message={alertBanner.bannerMessage} />)}

      <div className="flex-grow">
        <div className="container mb-6">
          <div className="flex flex-col">
            <div className="sm:hidden flex items-center justify-between">
              <div>
                {resultCount && (
                  <div className="">
                    {t("{{resultCount}} result(s)",{resultCount: resultCount})}
                    {mostRecentSearch && (t("for: {{mostRecentSearch}}", {mostRecentSearch: mostRecentSearch}))}
                  </div>
                )}
              </div>
              <button
                className="Button Button--secondary flex gap-2"
                onClick={() => setFilterModalOpen(true)}
              >
                {t("Filters")}
                {activeFacetCount > 0 ? `(${activeFacetCount})` : ""}
                <BiSlider />
              </button>
            </div>
            {sidebarTreeRoot && (
              <Breadcrumbs
                className="mb-10"
                breadcrumbs={[
                  ...sidebarTreeParents.map((node) => ({
                    name: node.name,
                    onClick: () => {
                      updateVertical(node.id);
                      analytics?.track("breadcrumb-link");
                    },
                  })),
                  { name: sidebarTreeRoot.name },
                ]}
              />
            )}
          </div>

          {initialSearchComplete && (
            <div className="flex flex-col md:flex-row gap-8">
              <NavBar
                showingAvailable={showingAvailable}
                setShowingAvailable={setShowingAvailable}
                verticalKey={verticalKey}
                updateVertical={updateVertical}
                sidebarTreeParents={sidebarTreeParents}
                sidebarTreeRoot={sidebarTreeRoot}
                facetOrder={facetOrder}
              />
              <div className="flex-grow">
                {!isIWD && <NotificationBanner htmlContent={notificationBannerMessage} />}
                {!resultCount &&
                  modelResults?.length === 0 &&
                  serialResult?.length === 0 &&
                  allPartsResults?.length === 0 &&
                  silResults?.length === 0 &&
                  Object.keys(exactMatchResults).length === 0 && <NoResults />}
                {!!resultCount && (
                  <div className="hidden md:flex gap-2 mb-6">
                    <ActiveFacets />
                  </div>
                )}
                {!facetSelected && (
                  <div>
                    {!mostRecentSearch && vertical === "products" &&  (
                      <Categories
                        title={t("Popular Categories") as string}
                        categories={_site.c_popularCategories}
                        updateVertical={updateVertical}
                      />
                    )}
                    {!!mostRecentSearch &&
                      categoryResults &&
                      Object.keys(exactMatchResults).length === 0 &&
                      !!categoryResults?.verticalResults?.results?.length && (
                        <Categories
                          title={t("Top Matched Categories") as string}
                          categories={categoryResults?.verticalResults?.results
                            ?.filter(
                              (cat) =>
                                categoryTree &&
                                cat.id &&
                                isInTree(categoryTree, cat.id)
                            )
                            ?.slice(0, 8)}
                          updateVertical={updateVertical}
                          addSearchAnalytics={true}
                        />
                      )}
                  </div>
                )}
                {(!!mostRecentSearch ||
                  facetSelected ||
                  vertical !== "products") && (
                  <>
                    {((serialResult || []).length || exactModelMatch) && (
                      <>
                        <h2 className="text-xl mb-4 font-semibold">Serviceable Models</h2>
                        <div className="mb-6">
                          {serialResult && !!serialResult.length && (
                            <ExactMatch
                              className="mb-4"
                              matchField="Serial Number"
                              matchedString={mostRecentSearch}
                            >
                              <>
                                {serialResult.map((result, ind) => {
                                  const detailedResult = (serialAddInfoResults && serialAddInfoResults?.length > ind) ? serialAddInfoResults[ind] : null;
                                  return (
                                    <SerialSilCard
                                      key={ind}
                                      relativePrefixToRoot={relativePrefixToRoot}
                                      modelNumber={result.Model || detailedResult?.Asset_Model_Number__c }
                                      serialNumber={result.SerialNo || detailedResult?.SerialNumber}
                                      salesOrderNumber={detailedResult?.TCSNALA_Legacy_Order_Number__c || "N/A"}
                                      shipDate={detailedResult?.TCSNALA_Ship_Date__c || "N/A"}
                                      jobName={detailedResult?.TCSNALA_Credit_Job_Name__c || "N/A"}
                                      mostRecentSearch={mostRecentSearch}
                                      position={ind}
                                      onWarrantyClick={() =>
                                        setActiveWarrantyInfo({
                                          serial: result.SerialNo,
                                          model: result.Model,
                                        })
                                      }
                                    />
                                )})}
                              </>
                            </ExactMatch>
                          )}
                          {!!(modelResults || []).length && (
                            <ModelResults
                              models={
                                exactModelMatchModel
                                  ? [exactModelMatchModel]
                                  : []
                              }
                            />
                          )}
                        </div>
                      </>
                    )}
                    {!!resultCount && !isLoading && (
                      <div>
                        <h2 className={classNames("text-xl mb-1 font-semibold")}>
                          {t("Orderable Products")}
                        </h2>
                      </div>
                    )}
                    {!isLoading && (
                      <>
                        {Object.entries(exactMatchResults).map(
                          ([id, { data, field }]) => (
                            <ExactMatch
                              key={id}
                              matchField={field}
                              className="mb-2"
                            >
                              <ProductCard
                                profile={{ result: { id: data.id, rawData: data, source: Source.KnowledgeManager }}}
                                categoryNameMap={categoryIdToName}
                                className="my-0"
                                r12PriceInfo={r12PriceInfo}
                                r12Availability={r12Availability}
                                r12UPLResults={r12UPLResults}
                                showCategory={showCategory}
                                addToCartHandler={openCartModal}
                                addToSavedListHandler={openSavedListModal}
                                addToStockingListHandler={openStockingListModal}
                                sharedProfile={sharedProfile}
                              />
                            </ExactMatch>
                          )
                        )}
                      </>
                    )}
                    {!isLoading && (
                      <>
                        <VerticalResults
                          r12PriceInfo={r12PriceInfo}
                          r12Availability={r12Availability}
                          displayAllOnNoResults={false}
                          showingAvailable={showingAvailable}
                          customCssClasses={{
                            verticalResultsContainer: "mb-6",
                          }}
                          CardComponent={(
                            props: CardProps<ProductSearchProfile>
                          ) => {
                            if (
                              props.result.id?.toLowerCase() ===
                                mostRecentSearch.toLowerCase() ||
                              (
                                props?.result?.rawData?.c_vendorPartNumbers ||
                                []
                              ).includes(mostRecentSearch) ||
                              (
                                props.result.rawData.c_drawingNumbers || []
                              ).includes(mostRecentSearch)
                            )
                              return <></>;
                            return (
                              <ProductCard
                                profile={props}
                                categoryNameMap={categoryIdToName}
                                r12PriceInfo={r12PriceInfo}
                                showCategory={showCategory}
                                r12Availability={r12Availability}
                                r12UPLResults={r12UPLResults}
                                addToCartHandler={openCartModal}
                                addToSavedListHandler={openSavedListModal}
                                addToStockingListHandler={openStockingListModal}
                                sharedProfile={sharedProfile}
                              />
                            );
                          }}
                        />
                        <Pagination />
                      </>
                    )}

                    {!!modelResults?.length && !exactModelMatch && (
                      <>
                        <h2 className="text-xl mb-4 font-semibold">{t("Serviceable Models")}</h2>
                        <div className="mb-6">
                          <ModelResults models={modelResults} />
                        </div>
                      </>
                    )}

                    {silResults && silResults?.length !== 0 && (
                      <div>
                        <ExactMatch matchField="Sales Order No." matchedString={mostRecentSearch}>
                          <div className="flex flex-col gap-1 sm:gap-0 bg-brand-tertiary/20">
                            {silResults.map((result, ind) => (
                              <SerialSilCard
                                key={ind}
                                relativePrefixToRoot={relativePrefixToRoot}
                                modelNumber={result.Asset_Model_Number__c}
                                serialNumber={result.SerialNumber || "N/A"}
                                salesOrderNumber={result.TCSNALA_Legacy_Order_Number__c}
                                shipDate={result.TCSNALA_Ship_Date__c || "N/A"}
                                jobName={result.TCSNALA_Credit_Job_Name__c || "N/A"}
                                mostRecentSearch={mostRecentSearch}
                                position={ind}
                                onWarrantyClick={result.Asset_Model_Number__c ? () =>
                                  setActiveWarrantyInfo({
                                    serial: result.SerialNumber,
                                    model: result.Asset_Model_Number__c || "",
                                  }) : null
                                }
                              />
                            ))}
                          </div>
                        </ExactMatch>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AnalyticsProvider>
  );
}
