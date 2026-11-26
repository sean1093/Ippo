// The bugs this covers only show where the UTC date changes during the learner's day.
process.env.TZ = "Asia/Taipei";

import { describe, expect, it } from "vitest";
import { anchor, fromAnchor, nextDayStart, studyDay } from "../src/learn/day";
import { stageOf } from "../src/learn/review";
import { type Memory, NEW_STAGE_DAYS, schedule } from "../src/learn/scheduler";

const local = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
const DAY = 864e5;

describe("study days (4:00 to 4:00)", () => {
  it("counts the small hours as the evening before", () => {
    expect(studyDay(local(2, 1, 30))).toBe("2026-10-01");
    expect(studyDay(local(2, 4))).toBe("2026-10-02");
    expect(nextDayStart(local(2, 1, 30))).toBe(local(2, 4).getTime());
    expect(nextDayStart(local(2, 23))).toBe(local(3, 4).getTime());
  });

  it("anchors a study day to one instant and back", () => {
    expect(anchor(local(2, 7, 30)).getTime()).toBe(anchor(local(2, 23, 59)).getTime());
    expect(fromAnchor(anchor(local(2, 7, 30)))).toBe(local(2, 4).getTime());
  });
});

describe("schedule across the UTC date line", () => {
  // Missed at 20:00; answered right the next morning, before and after 08:00 (UTC midnight).
  const missed = schedule(schedule(undefined, "good", local(1, 9)), "again", local(1, 20));

  it("gives the same credit at 07:30 as at 08:30 the next morning", () => {
    const early = schedule(missed, "good", local(2, 7, 30));
    const late = schedule(missed, "good", local(2, 8, 30));
    expect(early.stability).toBeCloseTo(late.stability, 6);
    expect(early.level).toBe(late.level);
    expect(early.due).toBe(late.due);
  });

  it("counts a success on a later study day as spaced, and a same-day retake as not", () => {
    const first = schedule(undefined, "good", local(1, 20));
    expect(schedule(first, "good", local(2, 7, 30)).level).toBe(first.level + 1);
    expect(schedule(first, "good", local(2, 1)).level).toBe(first.level);
  });

  it("makes cards due at the start of a study day", () => {
    const due = new Date(schedule(undefined, "good", local(1, 22)).due);
    expect(due.getHours()).toBe(4);
    expect(due.getMinutes()).toBe(0);
  });
});

describe("moving up a stage", () => {
  it("first asks a learner to say a word within three weeks of learning it", () => {
    // Enrolled, then every review answered right on the day it falls due.
    let memory: Memory = { ...schedule(undefined, "good", local(1, 20)), level: 0, grade: null };
    const start = memory.last;
    for (let i = 0; i < 10 && memory.level < 2; i++) memory = schedule(memory, "good", new Date(memory.due + 10 * 36e5));
    const word = { kind: "word", use: "say" } as Parameters<typeof stageOf>[0];
    expect(stageOf(word, memory)).toBe("say");
    expect((memory.due - start) / DAY).toBeLessThanOrEqual(21);
  });

  it("brings a card back within NEW_STAGE_DAYS when it reaches a harder stage", () => {
    let memory = schedule(undefined, "good", local(1, 9));
    memory = schedule(memory, "good", local(20, 9));
    expect(memory.level).toBe(2);
    expect(memory.scheduledDays).toBeLessThanOrEqual(NEW_STAGE_DAYS);
  });
});
