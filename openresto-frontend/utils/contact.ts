/**
 * Contact details exist at two levels: per-location (`RestaurantDto.phoneNumber` /
 * `.emailAddress`) and global (`Brand.phoneNumber` / `.emailAddress`). A location's own value
 * wins; whatever it leaves blank falls back to the brand default. Resolution is per-field, so a
 * location that lists only a phone still inherits the global email rather than losing it.
 */

export interface ContactSource {
  phoneNumber?: string | null;
  emailAddress?: string | null;
}

export interface ResolvedContact {
  phone: string | null;
  email: string | null;
}

const blankToNull = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function resolveContact(
  restaurant?: ContactSource | null,
  brand?: ContactSource | null
): ResolvedContact {
  return {
    phone: blankToNull(restaurant?.phoneNumber) ?? blankToNull(brand?.phoneNumber),
    email: blankToNull(restaurant?.emailAddress) ?? blankToNull(brand?.emailAddress),
  };
}

export function hasContact(contact: ResolvedContact): boolean {
  return contact.phone !== null || contact.email !== null;
}

/**
 * `tel:` targets reject spaces and formatting characters, so the dial string keeps only digits
 * and a leading `+` while the label the diner reads stays exactly as the restaurant typed it.
 */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const countryPrefix = trimmed.startsWith("+") ? "+" : "";
  return `tel:${countryPrefix}${trimmed.replace(/\D/g, "")}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}
