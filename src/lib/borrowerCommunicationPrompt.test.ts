import { describe, it, expect } from "vitest";
import { parseOpenAiDraftJson } from "./borrowerCommunicationPrompt";

describe("parseOpenAiDraftJson", () => {
  it("parses raw JSON object", () => {
    const raw = JSON.stringify({
      draft_content: "Hello **borrower**",
      missing_data_notes: ["closing date"],
      confidence: "high",
    });
    const r = parseOpenAiDraftJson(raw);
    expect(r?.draft_content).toBe("Hello borrower");
    expect(r?.missing_data_notes).toEqual(["closing date"]);
    expect(r?.confidence).toBe("high");
  });

  it("strips markdown fences", () => {
    const raw = "```json\n{\"draft_content\":\"x\",\"missing_data_notes\":[],\"confidence\":\"low\"}\n```";
    const r = parseOpenAiDraftJson(raw);
    expect(r?.draft_content).toBe("x");
  });

  it("returns null when draft_content empty", () => {
    expect(parseOpenAiDraftJson('{"draft_content":"","missing_data_notes":[]}')).toBeNull();
  });

  it("strips heading and divider markers", () => {
    const raw = JSON.stringify({
      draft_content: "### Summary\n***\nPlease review.",
      missing_data_notes: [],
      confidence: "medium",
    });
    const r = parseOpenAiDraftJson(raw);
    expect(r?.draft_content).toBe("Summary\n\nPlease review.");
  });
});
