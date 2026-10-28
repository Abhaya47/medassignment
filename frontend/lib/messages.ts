import type { ApiError } from "./api";

export function errorMessage(err: ApiError, nameOf: (id: string) => string): string {
  const names = err.testIds.map(nameOf).join(", ");
  switch (err.code) {
    case "INVALID_TESTS":
      return `These tests aren't available to book anymore: ${names}. Please remove them and try again.`;
    case "NOT_AVAILABLE":
      return `We can't offer ${names} right now, so we couldn't build a plan. Try removing ${err.testIds.length > 1 ? "them" : "it"}.`;
    case "EMPTY_SELECTION":
      return "Choose at least one test to see a plan.";
    case "NETWORK":
      return "We couldn't reach the server. Check your connection and try again.";
    default:
      return "Something went wrong on our side. Please try again in a moment.";
  }
}