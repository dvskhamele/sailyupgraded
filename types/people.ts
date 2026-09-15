export type PeopleRecordType = "Account" | "Contact";

export interface PeopleRecord {
  id: string;
  originalId: string;
  type: PeopleRecordType;
  name: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  company?: string;
  jobTitle?: string;
  role?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  mobilePhone?: string;
  officePhone?: string;
  website?: string;
  socialLinkedin?: string;
  socialTwitter?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialYoutube?: string;
  socialTiktok?: string;
  socialSkype?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  accountsIDs?: string;
  status?: string;
  tags?: string;
  notes?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  raw: Record<string, any>;
}

export interface PeopleStats {
  totalAccounts: number;
  totalContacts: number;
  totalRecords: number;
}

export interface PeopleFilterOptions {
  type?: "All" | "Account" | "Contact";
  country?: string;
  state?: string;
  city?: string;
  company?: string;
  jobTitle?: string;
  status?: string;
  role?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasLinkedin?: boolean;
  hasCompany?: boolean;
}

export interface GetPeopleParams extends PeopleFilterOptions {
  query?: string;
  page?: number;
  limit?: number;
}

export interface GetPeopleResponse {
  success: boolean;
  source?: string;
  data: PeopleRecord[];
  /** Null means Apollo returned a valid page but did not provide a total count. */
  total: number | null;
  unfilteredTotal?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  stats?: PeopleStats;
  error?: string;
}

export interface PeopleLocationOption {
  value: string;
  label: string;
  type?: "country" | "state" | "city" | "location";
}

export interface GetPeopleLocationsResponse {
  success: boolean;
  locations: PeopleLocationOption[];
  countries: string[];
  states: string[];
  cities: string[];
  companies: string[];
  /** Bounded Apollo-derived values used to keep location dropdowns dependent. */
  locationRows?: Array<{ country: string; state: string; city: string }>;
  error?: string;
}


