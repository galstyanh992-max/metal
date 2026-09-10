import type { QueryClient } from "@tanstack/react-query";

export function invalidateOrderQueries(queryClient: QueryClient) {
  return Promise.all([
    "orders", "products", "clients", "client", "dashboard", "op-dashboard", "debts", "inventory",
  ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}
