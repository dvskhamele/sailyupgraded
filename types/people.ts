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

export interface GetPeopleParams {
  query?: string;
  type?: "All" | "Account" | "Contact";
  limit?: number;
}

export interface GetPeopleResponse {
  success: boolean;
  data: PeopleRecord[];
  total: number;
  stats?: PeopleStats;
  error?: string;
}
