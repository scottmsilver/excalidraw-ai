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
  const height = Math.max(
    dragged
    ? Math.max(1, Math.abs(boxEnd[1] - boxStart[1]))
    : DEFAULT_HEIGHT,
    minimumHeight,
  );
  const dx = boxStart[0] - tip[0];
  const dy = boxStart[1] - tip[1];
  const horizontal = Math.abs(dx) >= Math.abs(dy) && dx !== 0;
  const nearCornerFraction = 1 / 3;
  let attachX: number;
  let attachY: number;
  if (horizontal) {
    attachX = dx > 0 ? 0 : width;
    attachY =
      height *
      (dy === 0
        ? 1 / 2
        : dy > 0
          ? nearCornerFraction
          : 1 - nearCornerFraction);
  } else {
    attachX =
      width *
      (dx === 0
        ? 1 / 2
        : dx > 0
          ? nearCornerFraction
          : 1 - nearCornerFraction);
    attachY = dy < 0 ? height : 0;
  }
  const x = boxStart[0] - attachX;
  const y = boxStart[1] - attachY;
  const tailTip = pointFrom<LocalPoint>(tip[0] - x, tip[1] - y);

  return {
    x,
    y,
    width,
    height,
    tailTip,
    tailAttachment: pointToPerimeterRatio(
      pointFrom<LocalPoint>(attachX, attachY),
      width,
      height,
      roundness,
    ),
  };
};
