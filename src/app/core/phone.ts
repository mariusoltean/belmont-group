/** Romanian national number (`0743 573 008`) → international `tel:` link (`tel:+40743573008`). */
export function toTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return 'tel:' + (digits.startsWith('0') ? '+40' + digits.slice(1) : digits);
}
