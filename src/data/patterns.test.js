import { describe, expect, it } from "vitest";
import { patterns } from "./index";
import { LANGUAGES } from "../lib/languages";

describe("the Patterns templates", () => {
  it("every pattern has a non-empty template in every listed language", () => {
    for (const pattern of patterns) {
      for (const language of LANGUAGES) {
        const template = pattern.templates?.[language.id];
        expect(
          typeof template === "string" && template.trim().length > 0,
          `${pattern.title} has no ${language.name} template`,
        ).toBe(true);
      }
    }
  });

  it("every pattern has a unique id for the hint links", () => {
    const ids = patterns.map((pattern) => pattern.id);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(patterns.length);
  });

  it("the language list has unique ids and a highlighter id for each", () => {
    expect(new Set(LANGUAGES.map((l) => l.id)).size).toBe(LANGUAGES.length);
    expect(LANGUAGES.every((l) => l.name && l.prism && l.color)).toBe(true);
  });
});
