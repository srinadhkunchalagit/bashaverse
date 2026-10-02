/**
 * Number to Words Utility supporting:
 * 1. Indian Numbering System: Crores, Lakhs, Thousands, Hundreds, Rupees
 * 2. International Numbering System: Billions, Millions, Thousands, Hundreds
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function convertBelowThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return `${TENS[ten]}${one ? ' ' + ONES[one] : ''}`;
}

function convertThreeDigitGroup(n: number): string {
  let str = '';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    str += `${ONES[hundreds]} Hundred`;
    if (remainder > 0) str += ' and ';
  }
  if (remainder > 0) {
    str += convertBelowThousand(remainder);
  }
  return str;
}

/**
 * Converts a number to words in the Indian Numbering System (Crores, Lakhs, Thousands)
 * e.g. 125000 -> "One Lakh Twenty-Five Thousand Rupees Only"
 */
export function numberToWordsIndian(amount: number, currencyName = 'Rupees'): string {
  if (isNaN(amount) || amount === 0) return `Zero ${currencyName} Only`;

  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  let remaining = integerPart;
  const parts: string[] = [];

  // Crores (>= 10,000,000)
  const crores = Math.floor(remaining / 10000000);
  if (crores > 0) {
    parts.push(`${convertThreeDigitGroup(crores % 1000)} Crore${crores > 1 ? 's' : ''}`);
    remaining %= 10000000;
  }

  // Lakhs (>= 100,000)
  const lakhs = Math.floor(remaining / 100000);
  if (lakhs > 0) {
    parts.push(`${convertBelowThousand(lakhs)} Lakh${lakhs > 1 ? 's' : ''}`);
    remaining %= 100000;
  }

  // Thousands (>= 1,000)
  const thousands = Math.floor(remaining / 1000);
  if (thousands > 0) {
    parts.push(`${convertBelowThousand(thousands)} Thousand`);
    remaining %= 1000;
  }

  // Hundreds & Below (< 1,000)
  if (remaining > 0) {
    parts.push(convertThreeDigitGroup(remaining));
  }

  let words = parts.join(' ').trim();
  if (words) {
    words = `${words} ${currencyName}`;
  } else {
    words = `Zero ${currencyName}`;
  }

  if (decimalPart > 0) {
    words += ` and ${convertBelowThousand(decimalPart)} Paise`;
  }

  return `${words} Only`;
}

/**
 * Converts a number to words in International Numbering System (Billions, Millions, Thousands)
 * e.g. 1250000 -> "One Million Two Hundred Fifty Thousand Dollars Only"
 */
export function numberToWordsInternational(amount: number, currencyName = 'Dollars'): string {
  if (isNaN(amount) || amount === 0) return `Zero ${currencyName} Only`;

  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  let remaining = integerPart;
  const parts: string[] = [];

  // Billions (>= 1,000,000,000)
  const billions = Math.floor(remaining / 1000000000);
  if (billions > 0) {
    parts.push(`${convertThreeDigitGroup(billions)} Billion`);
    remaining %= 1000000000;
  }

  // Millions (>= 1,000,000)
  const millions = Math.floor(remaining / 1000000);
  if (millions > 0) {
    parts.push(`${convertThreeDigitGroup(millions)} Million`);
    remaining %= 1000000;
  }

  // Thousands (>= 1,000)
  const thousands = Math.floor(remaining / 1000);
  if (thousands > 0) {
    parts.push(`${convertThreeDigitGroup(thousands)} Thousand`);
    remaining %= 1000;
  }

  // Remaining Hundreds
  if (remaining > 0) {
    parts.push(convertThreeDigitGroup(remaining));
  }

  let words = parts.join(' ').trim();
  if (words) {
    words = `${words} ${currencyName}`;
  } else {
    words = `Zero ${currencyName}`;
  }

  if (decimalPart > 0) {
    words += ` and ${convertBelowThousand(decimalPart)} Cents`;
  }

  return `${words} Only`;
}
