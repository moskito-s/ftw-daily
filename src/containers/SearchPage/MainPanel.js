import React, { Component } from 'react';
import { array, bool, func, number, object, objectOf, shape, string } from 'prop-types';
import classNames from 'classnames';
import merge from 'lodash/merge';
import omit from 'lodash/omit';
import config from '../../config';
import routeConfiguration from '../../routeConfiguration';
import { FormattedMessage, injectIntl, intlShape } from '../../util/reactIntl';
import { createResourceLocatorString } from '../../util/routes';
import { propTypes } from '../../util/types';
import {
  PriceFilter,
  SelectSingleFilter,
  SelectMultipleFilter,
  SearchResultsPanel,
  SearchFilters,
  SearchFiltersMobile,
  SearchFiltersPanel,
} from '../../components';
import { validFilterParams } from './SearchPage.helpers';

import css from './SearchPage.css';

const FILTER_DROPDOWN_OFFSET = -14;
const RADIX = 10;


const FilterComponent = props => {
  const {
    idPrefix,
    filterConfig,
    urlQueryParams,
    initialSelectSingleValue,
    handleSelectSingle,
    initialSelectMultipleValues,
    handleSelectMultiple,
    initialPriceRangeValue,
    handlePrice,
    ...rest
  } = props;
  const {
    type,
    paramName,
    label,
    config,
  } = filterConfig;
  const { liveEdit, showAsPopup } = rest;

  const prefix = idPrefix || 'SearchPage';
  switch (type) {
    case 'SelectSingleFilter':
      return (
        <SelectSingleFilter
          id={`${prefix}.${label.toLowerCase()}`}
          label={label}
          urlParam={paramName}
          initialValue={initialSelectSingleValue(paramName)}
          onSelect={handleSelectSingle}
          {...config}
          {...rest}
        />
      );
    case 'SelectMultipleFilter':
      return (
        <SelectMultipleFilter
          id={`${prefix}.${label.toLowerCase()}`}
          name={label.replace(/\s+/g, '-').toLowerCase()}
          label={label}
          urlParam={paramName}
          initialValues={initialSelectMultipleValues(paramName)}
          onSubmit={handleSelectMultiple(liveEdit, showAsPopup)}
          {...config}
          {...rest}
        />
      );
    case 'PriceFilter':
      return (
        <PriceFilter
          id={`${prefix}.${label.toLowerCase()}`}
          label={label}
          urlParam={paramName}
          initialValues={initialPriceRangeValue(urlQueryParams, paramName)}
          onSubmit={handlePrice}
          {...config}
          {...rest}
        />
      );
  }
};

class MainPanel extends Component {
  constructor(props) {
    super(props);
    this.state = { isSearchFiltersPanelOpen: false, currentQueryParams: props.urlQueryParams };

    this.applyFilters = this.applyFilters.bind(this);
    this.cancelFilters = this.cancelFilters.bind(this);
    this.resetAll = this.resetAll.bind(this);

    // SelectSingleFilter
    this.handleSelectSingle = this.handleSelectSingle.bind(this);
    this.initialSelectSingleValue = this.initialSelectSingleValue.bind(this);

    // SelectMultipleFilter
    this.handleSelectMultiple = this.handleSelectMultiple.bind(this);
    this.initialSelectMultipleValues = this.initialSelectMultipleValues.bind(this);

    // PriceFilter
    this.initialPriceRangeValue = this.initialPriceRangeValue.bind(this);
    this.handlePrice = this.handlePrice.bind(this);
  }


  // Apply the filters by redirecting to SearchPage with new filters.
  applyFilters() {
    const { history, urlQueryParams, } = this.props;

    history.push(
      createResourceLocatorString(
        'SearchPage',
        routeConfiguration(),
        {},
        { ...urlQueryParams, ...this.state.currentQueryParams }
      )
    );
  }

  // Close the filters by clicking cancel, revert to the initial params
  cancelFilters() {
    this.setState({ currentQueryParams: {} });
  }

  // Reset all filter query parameters
  resetAll(e) {
    // const { urlQueryParams, history, primaryFilters, secondaryFilters } = this.props;
    const { urlQueryParams, history, filterConfig } = this.props;

    // TODO
    // const filters = merge({}, primaryFilters, secondaryFilters);
    const filterParamNames = filterConfig.map(f => f.paramName);//Object.values(filters).map(f => f.paramName);

    const queryParams = omit(urlQueryParams, filterParamNames);
    history.push(createResourceLocatorString('SearchPage', routeConfiguration(), {}, queryParams));
  }

  // resolve initial value for a single value filter
  initialSelectSingleValue(paramName) {
    const currentQueryParams = this.state.currentQueryParams;
    const urlQueryParams = this.props.urlQueryParams;

    // initialValue for SelectSingleFilter should come
    // either from state.currentQueryParam or urlQueryParam
    const currentQueryParam = currentQueryParams[paramName];

    return typeof currentQueryParam !== 'undefined' ? currentQueryParam : urlQueryParams[paramName];
  }

  handleSelectSingle(urlParam, option, liveEdit=false) {
    const urlQueryParams = this.props.urlQueryParams;
    this.setState(prevState => {
      const prevQueryParams = prevState.currentQueryParams;
      const mergedQueryParams = { ...urlQueryParams, ...prevQueryParams };

      // query parameters after selecting the option
      // if no option is passed, clear the selection for the filter
      const currentQueryParams = option
        ? { ...mergedQueryParams, [urlParam]: option }
        : { ...mergedQueryParams, [urlParam]: null };

      return { currentQueryParams };
    });
  }

  // resolve initial values for a multi value filter
  initialSelectMultipleValues(paramName) {
    const currentQueryParams = this.state.currentQueryParams;
    const urlQueryParams = this.props.urlQueryParams;

    const splitQueryParam = queryParam => (queryParam ? queryParam.split(',') : []);

    // initialValue for a SelectMultipleFilter should come
    // either from state.currentQueryParam or urlQueryParam
    const hasCurrentQueryParam = typeof currentQueryParams[paramName] !== 'undefined';

    return hasCurrentQueryParam
      ? splitQueryParam(currentQueryParams[paramName])
      : splitQueryParam(urlQueryParams[paramName]);
  }

  handleSelectMultiple(liveEdit, showAsPopup) {
    const { urlQueryParams, history } = this.props;

    return (urlParam, selectedOptions) => {
      const hasOptionsSelected = selectedOptions && selectedOptions.length > 0;
      if (liveEdit || showAsPopup) {
        const queryParams = hasOptionsSelected
          ? { ...urlQueryParams, [urlParam]: selectedOptions.join(',') }
          : omit(urlQueryParams, urlParam);

        history.push(createResourceLocatorString('SearchPage', routeConfiguration(), {}, queryParams));

      } else {
        this.setState(prevState => {
          const prevQueryParams = prevState.currentQueryParams;
          const mergedQueryParams = { ...urlQueryParams, ...prevQueryParams };

          // Wuery parameters after selecting options
          // If no option is passed, clear the selection from state.currentQueryParams
          const currentQueryParams = hasOptionsSelected
              ? { ...mergedQueryParams, [urlParam]: selectedOptions.join(',') }
              : { ...mergedQueryParams, [urlParam]: null };

          return { currentQueryParams };
        });
      }
    };
  }

  initialPriceRangeValue(queryParams, paramName) {
    const price = queryParams[paramName];
    const valuesFromParams = !!price ? price.split(',').map(v => Number.parseInt(v, RADIX)) : [];

    return !!price && valuesFromParams.length === 2
      ? {
          minPrice: valuesFromParams[0],
          maxPrice: valuesFromParams[1],
        }
      : null;
  }

  handlePrice(urlParam, range) {
    const { history, urlQueryParams} = this.props;
    const { minPrice, maxPrice } = range || {};
    const queryParams =
      minPrice != null && maxPrice != null
        ? { ...urlQueryParams, [urlParam]: `${minPrice},${maxPrice}` }
        : omit(urlQueryParams, urlParam);

    history.push(createResourceLocatorString('SearchPage', routeConfiguration(), {}, queryParams));
  }

  render() {
    const {
      className,
      rootClassName,
      urlQueryParams,
      sort,
      listings,
      searchInProgress,
      searchListingsError,
      searchParamsAreInSync,
      onActivateListing,
      onManageDisableScrolling,
      onOpenModal,
      onCloseModal,
      onMapIconClick,
      pagination,
      searchParamsForPagination,
      showAsModalMaxWidth,
      intl,
      filterConfig,
      // primaryFilters,
      // secondaryFilters,
    } = this.props;

    const primaryFilters = filterConfig.filter(f => f.group === 'primary');
    const secondaryFilters = filterConfig.filter(f => f.group !== 'primary');

    const isSearchFiltersPanelOpen = !!secondaryFilters && this.state.isSearchFiltersPanelOpen;

    // let filters = merge({}, primaryFilters, secondaryFilters);

    const selectedFilters = validFilterParams(urlQueryParams, filterConfig);
    const selectedFiltersCount = Object.keys(selectedFilters).length;

    const selectedSecondaryFilters = secondaryFilters
      ? validFilterParams(urlQueryParams, secondaryFilters)
      : {};
    const searchFiltersPanelSelectedCount = Object.keys(selectedSecondaryFilters).length;

    const searchFiltersPanelProps = !!secondaryFilters
      ? {
          isSearchFiltersPanelOpen: this.state.isSearchFiltersPanelOpen,
          toggleSearchFiltersPanel: isOpen => {
            this.setState({ isSearchFiltersPanelOpen: isOpen });
          },
          searchFiltersPanelSelectedCount,
        }
      : {};

    const hasPaginationInfo = !!pagination && pagination.totalItems != null;
    const totalItems = searchParamsAreInSync && hasPaginationInfo ? pagination.totalItems : 0;
    const listingsAreLoaded = !searchInProgress && searchParamsAreInSync && hasPaginationInfo;

    const classes = classNames(rootClassName || css.searchResultContainer, className);

    const filterParamNames = filterConfig.map(f => f.paramName);// Object.values(filters).map(f => f.paramName);
    const secondaryFilterParamNames = secondaryFilters
      ? Object.values(secondaryFilters).map(f => f.paramName)
      : [];


    // const categoryLabel = intl.formatMessage({
    //   id: 'SearchFiltersPanel.categoryLabel',
    // });

    // const amenitiesLabel = intl.formatMessage({
    //   id: 'SearchFiltersPanel.amenitiesLabel',
    // });


    const stateFunctions = {
      urlQueryParams,

      initialPriceRangeValue: this.initialPriceRangeValue,
      handlePrice: this.handlePrice,

      initialSelectSingleValue: this.initialSelectSingleValue,
      handleSelectSingle: this.handleSelectSingle,

      initialSelectMultipleValues: this.initialSelectMultipleValues,
      handleSelectMultiple: this.handleSelectMultiple,
    };

    return (
      <div className={classes}>
        <SearchFilters
          className={css.searchFilters}
          urlQueryParams={urlQueryParams}
          sort={sort}
          listingsAreLoaded={listingsAreLoaded}
          resultsCount={totalItems}
          searchInProgress={searchInProgress}
          searchListingsError={searchListingsError}
          onManageDisableScrolling={onManageDisableScrolling}
          {...searchFiltersPanelProps}
        >
          {primaryFilters.map(config => {
            return (
              <FilterComponent
                idPrefix="SearchFilters"
                filterConfig={config}
                showAsPopup
                contentPlacementOffset={FILTER_DROPDOWN_OFFSET}
                {...stateFunctions}
              />
            );
          })}
        </SearchFilters>
        <SearchFiltersMobile
          className={css.searchFiltersMobile}
          urlQueryParams={urlQueryParams}
          sort={sort}
          listingsAreLoaded={listingsAreLoaded}
          resultsCount={totalItems}
          searchInProgress={searchInProgress}
          searchListingsError={searchListingsError}
          showAsModalMaxWidth={showAsModalMaxWidth}
          onMapIconClick={onMapIconClick}
          onManageDisableScrolling={onManageDisableScrolling}
          onOpenModal={onOpenModal}
          onCloseModal={onCloseModal}
          filterParamNames={filterParamNames}
          resetAll={this.resetAll}
          selectedFiltersCount={selectedFiltersCount}
        >
          {filterConfig.map(config => {
            return (
              <FilterComponent
                idPrefix="SearchFiltersMobile"
                filterConfig={config}
                liveEdit
                {...stateFunctions}
              />
            );
          })}
        </SearchFiltersMobile>
        {isSearchFiltersPanelOpen ? (
          <div className={classNames(css.searchFiltersPanel)}>
            <SearchFiltersPanel
              urlQueryParams={urlQueryParams}
              sort={sort}
              listingsAreLoaded={listingsAreLoaded}
              applyFilters={this.applyFilters}
              cancelFilters={this.cancelFilters}
              resetAll={this.resetAll}
              onClosePanel={() => this.setState({ isSearchFiltersPanelOpen: false })}
              filterParamNames={secondaryFilterParamNames}
            >
              {secondaryFilters.map(config => {
                return (
                  <FilterComponent
                    idPrefix="SearchFiltersPanel"
                    filterConfig={config}
                    {...stateFunctions}
                  />
                );
              })}
            </SearchFiltersPanel>
          </div>
        ) : (
          <div
            className={classNames(css.listings, {
              [css.newSearchInProgress]: !listingsAreLoaded,
            })}
          >
            {searchListingsError ? (
              <h2 className={css.error}>
                <FormattedMessage id="SearchPage.searchError" />
              </h2>
            ) : null}
            <SearchResultsPanel
              className={css.searchListingsPanel}
              listings={listings}
              pagination={listingsAreLoaded ? pagination : null}
              search={searchParamsForPagination}
              setActiveListing={onActivateListing}
            />
          </div>
        )}
      </div>
    );
  }
}

MainPanel.defaultProps = {
  className: null,
  rootClassName: null,
  listings: [],
  resultsCount: 0,
  pagination: null,
  searchParamsForPagination: {},
  filterConfig: config.custom.filters,
  // primaryFilters: null,
  // secondaryFilters: null,
};

MainPanel.propTypes = {
  className: string,
  rootClassName: string,

  urlQueryParams: object.isRequired,
  listings: array,
  searchInProgress: bool.isRequired,
  searchListingsError: propTypes.error,
  searchParamsAreInSync: bool.isRequired,
  onActivateListing: func.isRequired,
  onManageDisableScrolling: func.isRequired,
  onOpenModal: func.isRequired,
  onCloseModal: func.isRequired,
  onMapIconClick: func.isRequired,
  pagination: propTypes.pagination,
  searchParamsForPagination: object,
  showAsModalMaxWidth: number.isRequired,
  filterConfig: array,//TODO,
  //primaryFilters: objectOf(propTypes.filterConfig),
  //secondaryFilters: objectOf(propTypes.filterConfig),

  // from injectIntl
  intl: intlShape.isRequired,

  history: shape({
    push: func.isRequired,
  }).isRequired,
};

export default injectIntl(MainPanel);
