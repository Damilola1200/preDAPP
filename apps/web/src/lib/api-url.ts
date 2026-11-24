const fallbackApiUrl = process.env.NODE_ENV === "development" ? "http://localhost:4000" : "https://api-not-configured.invalid";

/** Keep localhost development-only; the reserved .invalid host prevents accidental calls to a visitor's machine. */
export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL?.trim() || fallbackApiUrl).replace(/\/+$/, "");
