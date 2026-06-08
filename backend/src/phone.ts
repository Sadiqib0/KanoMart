export function normalizePhone(phone: string): string {
  const compact = phone.trim().replace(/[\s()-]/g, "");
  if (compact.startsWith("+234")) return `0${compact.slice(4)}`;
  if (compact.startsWith("234")) return `0${compact.slice(3)}`;
  return compact;
}
