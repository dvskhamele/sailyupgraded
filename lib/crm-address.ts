export type AddressLike = {
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
};

export function getAddressLine1(address: string | null | undefined, addressLine1: string | null | undefined) {
  return addressLine1?.trim() || address?.trim() || "";
}

export function formatAddress(address: AddressLike, multiline = false) {
  const line1 = getAddressLine1(address.address, address.address_line1);
  const locality = [address.city, address.state, address.postal_code]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");

  const parts = [
    line1,
    address.address_line2?.trim(),
    locality,
    address.country?.trim(),
  ].filter(Boolean);

  return parts.join(multiline ? "\n" : ", ");
}

export function hasAddress(address: AddressLike) {
  return Boolean(formatAddress(address));
}
