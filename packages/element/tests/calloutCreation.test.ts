import { describe, expect, it } from "vitest";

import { getCalloutPlacement } from "../src/calloutCreation";
import { perimeterRatioToPoint } from "../src/callout";

const attachment = (placement: ReturnType<typeof getCalloutPlacement>) => {
  const local = perimeterRatioToPoint(
    placement.tailAttachment,
    placement.width,
    placement.height,
  );
  return [placement.x + local[0], placement.y + local[1]];
};

describe("tip-first callout placement", () => {
  it.each([
    { tip: [100, 100], join: [300, 200], edge: "left" },
    { tip: [500, 100], join: [300, 200], edge: "right" },
    { tip: [100, 100], join: [200, 300], edge: "top" },
    { tip: [100, 500], join: [200, 300], edge: "bottom" },
  ] as const)("places the box away from a $edge approach", ({ tip, join, edge }) => {
    const placement = getCalloutPlacement(tip, join, join, false, null);
    const [attachX, attachY] = attachment(placement);
    expect(attachX).toBeCloseTo(join[0]);
    expect(attachY).toBeCloseTo(join[1]);
    expect([
      placement.x + placement.tailTip[0],
      placement.y + placement.tailTip[1],
    ]).toEqual(tip);
    expect([placement.width, placement.height]).toEqual([160, 100]);
    if (edge === "left") {
      expect(placement.x).toBe(join[0]);
      expect(join[1] - placement.y).toBeCloseTo(placement.height / 3);
    } else if (edge === "right") {
      expect(placement.x + placement.width).toBe(join[0]);
      expect(join[1] - placement.y).toBeCloseTo(placement.height / 3);
    } else if (edge === "top") {
      expect(placement.y).toBe(join[1]);
      expect(join[0] - placement.x).toBeCloseTo(placement.width / 3);
    } else {
      expect(placement.y + placement.height).toBe(join[1]);
      expect(join[0] - placement.x).toBeCloseTo(placement.width / 3);
    }
  });

  it("joins at the middle of the facing edge for an axis-aligned arrow", () => {
    const placement = getCalloutPlacement(
      [100, 200],
      [300, 200],
      [300, 200],
      false,
      null,
    );
    expect(placement).toMatchObject({ x: 300, y: 150, width: 160, height: 100 });
    expect(attachment(placement)[0]).toBeCloseTo(300);
    expect(attachment(placement)[1]).toBeCloseTo(200);
  });

  it("uses the top edge when the tip and join coincide", () => {
    const placement = getCalloutPlacement(
      [300, 200],
      [300, 200],
      [300, 200],
      false,
      null,
    );
    expect(placement).toMatchObject({ x: 220, y: 200, width: 160, height: 100 });
    expect(attachment(placement)[0]).toBeCloseTo(300);
    expect(attachment(placement)[1]).toBeCloseTo(200);
  });

  it("keeps a short drag's join fixed when text needs more height", () => {
    const placement = getCalloutPlacement(
      [100, 100],
      [240, 200],
      [340, 212],
      true,
      null,
      35,
    );
    expect(placement).toMatchObject({ x: 240, width: 100, height: 35 });
    expect(placement.y).toBeCloseTo(200 - 35 / 3);
    expect(attachment(placement)[0]).toBeCloseTo(240);
    expect(attachment(placement)[1]).toBeCloseTo(200);
  });

  it("sizes by drag magnitude while preserving the same join", () => {
    const forward = getCalloutPlacement(
      [100, 100],
      [300, 200],
      [460, 300],
      true,
      null,
    );
    const backward = getCalloutPlacement(
      [100, 100],
      [300, 200],
      [140, 100],
      true,
      null,
    );
    expect([forward.x, forward.y, forward.width, forward.height]).toEqual([
      backward.x,
      backward.y,
      backward.width,
      backward.height,
    ]);
    expect(attachment(forward)[0]).toBeCloseTo(300);
    expect(attachment(forward)[1]).toBeCloseTo(200);
  });

  it("keeps the join on the outline of a rounded box", () => {
    const roundness = { type: 3 } as const;
    const placement = getCalloutPlacement(
      [100, 100],
      [300, 200],
      [300, 200],
      false,
      roundness,
    );
    const local = perimeterRatioToPoint(
      placement.tailAttachment,
      placement.width,
      placement.height,
      roundness,
    );
    expect(placement.x + local[0]).toBeCloseTo(300);
    expect(placement.y + local[1]).toBeCloseTo(200);
  });
});
