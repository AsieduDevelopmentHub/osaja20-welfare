/**
 * SMS segment / page estimation (GSM-7 vs UCS-2), matching Arkesel credit billing.
 * Extended GSM-7 characters cost 2 septets each.
 */

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const GSM7_EXTENDED = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsSegmentInfo {
  encoding: SmsEncoding;
  characterCount: number;
  septetCount: number;
  pages: number;
  remainingInSegment: number;
  maxSingleSegment: number;
}

function isGsm7Char(ch: string): boolean {
  return GSM7_BASIC.includes(ch) || GSM7_EXTENDED.has(ch);
}

export function messageIsGsm7(message: string): boolean {
  for (const ch of message) {
    if (!isGsm7Char(ch)) return false;
  }
  return true;
}

export function gsm7SeptetCount(message: string): number {
  let count = 0;
  for (const ch of message) {
    count += GSM7_EXTENDED.has(ch) ? 2 : 1;
  }
  return count;
}

export function smsPageCount(message: string): number {
  if (!message) return 0;
  if (messageIsGsm7(message)) {
    const septets = gsm7SeptetCount(message);
    if (septets <= 160) return 1;
    return Math.ceil(septets / 153);
  }
  const length = [...message].length;
  if (length <= 70) return 1;
  return Math.ceil(length / 67);
}

export function estimateSmsUnits(message: string, recipientCount: number): number {
  return smsPageCount(message) * Math.max(recipientCount, 0);
}

export function analyzeSmsSegments(message: string): SmsSegmentInfo {
  const encoding: SmsEncoding = messageIsGsm7(message) ? "GSM-7" : "UCS-2";
  const characterCount = [...(message || "")].length;
  const septetCount = encoding === "GSM-7" ? gsm7SeptetCount(message || "") : characterCount;
  const pages = smsPageCount(message || "");
  const maxSingle = encoding === "GSM-7" ? 160 : 70;
  const perConcat = encoding === "GSM-7" ? 153 : 67;

  let remaining = maxSingle;
  if (pages <= 1) {
    remaining = Math.max(0, maxSingle - septetCount);
  } else {
    const usedInLast = septetCount % perConcat || perConcat;
    remaining = Math.max(0, perConcat - usedInLast);
  }

  return {
    encoding,
    characterCount,
    septetCount,
    pages,
    remainingInSegment: remaining,
    maxSingleSegment: maxSingle,
  };
}
