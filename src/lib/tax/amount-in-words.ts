/**
 * Amount in words for Sri Lankan Rupees (international short scale, as used on
 * Sri Lankan commercial documents: "Two Million Five Hundred Thousand …").
 *
 * e.g. 1234.50 → "One Thousand Two Hundred Thirty-Four Rupees and Fifty Cents Only"
 */
const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function belowThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest > 0) {
    if (rest < 20) parts.push(ONES[rest]);
    else {
      const t = TENS[Math.floor(rest / 10)];
      const o = rest % 10;
      parts.push(o ? `${t}-${ONES[o]}` : t);
    }
  }
  return parts.join(" ");
}

const ZERO = BigInt(0);
const ONE = BigInt(1);
const HUNDRED = BigInt(100);
const THOUSAND = BigInt(1000);

function integerToWords(value: bigint): string {
  if (value === ZERO) return "Zero";
  const groups: number[] = [];
  let v = value;
  while (v > ZERO) {
    groups.push(Number(v % THOUSAND));
    v /= THOUSAND;
  }
  if (groups.length > SCALES.length) throw new RangeError("Amount too large to express in words");
  const out: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    out.push(`${belowThousand(groups[i])}${SCALES[i] ? ` ${SCALES[i]}` : ""}`);
  }
  return out.join(" ");
}

/** `amount` must be a decimal string/number; it is rounded to 2dp (half-up) using string arithmetic. */
export function amountInWordsLKR(amount: string | number): string {
  const text = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new RangeError("Invalid amount");
  const negative = text.startsWith("-");
  const [intPartRaw, fracRaw = ""] = text.replace("-", "").split(".");
  let cents = BigInt(intPartRaw) * HUNDRED + BigInt((fracRaw + "00").slice(0, 2));
  if (fracRaw.length > 2 && Number(fracRaw[2]) >= 5) cents += ONE;
  const rupees = cents / HUNDRED;
  const rem = Number(cents % HUNDRED);

  const rupeeWords = `${integerToWords(rupees)} ${rupees === ONE ? "Rupee" : "Rupees"}`;
  const centWords = rem > 0 ? ` and ${integerToWords(BigInt(rem))} ${rem === 1 ? "Cent" : "Cents"}` : "";
  return `${negative && cents > ZERO ? "Minus " : ""}${rupeeWords}${centWords} Only`;
}

export const toSriLankanRupeesAndCents = amountInWordsLKR;
