import { QueryClient } from "@tanstack/react-query";

/** Stable keys for cache + invalidation */
export const qk = {
  dashboard: ["dashboard"] as const,
  ingredients: ["ingredients"] as const,
  recipes: ["recipes"] as const,
  suggestionsPo: ["suggestions", "po"] as const,
  approvedPoLines: ["suggestions", "po", "approved"] as const,
  menuItems: ["menu-items"] as const,
  sales: ["sales"] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
