import { parseOpportunityProducts } from "@/lib/opportunity-products";

export const DEFAULT_OPPORTUNITY_CATEGORIES = [
 "Group Life Insurance",
  "Term Life Insurance",
  "Whole Life Insurance",
  "Index Universal Life",
  "Annuities Insurance",
  "Estate Planning Insurance",
  "Debt Remediation Insurance",
] as const;

export const ALL_CATEGORIES_VALUE = "__all_categories__";
export const ADD_CATEGORY_VALUE = "__add_category__";

export function normalizeCategoryName(category?: string | null) {
  return category?.trim() ?? "";
}

export function extractOpportunityCategories(
  opportunities: Array<{ category?: string | null }>,
) {
  return opportunities
    .flatMap((opportunity) => parseOpportunityProducts(opportunity.category))
    .map((category) => normalizeCategoryName(category))
    .filter(Boolean);
}

export function mergeCategoryLists(...categoryLists: Array<readonly string[]>) {
  return Array.from(
    new Set(
      categoryLists.flatMap((categories) =>
        categories
          .map((category) => normalizeCategoryName(category))
          .filter(Boolean),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function filterOpportunitiesByCategory<T extends { category?: string | null }>(
  opportunities: T[],
  selectedCategories: string[],
) {
  if (selectedCategories.length === 0) {
    return opportunities;
  }

  return opportunities.filter(
    (opportunity) => {
      const opportunityCategories = parseOpportunityProducts(opportunity.category).map((category) =>
        normalizeCategoryName(category),
      );
      return selectedCategories.some((selectedCategory) =>
        opportunityCategories.includes(normalizeCategoryName(selectedCategory)),
      );
    },
  );
}
