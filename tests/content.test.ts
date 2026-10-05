import { describe, expect, it } from "vitest";
import { COURSE, LESSONS } from "../src/content/course";
import { checkJp, validateCourse } from "../src/content/validate";

describe("course content", () => {
  it("passes validation", () => {
    expect(validateCourse(COURSE)).toEqual([]);
  });

  it("has a lesson for every course slot", () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(17);
  });
});

describe("checkJp", () => {
  it("accepts well-formed markup", () => {
    expect(checkJp("{私|わたし} は {台湾|たいわん} から {来|き}ました。")).toEqual([]);
    expect(checkJp("こんにちは。 {母|はは} です。")).toEqual([]);
  });

  it.each([
    ["{私|わたし}は {学生|がくせい} です。", "particle は must be its own word"],
    ["これを ください。", "particle を must be its own word"],
    ["{私|わたし} は 学生 です。", "needs a {漢字|かな} reading"],
    ["{1000円|せんえん} と 500円", "needs a {漢字|かな} reading"],
    ["{私|watashi} は", "reading must be kana"],
  ])("rejects %j", (markup, problem) => {
    expect(checkJp(markup).join("\n")).toContain(problem);
  });
});
