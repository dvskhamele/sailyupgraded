export type AddressOption = {
  label: string;
  value: string;
};

export const COUNTRY_OPTIONS: AddressOption[] = [
  "Australia",
  "Austria",
  "Belgium",
  "Brazil",
  "Bulgaria",
  "Canada",
  "China",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Egypt",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Saudi Arabia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
].map((value) => ({ label: value, value }));

const RAW_STATES: Record<string, string[]> = {
  Australia: ["Australian Capital Territory", "New South Wales", "Northern Territory", "Queensland", "South Australia", "Tasmania", "Victoria", "Western Australia"],
  Canada: ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan"],
  "Czech Republic": ["Central Bohemian", "Hradec Kralove", "Jihocesky", "Jihomoravsky", "Karlovarsky", "Liberecky", "Moravian-Silesian", "Olomoucky", "Pardubicky", "Plzensky", "Prague", "Ustecky", "Vysocina", "Zlinsky"],
  Germany: ["Baden-Wurttemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"],
  India: ["Andhra Pradesh", "Delhi", "Gujarat", "Karnataka", "Kerala", "Maharashtra", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal"],
  Ukraine: ["Cherkasy Oblast", "Chernihiv Oblast", "Chernivtsi Oblast", "Dnipropetrovsk Oblast", "Ivano-Frankivsk Oblast", "Kharkiv Oblast", "Kherson Oblast", "Khmelnytskyi Oblast", "Kyiv", "Kyiv Oblast", "Lviv Oblast", "Mykolaiv Oblast", "Odesa Oblast", "Poltava Oblast", "Rivne Oblast", "Ternopil Oblast", "Vinnytsia Oblast", "Volyn Oblast", "Zakarpattia Oblast", "Zaporizhzhia Oblast", "Zhytomyr Oblast"],
  "United Kingdom": ["England", "Northern Ireland", "Scotland", "Wales"],
  "United States": ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"],
};

const STATES_BY_COUNTRY: Record<string, AddressOption[]> = {};

for (const country of Object.keys(RAW_STATES)) {
  STATES_BY_COUNTRY[country] = RAW_STATES[country].map((value) => ({
    label: value,
    value,
  }));
}

export function getStateOptions(country?: string | null, currentValue?: string | null) {
  const options = country ? [...(STATES_BY_COUNTRY[country] ?? [])] : [];

  if (currentValue && !options.some((option) => option.value === currentValue)) {
    options.unshift({ label: currentValue, value: currentValue });
  }

  return options;
}
