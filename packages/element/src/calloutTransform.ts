import { pointFrom, type LocalPoint } from "@excalidraw/math";

import {
  getCalloutTailTipGlobalCoords,
  getCalloutTailPoints,
  getCalloutTailBounds,
  pointToPerimeterRatio,
} from "./callout";

import type { ExcalidrawCalloutElement } from "./types";

type BoxGeometry = Pick<
  ExcalidrawCalloutElement,
  "x" | "y" | "width" | "height" | "angle"
>;

export const calloutLocalToWorld = (
  box: BoxGeometry,
  point: readonly [number, number],
): [number, number] => {
  const dx = point[0] - box.width / 2;
  const dy = point[1] - box.height / 2;
  const cos = Math.cos(box.angle);
  const sin = Math.sin(box.angle);
  return [
    box.x + box.width / 2 + dx * cos - dy * sin,
    box.y + box.height / 2 + dx * sin + dy * cos,
  ];
};

/** A temporary oriented frame; never inserted into the scene or persisted. */
export const getCalloutSelectionFrame = (
  element: ExcalidrawCalloutElement,
): ExcalidrawCalloutElement => {
  const bounds = getCalloutTailBounds(element);
  const x1 = Math.min(0, bounds[0]);
  const y1 = Math.min(0, bounds[1]);
  const x2 = Math.max(element.width, bounds[2]);
  const y2 = Math.max(element.height, bounds[3]);
  const center = calloutLocalToWorld(element, [(x1 + x2) / 2, (y1 + y2) / 2]);
  return {
    ...element,
    x: center[0] - (x2 - x1) / 2,
    y: center[1] - (y2 - y1) / 2,
    width: x2 - x1,
    height: y2 - y1,
  };
};

/** Map both the box and its target through the same oriented frame transform. */
export const transformWholeCallout = (
  element: ExcalidrawCalloutElement,
  before: BoxGeometry,
  after: BoxGeometry,
) => {
  const scaleX = after.width / before.width;
  const scaleY = after.height / before.height;
  const map = (world: readonly [number, number]) => {
    const local = calloutWorldToLocal(before, world);
    return calloutLocalToWorld(after, [local[0] * scaleX, local[1] * scaleY]);
  };
  const center = map([
    element.x + element.width / 2,
    element.y + element.height / 2,
  ]);
  const width = Math.abs(element.width * scaleX);
  const height = Math.abs(element.height * scaleY);
  const updates = {
    x: center[0] - width / 2,
    y: center[1] - height / 2,
    width,
    height,
    angle: after.angle,
  };
  const attachment = calloutWorldToLocal(
    updates,
    map(
      calloutLocalToWorld(element, getCalloutTailPoints(element).attachPoint),
    ),
  );
  return {
    ...updates,
    tailTip: calloutWorldToLocal(
      updates,
      map(getCalloutTailTipGlobalCoords(element)),
    ),
    tailAttachment: pointToPerimeterRatio(
      attachment,
      width,
      height,
      element.roundness,
    ),
  };
};

/** Inverse of the renderer's rotation about the box center. */
export const calloutWorldToLocal = (
  box: BoxGeometry,
  point: readonly [number, number],
): LocalPoint => {
  const dx = point[0] - box.x - box.width / 2;
  const dy = point[1] - box.y - box.height / 2;
  const cos = Math.cos(box.angle);
  const sin = Math.sin(box.angle);
  return pointFrom<LocalPoint>(
    box.width / 2 + dx * cos + dy * sin,
    box.height / 2 - dx * sin + dy * cos,
  );
};

/** Apply only at the user operation, never during restore or history replay. */
export const preserveCalloutTip = (
  before: ExcalidrawCalloutElement,
  updates: Partial<BoxGeometry>,
) => ({
  tailTip: calloutWorldToLocal(
    { ...before, ...updates },
    getCalloutTailTipGlobalCoords(before),
  ),
});

export const isPointOnCalloutShaft = (
  element: ExcalidrawCalloutElement,
  point: readonly [number, number],
  threshold: number,
): boolean => {
  const local = calloutWorldToLocal(element, point);
  const {
    attachPoint: a,
    controlPoint: c,
    tipPoint: b,
  } = getCalloutTailPoints(element);
  let previous = a;
  for (let i = 1; i <= 64; i++) {
    const t = i / 64;
    const next = pointFrom<LocalPoint>(
      (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
      (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
    );
    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    const lengthSquared = dx * dx + dy * dy;
    const f = lengthSquared
      ? Math.max(
          0,
          Math.min(
            1,
            ((local[0] - previous[0]) * dx + (local[1] - previous[1]) * dy) /
              lengthSquared,
          ),
        )
      : 0;
    if (
      Math.hypot(
        local[0] - previous[0] - f * dx,
        local[1] - previous[1] - f * dy,
      ) <= threshold
    ) {
      return true;
    }
    previous = next;
  }
  return false;
};
