export const APP_NAME = "OSAJA'20 Welfare";
export const APP_TAGLINE = "Asuofua D/A JHS Block A Batch 2020";
export const DEFAULT_BATCH = 2020;

export const API_VERSION = "v1";
export const API_BASE_PATH = `/api/${API_VERSION}`;

export const ROLES = {
  ADMINISTRATOR: "administrator",
  EXECUTIVE: "executive",
  MEMBER: "member",
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const VOTING = {
  DUPLICATE_CONSTRAINT: "UNIQUE(member_id, vote_id)",
  DEFAULT_ELIGIBILITY: ["active", "email_verified"] as const,
} as const;

export const CONTRIBUTION = {
  CURRENCY: "GHS",
  DECIMAL_PLACES: 2,
} as const;

export { DUES } from "./dues.js";

export { BRAND, BRAND_COPY, BRAND_PATHS } from "./brand.js";
export { SITE_META, resolveSiteUrl } from "./site.js";
