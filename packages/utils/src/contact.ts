/** Parse WHATSAPP_NUMBER env (slash, comma, or pipe separated). */
export function parseWhatsAppNumbers(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[/,|]+/)
    .map((part) => part.replace(/\D/g, ""))
    .filter(Boolean);
}

export function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("233") && d.length >= 12) {
    return `+233 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`.trim();
  }
  if (d.length === 10 && d.startsWith("0")) {
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  return d ? (d.startsWith("+") ? d : `+${d}`) : "";
}

export function whatsAppUrl(number: string, message?: string): string {
  const digits = number.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}
