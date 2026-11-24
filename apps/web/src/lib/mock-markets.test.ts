import { describe, expect, it } from "vitest";
import { mockMarkets, mockOpportunities } from "./mock-markets";
describe("isolated dashboard demo data", () => {
 it("provides clearly shaped market cards", () => { expect(mockMarkets.length).toBeGreaterThan(0); expect(mockMarkets.every(m => m.title && m.yes.endsWith("%") && m.no.endsWith("%"))).toBe(true); });
 it("labels cross-venue comparisons as review data", () => { expect(mockOpportunities.every(o => o.confidence && o.venues)).toBe(true); });
});
