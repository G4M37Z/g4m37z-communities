// ============================================================================
// src/lib/terms.ts
// Terms-of-service version contract. The signup form label ("v1") is
// client-asserted; the server validates the transmitted version against this
// constant so a forged request can neither skip acceptance nor record a
// version that never existed.
// ============================================================================

export const CURRENT_TERMS_VERSION = "v1";

/** Validate raw FormData terms input. Returns null on success or an error. */
export function validateTerms(
  accepted: string | null | undefined,
  version: string | null | undefined,
): string | null {
  if (accepted !== "true") {
    return "You must accept the Terms of Service to create an account.";
  }
  if (version !== CURRENT_TERMS_VERSION) {
    return "The Terms of Service have been updated. Please review and accept them and try again.";
  }
  return null;
}