import { describe, expect, it } from "vitest";

import { getCalloutPlacement } from "../src/calloutCreation";
import { perimeterRatioToPoint } from "../src/callout";

describe("tip-first callout placement", () => {
  it.each([
    [[300, 300], [460, 400], [300, 300, 160, 100]],
    [[460, 400], [300, 300], [300, 300, 160, 100]],
    [[460, 300], [300, 400], [300, 300, 160, 100]],
    [[300, 400], [460, 300], [300, 300, 160, 100]],
  ] as const)("normalizes a box dragged between %s and %s", (start, end, expected) => {
    const placement = getCalloutPlacement([150, 250], start, end, true, null);

    expect([placement.x, placement.y, placement.width, placement.height]).toEqual(expected);
    expect([placement.x + placement.tailTip[0], placement.y + placement.tailTip[1]]).toEqual([150, 250]);
  });

  it("uses a default box at the second press for a click-sized gesture", () => {
    const placement = getCalloutPlacement([100, 100], [300, 200], [304, 202], false, null);

    expect([placement.x, placement.y, placement.width, placement.height]).toEqual([300, 200, 160, 100]);
    expect([placement.x + placement.tailTip[0], placement.y + placement.tailTip[1]]).toEqual([100, 100]);
  });

  it("attaches to the nearest box edge when the tip lies inside", () => {
    const placement = getCalloutPlacement([350, 310], [300, 300], [460, 400], true, null);
    const attach = perimeterRatioToPoint(placement.tailAttachment, placement.width, placement.height);

    expect(attach[1]).toBeCloseTo(0);
    expect(attach[0]).toBeCloseTo(50);
  });
});
