export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  isPopular?: boolean;
}

export interface CurrencyHistoryItem {
  id: string;
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  rate: number;
  timestamp: number;
  formattedDate: string;
  formattedTime: string;
  formattedDay: string;
  inWordsIndian: string;
  inWordsInternational: string;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', isPopular: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', isPopular: true },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', isPopular: true },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', isPopular: true },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪', isPopular: true },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦', isPopular: true },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦', isPopular: true },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', isPopular: true },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', isPopular: true },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', isPopular: true },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', flag: '🇰🇼' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', flag: '🇶🇦' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', flag: '🇴🇲' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', flag: '🇧🇭' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
];

// Fallback rates against USD (updated for 2026)
const FALLBACK_RATES_USD: Record<string, number> = {
  USD: 1.0,
  INR: 88.5,
  EUR: 0.93,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  CAD: 1.39,
  AUD: 1.54,
  JPY: 153.2,
  SGD: 1.33,
  KWD: 0.31,
  QAR: 3.64,
  OMR: 0.38,
  BHD: 0.38,
  CNY: 7.24,
  CHF: 0.88,
  MYR: 4.42,
  THB: 34.6,
};

let cachedRates: Record<string, number> = { ...FALLBACK_RATES_USD };
let lastFetchTime = 0;

export async function fetchLiveRates(): Promise<Record<string, number>> {
  const now = Date.now();
  // Cache for 30 minutes
  if (now - lastFetchTime < 30 * 60 * 1000 && Object.keys(cachedRates).length > 5) {
    return cachedRates;
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) {
        cachedRates = { ...FALLBACK_RATES_USD, ...data.rates };
        lastFetchTime = now;
        return cachedRates;
      }
    }
  } catch (err) {
    console.warn('Live rates fetch failed, using fallback exchange rates:', err);
  }

  return cachedRates;
}

export function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number> = cachedRates
): { result: number; rate: number } {
  if (isNaN(amount) || amount === 0) return { result: 0, rate: 1 };
  if (fromCode === toCode) return { result: amount, rate: 1 };

  const fromRate = rates[fromCode] || FALLBACK_RATES_USD[fromCode] || 1;
  const toRate = rates[toCode] || FALLBACK_RATES_USD[toCode] || 1;

  // Convert fromCode -> USD -> toCode
  const inUSD = amount / fromRate;
  const finalAmount = inUSD * toRate;
  const directRate = toRate / fromRate;

  return {
    result: Math.round(finalAmount * 100) / 100,
    rate: directRate,
  };
}

/**
 * Parses spoken voice input for currency queries
 * Examples:
 * "convert 500 dollars to rupees" -> { amount: 500, from: 'USD', to: 'INR' }
 * "1000 euros into inr" -> { amount: 1000, from: 'EUR', to: 'INR' }
 * "50 pounds" -> { amount: 50, from: 'GBP', to: 'INR' }
 */
export function parseSpokenCurrencyQuery(
  spoken: string
): { amount?: number; fromCode?: string; toCode?: string } | null {
  if (!spoken) return null;
  const text = spoken.toLowerCase().replace(/,/g, '');

  // Extract number
  const numMatch = text.match(/(\d+(\.\d+)?)/);
  const amount = numMatch ? parseFloat(numMatch[1]) : undefined;

  // Currency keywords
  const currencyKeywords: Record<string, string> = {
    rupee: 'INR',
    rupees: 'INR',
    inr: 'INR',
    dollar: 'USD',
    dollars: 'USD',
    usd: 'USD',
    euro: 'EUR',
    euros: 'EUR',
    eur: 'EUR',
    pound: 'GBP',
    pounds: 'GBP',
    gbp: 'GBP',
    dirham: 'AED',
    dirhams: 'AED',
    aed: 'AED',
    riyal: 'SAR',
    riyals: 'SAR',
    sar: 'SAR',
    yen: 'JPY',
    jpy: 'JPY',
    cad: 'CAD',
    aud: 'AUD',
    dinar: 'KWD',
  };

  let fromCode: string | undefined;
  let toCode: string | undefined;

  if (text.includes(' to ') || text.includes(' into ') || text.includes(' in ')) {
    const parts = text.split(/\s+(?:to|into|in)\s+/);
    if (parts.length >= 2) {
      for (const [kw, code] of Object.entries(currencyKeywords)) {
        if (parts[0].includes(kw)) fromCode = code;
        if (parts[1].includes(kw)) toCode = code;
      }
    }
  } else {
    for (const [kw, code] of Object.entries(currencyKeywords)) {
      if (text.includes(kw)) {
        if (!fromCode) fromCode = code;
      }
    }
  }

  return { amount, fromCode, toCode };
}
