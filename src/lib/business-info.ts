/**
 * YugMinds' public business facts: the one source for the site's contact
 * details and the structured data search engines read. Keep every listing
 * (Google Business Profile, JustDial, IndiaMART, LinkedIn…) identical to this.
 *
 * Leave a field empty until it's confirmed. Empty fields are left out of the
 * structured data rather than guessed. The local-business entry (needed for
 * Google Maps / local results) only turns on once street and postalCode are set.
 */
export const BUSINESS = {
  name: "YugMinds",
  legalName: "YugMinds Private Limited",
  url: "https://yugminds.org",
  email: "info@yugminds.org",
  phone: "+91-85003-45655",
  phoneDisplay: "+91 85003 45655",
  foundingYear: "2024",
  address: {
    street: "", // e.g. "Plot 12, Street name"; needed for local results
    locality: "Begumpet",
    city: "Hyderabad",
    region: "Telangana",
    postalCode: "", // e.g. "500016"; needed for local results
    country: "IN",
  },
  // Map pin of the office, from Google Maps (right-click the building → copy coordinates).
  geo: null as { latitude: number; longitude: number } | null,
  // Customer-facing hours, schema.org format, e.g. ["Mo-Fr 09:30-18:30", "Sa 10:00-14:00"].
  openingHours: [] as string[],
  // Official profiles of YugMinds itself: Google Business Profile, LinkedIn, Instagram…
  sameAs: [] as string[],
};

export const BUSINESS_ADDRESS_DISPLAY = [
  BUSINESS.address.street,
  BUSINESS.address.locality,
  BUSINESS.address.postalCode ? `${BUSINESS.address.city} ${BUSINESS.address.postalCode}` : BUSINESS.address.city,
  BUSINESS.address.region,
  "India",
]
  .filter(Boolean)
  .join(", ");

/** True once there's enough to describe a physical, visitable office. */
export const HAS_FULL_ADDRESS = Boolean(BUSINESS.address.street && BUSINESS.address.postalCode);
