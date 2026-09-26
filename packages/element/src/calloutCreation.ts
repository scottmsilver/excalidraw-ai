import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { pointToPerimeterRatio } from "./callout";

import type { ExcalidrawCalloutElement } from "./types";

type ScenePoint = readonly [number, number];

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 100;

export const getCalloutPlacement = (
  tip: ScenePoint,
  boxStart: ScenePoint,
  boxEnd: ScenePoint,
  dragged: boolean,
  roundness: ExcalidrawCalloutElement["roundness"],
  minimumHeight = 0,
) => {
  const width = dragged
    ? Math.max(1, Math.abs(boxEnd[0] - boxStart[0]))
    : DEFAULT_WIDTH;
  const x = dragged
    ? Math.min(boxStart[0], boxEnd[0])
    : boxStart[0] - width / 2;
  const rawHeight = dragged
    ? Math.max(1, Math.abs(boxEnd[1] - boxStart[1]))
    : DEFAULT_HEIGHT;
  const rawY = dragged
    ? Math.min(boxStart[1], boxEnd[1])
    : boxStart[1] - rawHeight;
  const height = Math.max(rawHeight, minimumHeight);
  // Text editing may need a taller box. Grow it upward so the bottom stays
  // where the second gesture placed it. A click places the box above the tap.
  const y = rawY + rawHeight - height;
  const tailTip = pointFrom<LocalPoint>(tip[0] - x, tip[1] - y);

  return {
    x,
    y,
    width,
    height,
    tailTip,
    tailAttachment: pointToPerimeterRatio(tailTip, width, height, roundness),
  };
};
