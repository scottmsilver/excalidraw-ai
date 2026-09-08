import { ROUNDNESS } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import {
  perimeterRatioToPoint,
  pointToPerimeterRatio,
  getPerimeterNormal,
  getCalloutTailPoints,
  getCalloutTailBounds,
  getCalloutTailArrowheadPoints,
} from "../src/callout";
import { newCalloutElement } from "../src/newElement";
import { getCornerRadius } from "../src/utils";

const rounded = { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 20 } as const;

it("includes the cardinality circle in tail export bounds", () => {
  const element = newCalloutElement({
    type: "callout",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    tailAttachment: 230 / 360,
    tailTip: pointFrom<LocalPoint>(50, 200),
    tailArrowhead: "cardinality_zero_or_one",
  });
  const circle = getCalloutTailArrowheadPoints(element, "circle_outline", 1.5)!;
  const bounds = getCalloutTailBounds(element);
  expect(bounds[2]).toBeGreaterThanOrEqual(circle[0] + (circle[2] * 0.8) / 2);
});

it("attaches to the actual quadratic corner instead of the selection corner", () => {
  // 200x100 perimeter=600; top-right square corner is at 200/600.
  expect(perimeterRatioToPoint(1 / 3, 200, 100, rounded)).toEqual([195, 5]);
  const normal = getPerimeterNormal(1 / 3, 200, 100, rounded);
  expect(normal[0]).toBeCloseTo(Math.SQRT1_2);
  expect(normal[1]).toBeCloseTo(-Math.SQRT1_2);
});

it("projects a dragged corner handle onto the rounded outline", () => {
  const ratio = pointToPerimeterRatio(
    pointFrom<LocalPoint>(200, 0),
    200,
    100,
    rounded,
  );
  const point = perimeterRatioToPoint(ratio, 200, 100, rounded);
  expect(point[0]).toBeCloseTo(195, 5);
  expect(point[1]).toBeCloseTo(5, 5);
});

it.each([0, 1 / 3, 1 / 2, 5 / 6])("round-trips corner ratio %s", (ratio) => {
  const point = perimeterRatioToPoint(ratio, 200, 100, rounded);
  const restored = pointToPerimeterRatio(point, 200, 100, rounded);
  const result = perimeterRatioToPoint(restored, 200, 100, rounded);
  expect(result[0]).toBeCloseTo(point[0], 5);
  expect(result[1]).toBeCloseTo(point[1], 5);
});

it("preserves sharp corners and straight-edge attachments", () => {
  expect(perimeterRatioToPoint(1 / 3, 200, 100)[0]).toBeCloseTo(200);
  expect(perimeterRatioToPoint(1 / 3, 200, 100)[1]).toBeCloseTo(0);
  expect(perimeterRatioToPoint(1 / 6, 200, 100, rounded)[0]).toBeCloseTo(100);
  expect(perimeterRatioToPoint(1 / 6, 200, 100, rounded)[1]).toBeCloseTo(0);
});

it("uses the renderer radius and rounded normal in the generated tail", () => {
  const element = newCalloutElement({
    type: "callout",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    roundness: rounded,
    tailAttachment: 1 / 3,
    tailTip: pointFrom<LocalPoint>(300, -100),
  });
  const radius = getCornerRadius(100, element);
  const tail = getCalloutTailPoints(element);
  expect(tail.attachPoint).toEqual([200 - radius / 4, radius / 4]);
  expect(tail.controlPoint[0]).toBeGreaterThan(tail.attachPoint[0]);
  expect(tail.controlPoint[1]).toBeLessThan(tail.attachPoint[1]);
});
