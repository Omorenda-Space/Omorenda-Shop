const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  NZD: 2,
  CHF: 2,
  SEK: 2,
  NOK: 2,
  DKK: 2,
  JPY: 0,
  KRW: 0,
  VND: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  TND: 3,
  JOD: 3,
};

export function getCurrencyDecimals(currency?: string | null) {
  if (!currency) {
    return 2;
  }
  const code = currency.toUpperCase();
  return CURRENCY_DECIMALS[code] ?? 2;
}

export function formatCurrencyAmount(amount: number, currency?: string | null) {
  const decimals = getCurrencyDecimals(currency);
  return amount.toFixed(decimals);
}

export function toMinorUnits(amount: number, currency?: string | null) {
  const decimals = getCurrencyDecimals(currency);
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor);
}

export function formatMinorUnits(minorUnits: number, currency?: string | null) {
  const decimals = getCurrencyDecimals(currency);
  const factor = Math.pow(10, decimals);
  return (minorUnits / factor).toFixed(decimals);
}

