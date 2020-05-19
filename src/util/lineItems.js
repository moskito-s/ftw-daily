import Decimal from 'decimal.js';
import { nightsBetween, daysBetween } from './dates';
import { unitDivisor, convertMoneyToNumber, convertUnitToSubUnit } from './currency';
import { types as sdkTypes } from './sdkLoader';
const { Money } = sdkTypes;

/** Expected output:
  `lineItems`: Collection of line items (max 50). Each line items has following fields:
    - `code`: string, mandatory, indentifies line item type (e.g. \"line-item/cleaning-fee\"), maximum length 64 characters.
    - `unitPrice`: money, mandatory
    - `lineTotal`: money
    - `quantity`: number
    - `percentage`: number (e.g. 15.5 for 15.5%)
    - `seats`: number
    - `units`: number
    - `includeFor`: array containing strings \"customer\" or \"provider\", default [\":customer\"  \":provider\" ]

  Line item must have either `quantity` or `percentage` or both
  `seats` and `units`.
  `lineTotal` is calculated by the following rules:
  - If `quantity` is provided, the line total will
  be `unitPrice * quantity`.
  - If `percentage` is provided, the line
  total will be `unitPrice * (percentage / 100)`.
  - If `seats` and `units` are provided the line item will contain `quantity` as a
  product of `seats` and `units` and the line total will be `unitPrice
  * units * seats`.
  `lineTotal` can be optionally passed in. Will be validated against
  calculated line total.
  `includeFor` defines commissions. Customer commission is added by
  defining `includeFor` array `[\"customer\"]` and provider commission by `[\"provider\"]`.
 */

const calculateTotalPriceFromQuantity = (unitPrice, unitCount) => {
  const numericPrice = convertMoneyToNumber(unitPrice);
  const numericTotalPrice = new Decimal(numericPrice).times(unitCount).toNumber();
  return new Money(
    convertUnitToSubUnit(numericTotalPrice, unitDivisor(unitPrice.currency)),
    unitPrice.currency
  );
};

const calculateTotalPriceFromPercentage = (unitPrice, percentage) => {
  const numericPrice = convertMoneyToNumber(unitPrice);
  const numericTotalPrice = new Decimal(numericPrice)
    .times(percentage)
    .dividedBy(100)
    .toNumber();
  return new Money(
    convertUnitToSubUnit(numericTotalPrice, unitDivisor(unitPrice.currency)),
    unitPrice.currency
  );
};

const lineItem = params => {
  console.log('params', params);
  const { name, unitPrice, quantity, percentage, seats, units, includeFor } = params;

  let pricingParams;

  if (quantity) {
    pricingParams = { quantity, lineTotal: calculateTotalPriceFromQuantity(unitPrice, quantity) };
  } else if (percentage) {
    pricingParams = {
      percentage,
      lineTotal: calculateTotalPriceFromPercentage(unitPrice, percentage),
    };
  } else if (seats && units) {
    pricingParams = { seats, units, lineTotal: unitPrice * units * seats };
  } else {
    console.error("Can't calculate the lineTotal of lineItem: ", name);
    console.error('Make sure you have provided quantity, percentage or both seats and units');
  }

  console.log('pricing params ', pricingParams);

  return {
    code: `line-item/${name}`,
    unitPrice,
    includeFor: includeFor ? includeFor : ['customer', 'provider'],
    ...pricingParams,
  };
};

const createBookingLineItem = (unitType, bookingStart, bookingEnd, unitPrice, quantity) => {
  const now = new Date();
  const isNightly = unitType === 'night';
  const isDaily = unitType === 'day';

  const unitCount = isNightly
    ? nightsBetween(bookingStart, bookingEnd)
    : isDaily
    ? daysBetween(bookingStart, bookingEnd)
    : quantity;

  const bookingLineitem = lineItem({ name: unitType, unitPrice, quantity: unitCount });

  return bookingLineitem;
};

const commissionLineItem = (unitPrice, includeFor, commissionsConfig) => {
  if (commissionsConfig.length > 0) {
    return commissionsConfig.map(commissionConfig => {
      console.log('commissionConfig', commissionConfig);
      const name = commissionConfig.percentage
        ? `${includeFor}-commisson`
        : `fixed-${includeFor}-commission`;

      // TODO: Handle min and max commission when needed

      return lineItem({
        name,
        unitPrice: commissionConfig.unitPrice ? commissionConfig.unitPrice : unitPrice,
        includeFor,
        percentage: commissionConfig.percentage,
        quantity: !commissionConfig.percentage ? 1 : null,
      });
    });
  }

  return null;
};

/**

  Line item must have either `quantity` or `percentage` or both
  `seats` and `units`.
  `lineTotal` is calculated by the following rules:
  - If `quantity` is provided, the line total will
  be `unitPrice * quantity`.
  - If `percentage` is provided, the line
  total will be `unitPrice * (percentage / 100)`.
  - If `seats` and `units` are provided the line item will contain `quantity` as a
  product of `seats` and `units` and the line total will be `unitPrice
  * units * seats`.
 */

//TODO: these should come e.g. from BookingForm
const bookingParams = {
  bookingStart: new Date('2018-04-20T12:00:00.000Z'),
  bookingEnd: new Date('2018-04-22T16:00:00.000Z'),
  unitPrice: new Money(25000, 'USD'),
};

// WIP! Move to config.js or create a new file and maybe get the currency from config
const priceConfig = {
  bookingUnitType: 'night',
  commission: {
    provider: [{ percentage: -15, min: new Money(2000, 'USD'), max: new Money(10000, 'USD') }],
    customer: [{ unitPrice: new Money(2500, 'USD') }],
  },
};

const lineItemsBasedOnConfig = (priceConfig, bookingParams) => {
  const { bookingStart, bookingEnd, unitPrice } = bookingParams;

  const bookingLineItem = createBookingLineItem(
    priceConfig.bookingUnitType,
    bookingStart,
    bookingEnd,
    unitPrice
  );

  // By default the commissions are calculated from the booking total atm.
  // TODO: if there is other lineItems they should be included too (or this should be configurable)
  const bookingTotal = bookingLineItem.lineTotal,

  const providerCommissionsConfig = priceConfig.commission && priceConfig.commission.provider;

  const providerCommissionMaybe = commissionLineItem(
    bookingTotal,
    'provider',
    providerCommissionsConfig
  );

  const customerCommissionsConfig = priceConfig.commission && priceConfig.commission.customer;

  const customerCommisisonMaybe = commissionLineItem(
    bookingTotal,
    'customer',
    customerCommissionsConfig
  );

  // TODO propably not the best way to consruct the line items array
  return [bookingLineItem].concat(providerCommissionMaybe).concat(customerCommisisonMaybe);
};

console.log('LINEITEMS: ', lineItemsBasedOnConfig(priceConfig, bookingParams));
/**
0:
code: "line-item/night"
includeFor: (2) ["customer", "provider"]
lineTotal: t {_sdkType: "Money", amount: 50000, currency: "USD"}
quantity: 2
unitPrice: t {_sdkType: "Money", amount: 25000, currency: "USD"}
__proto__: Object

1:
code: "line-item/provider-commisson"
includeFor: "provider"
lineTotal: t {_sdkType: "Money", amount: -7500, currency: "USD"}
percentage: -15
unitPrice: t {_sdkType: "Money", amount: 50000, currency: "USD"}
__proto__: Object

2:
code: "line-item/fixed-customer-commission"
includeFor: "customer"
lineTotal: t {_sdkType: "Money", amount: 2500, currency: "USD"}
quantity: 1
unitPrice: t {_sdkType: "Money", amount: 2500, currency: "USD"}
__proto__: Object
length: 3
__proto__: Array(0)
 */
