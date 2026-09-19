// ============================================================================
// src/lib/posts/image-validation-test.ts
// Test-facing export surface for the pure post-image helpers.
//
// Why this exists: tests/launch-hardening.test.ts imports `__postImageTest`
// from "@/lib/posts/actions". That module is "use server" and may only
// export async functions — the previous `export const __postImageTest`
// caused 'A "use server" file can only export async functions, found
// object.' at runtime, killing every action in the bundle (reposts, votes,
// reactions, image uploads; digest …@E352). The helpers now live in
// ./image-validation and this re-export keeps the test import stable.
// ============================================================================

import {
  postImagePathFromUrl,
  sniffImageType,
  validateOwnedImageUrl,
} from "./image-validation";

export const __postImageTest = {
  sniffImageType,
  postImagePathFromUrl,
  validateOwnedImageUrl,
};
