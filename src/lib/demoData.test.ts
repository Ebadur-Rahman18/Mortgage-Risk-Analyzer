import { describe, expect, it } from "vitest";
import { isLosOrCrmConnected, shouldHideDemoData } from "@/lib/demoData";
import type { IntegrationSetting } from "@/hooks/useIntegrationSettings";

function setting(partial: Partial<IntegrationSetting>): IntegrationSetting {
  return {
    id: "1",
    provider_name: "lendingpad",
    display_name: "LendingPad",
    is_active: false,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("demoData", () => {
  it("returns false when no integrations are connected", () => {
    expect(shouldHideDemoData([])).toBe(false);
    expect(shouldHideDemoData([setting({ provider_name: "lendingpad", is_active: false })])).toBe(false);
  });

  it("returns true when lendingpad is active with credentials", () => {
    expect(
      shouldHideDemoData([
        setting({ provider_name: "lendingpad", is_active: true, api_key_masked: "abc...xyz" }),
      ]),
    ).toBe(true);
  });

  it("detects OAuth token in config", () => {
    expect(
      isLosOrCrmConnected(
        setting({ is_active: true, config: { access_token: "token-123" } }),
      ),
    ).toBe(true);
  });
});
