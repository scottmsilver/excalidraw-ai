import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { LocalPoint, Radians } from "@excalidraw/math";

import { getArrowheadSize, getArrowheadAngle } from "./bounds";
import { getCornerRadius } from "./utils";
import { normalizeArrowhead } from "./arrowheads";

import type { Arrowhead, ExcalidrawCalloutElement } from "./types";
/**
 * Perimeter ratio system for callout tail attachment.
 * The ratio (0-1) maps to the rectangle perimeter going clockwise from top-left:
 *
 * 0.0 = top-left corner
 * 0.125 = top edge center
 * 0.25 = top-right corner
 * 0.375 = right edge center
 * 0.5 = bottom-right corner
 * 0.625 = bottom edge center
 * 0.75 = bottom-left corner
 * 0.875 = left edge center
 * 1.0 = back to top-left
 */

interface CalloutTailGeometry {
  attachPoint: LocalPoint;
  controlPoint: LocalPoint;
  tipPoint: LocalPoint;
}

type Roundness = ExcalidrawCalloutElement["roundness"];

// Keep the saved rectangular-perimeter ratio, but replace each corner's
// final/initial radius-length stretches with the renderer's quadratic curve.
const roundedCorners = (
  width: number,
  height: number,
  roundness?: Roundness,
) => {
  const r =
    width > 0 && height > 0
      ? getCornerRadius(Math.min(width, height), {
          roundness: roundness ?? null,
        })
      : 0;
  return {
    r,
    corners: [
      { s: 0, start: [0, r], control: [0, 0], end: [r, 0] },
      { s: width, start: [width - r, 0], control: [width, 0], end: [width, r] },
      {
        s: width + height,
        start: [width, height - r],
        control: [width, height],
        end: [width - r, height],
      },
      {
        s: 2 * width + height,
        start: [r, height],
        control: [0, height],
        end: [0, height - r],
      },
    ],
  };
};

type Corner = ReturnType<typeof roundedCorners>["corners"][number];
const cornerPoint = (corner: Corner, t: number): LocalPoint =>
  pointFrom<LocalPoint>(
    (1 - t) ** 2 * corner.start[0] +
      2 * (1 - t) * t * corner.control[0] +
      t * t * corner.end[0],
    (1 - t) ** 2 * corner.start[1] +
      2 * (1 - t) * t * corner.control[1] +
      t * t * corner.end[1],
  );

const cornerAtRatio = (
  ratio: number,
  width: number,
  height: number,
  roundness?: Roundness,
) => {
  const { r, corners } = roundedCorners(width, height, roundness);
  if (!r) {
    return null;
  }
  const perimeter = 2 * (width + height);
  const s = (((ratio % 1) + 1) % 1) * perimeter;
  for (const corner of corners) {
    const delta =
      ((((s - corner.s + perimeter / 2) % perimeter) + perimeter) % perimeter) -
      perimeter / 2;
    if (Math.abs(delta) <= r) {
      return { corner, t: (delta + r) / (2 * r) };
    }
  }
  return null;
};

/**
 * Converts a perimeter ratio (0-1) to an x,y point on the rectangle perimeter.
 * Accounts for rounded corners if roundness is specified.
 */
export const perimeterRatioToPoint = (
  ratio: number,
  width: number,
  height: number,
  roundness?: Roundness,
): LocalPoint => {
  const curved = cornerAtRatio(ratio, width, height, roundness);
  if (curved) {
    return cornerPoint(curved.corner, curved.t);
  }
  // Handle zero/invalid dimensions gracefully
  if (width <= 0 && height <= 0) {
    return pointFrom<LocalPoint>(0, 0);
  }
  if (width <= 0) {
    // Degenerate to a vertical line
    const normalizedRatio = ((ratio % 1) + 1) % 1;
    return pointFrom<LocalPoint>(0, normalizedRatio * height);
  }
  if (height <= 0) {
    // Degenerate to a horizontal line
    const normalizedRatio = ((ratio % 1) + 1) % 1;
    return pointFrom<LocalPoint>(normalizedRatio * width, 0);
  }

  // Normalize ratio to 0-1 range
  const normalizedRatio = ((ratio % 1) + 1) % 1;

  // Calculate perimeter lengths for each edge
  const perimeter = 2 * (width + height);
  const topRatio = width / perimeter;
  const rightRatio = height / perimeter;
  const bottomRatio = width / perimeter;
  // leftRatio would be height / perimeter

  // Cumulative ratios for edge boundaries
  const topEnd = topRatio;
  const rightEnd = topEnd + rightRatio;
  const bottomEnd = rightEnd + bottomRatio;

  let x: number;
  let y: number;

  if (normalizedRatio < topEnd) {
    // Top edge: moving left to right
    const edgeProgress = normalizedRatio / topRatio;
    x = edgeProgress * width;
    y = 0;
  } else if (normalizedRatio < rightEnd) {
    // Right edge: moving top to bottom
    const edgeProgress = (normalizedRatio - topEnd) / rightRatio;
    x = width;
    y = edgeProgress * height;
  } else if (normalizedRatio < bottomEnd) {
    // Bottom edge: moving right to left
    const edgeProgress = (normalizedRatio - rightEnd) / bottomRatio;
    x = width - edgeProgress * width;
    y = height;
  } else {
    // Left edge: moving bottom to top
    const edgeProgress = (normalizedRatio - bottomEnd) / (1 - bottomEnd);
    x = 0;
    y = height - edgeProgress * height;
  }

  return pointFrom<LocalPoint>(x, y);
};

/**
 * Gets the outward-pointing normal vector at a given perimeter ratio.
 * Returns a normalized direction vector pointing away from the shape.
 */
export const getPerimeterNormal = (
  ratio: number,
  width: number,
  height: number,
  roundness?: Roundness,
): LocalPoint => {
  const curved = cornerAtRatio(ratio, width, height, roundness);
  if (curved) {
    const {
      corner: { start, control, end },
      t,
    } = curved;
    const dx = (1 - t) * (control[0] - start[0]) + t * (end[0] - control[0]);
    const dy = (1 - t) * (control[1] - start[1]) + t * (end[1] - control[1]);
    const length = Math.hypot(dx, dy);
    return pointFrom<LocalPoint>(dy / length, -dx / length);
  }
  // Handle zero/invalid dimensions gracefully
  if (width <= 0 && height <= 0) {
    return pointFrom<LocalPoint>(0, 1); // Default to pointing down
  }
  if (width <= 0) {
    // Vertical line - normal points right or left based on ratio
    const normalizedRatio = ((ratio % 1) + 1) % 1;
    return normalizedRatio < 0.5
      ? pointFrom<LocalPoint>(1, 0)
      : pointFrom<LocalPoint>(-1, 0);
  }
  if (height <= 0) {
    // Horizontal line - normal points up or down based on ratio
    const normalizedRatio = ((ratio % 1) + 1) % 1;
    return normalizedRatio < 0.5
      ? pointFrom<LocalPoint>(0, -1)
      : pointFrom<LocalPoint>(0, 1);
  }

  const normalizedRatio = ((ratio % 1) + 1) % 1;

  const perimeter = 2 * (width + height);
  const topRatio = width / perimeter;
  const rightRatio = height / perimeter;
  const bottomRatio = width / perimeter;

  const topEnd = topRatio;
  const rightEnd = topEnd + rightRatio;
  const bottomEnd = rightEnd + bottomRatio;

  if (normalizedRatio < topEnd) {
    // Top edge: normal points up
    return pointFrom<LocalPoint>(0, -1);
  } else if (normalizedRatio < rightEnd) {
    // Right edge: normal points right
    return pointFrom<LocalPoint>(1, 0);
  } else if (normalizedRatio < bottomEnd) {
    // Bottom edge: normal points down
    return pointFrom<LocalPoint>(0, 1);
  }
  // Left edge: normal points left
  return pointFrom<LocalPoint>(-1, 0);
};

/**
 * Converts a point to the nearest perimeter ratio on the rectangle.
 */
export const pointToPerimeterRatio = (
  point: LocalPoint,
  width: number,
  height: number,
  roundness?: Roundness,
): number => {
  const { r, corners } = roundedCorners(width, height, roundness);
  if (r) {
    const perimeter = 2 * (width + height);
    let bestRatio = pointToPerimeterRatio(point, width, height);
    const distance = (p: LocalPoint) =>
      (p[0] - point[0]) ** 2 + (p[1] - point[1]) ** 2;
    let bestDistance = distance(
      perimeterRatioToPoint(bestRatio, width, height, roundness),
    );
    // Sample then refine each quadratic. This also handles points inside the
    // shape, where squared distance to a curve need not be globally unimodal.
    for (const corner of corners) {
      let sample = 0;
      for (let i = 1; i <= 32; i++) {
        if (
          distance(cornerPoint(corner, i / 32)) <
          distance(cornerPoint(corner, sample / 32))
        ) {
          sample = i;
        }
      }
      let lo = Math.max(0, (sample - 1) / 32);
      let hi = Math.min(1, (sample + 1) / 32);
      for (let i = 0; i < 40; i++) {
        const a = lo + (hi - lo) / 3;
        const b = hi - (hi - lo) / 3;
        if (
          distance(cornerPoint(corner, a)) < distance(cornerPoint(corner, b))
        ) {
          hi = b;
        } else {
          lo = a;
        }
      }
      const t = (lo + hi) / 2;
      const d = distance(cornerPoint(corner, t));
      if (d < bestDistance) {
        bestDistance = d;
        bestRatio = ((corner.s - r + 2 * r * t) / perimeter + 1) % 1;
      }
    }
    return bestRatio;
  }
  const [px, py] = point;

  // Clamp point to rectangle bounds
  const clampedX = Math.max(0, Math.min(width, px));
  const clampedY = Math.max(0, Math.min(height, py));

  // Find which edge is closest
  const distToTop = clampedY;
  const distToRight = width - clampedX;
  const distToBottom = height - clampedY;
  const distToLeft = clampedX;

  const minDist = Math.min(distToTop, distToRight, distToBottom, distToLeft);

  const perimeter = 2 * (width + height);
  const topRatio = width / perimeter;
  const rightRatio = height / perimeter;
  const bottomRatio = width / perimeter;

  const topEnd = topRatio;
  const rightEnd = topEnd + rightRatio;
  const bottomEnd = rightEnd + bottomRatio;

  if (minDist === distToTop) {
    // Top edge
    return (clampedX / width) * topRatio;
  } else if (minDist === distToRight) {
    // Right edge
    return topEnd + (clampedY / height) * rightRatio;
  } else if (minDist === distToBottom) {
    // Bottom edge
    return rightEnd + ((width - clampedX) / width) * bottomRatio;
  }
  // Left edge
  return bottomEnd + ((height - clampedY) / height) * (1 - bottomEnd);
};

/**
 * Calculates the bezier control point for the callout tail.
 * The control point is positioned to curve the tail away from the shape.
 */
export const calculateTailControlPoint = (
  attachPoint: LocalPoint,
  tipPoint: LocalPoint,
  normal: LocalPoint,
  tailCurve: number,
): LocalPoint => {
  // Calculate distance from attachment to tip
  const distance = Math.hypot(
    tipPoint[0] - attachPoint[0],
    tipPoint[1] - attachPoint[1],
  );

  // Control point is offset from attachment in the normal direction
  // scaled by the curve factor and distance
  const controlOffset = distance * tailCurve;

  return pointFrom<LocalPoint>(
    attachPoint[0] + normal[0] * controlOffset,
    attachPoint[1] + normal[1] * controlOffset,
  );
};

/**
 * Gets all geometry needed to render the callout tail.
 */
export const getCalloutTailPoints = (
  element: ExcalidrawCalloutElement,
): CalloutTailGeometry => {
  const { width, height, tailAttachment, tailTip, tailCurve } = element;

  const attachPoint = perimeterRatioToPoint(
    tailAttachment,
    width,
    height,
    element.roundness,
  );
  const normal = getPerimeterNormal(
    tailAttachment,
    width,
    height,
    element.roundness,
  );
  const controlPoint = calculateTailControlPoint(
    attachPoint,
    tailTip,
    normal,
    tailCurve,
  );

  return {
    attachPoint,
    controlPoint,
    tipPoint: tailTip,
  };
};

/**
 * Generates an SVG path for the callout tail (quadratic bezier curve).
 */
export const getCalloutTailPath = (
  element: ExcalidrawCalloutElement,
): string => {
  const { attachPoint, controlPoint, tipPoint } = getCalloutTailPoints(element);

  return `M ${attachPoint[0]} ${attachPoint[1]} Q ${controlPoint[0]} ${controlPoint[1]} ${tipPoint[0]} ${tipPoint[1]}`;
};

/**
 * Gets the local bounds of the callout tail including attach point, control point, and tip.
 * Returns [minX, minY, maxX, maxY] in local coordinates.
 */
export const getCalloutTailBounds = (
  element: ExcalidrawCalloutElement,
): [number, number, number, number] => {
  const { attachPoint, controlPoint, tipPoint } = getCalloutTailPoints(element);

  const xs = [attachPoint[0], controlPoint[0], tipPoint[0]];
  const ys = [attachPoint[1], controlPoint[1], tipPoint[1]];
  const arrowhead = getCalloutTailArrowheadPoints(element);
  if (arrowhead?.length === 3) {
    const [x, y, diameter] = arrowhead;
    xs.push(x - diameter / 2, x + diameter / 2);
    ys.push(y - diameter / 2, y + diameter / 2);
  } else if (arrowhead) {
    for (let i = 0; i < arrowhead.length; i += 2) {
      xs.push(arrowhead[i]);
      ys.push(arrowhead[i + 1]);
    }
  }
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return [minX, minY, maxX, maxY];
};

/**
 * Gets the global coordinates of the callout tail tip.
 */
export const getCalloutTailTipGlobalCoords = (
  element: ExcalidrawCalloutElement,
): [number, number] => {
  const { tipPoint } = getCalloutTailPoints(element);

  // Transform from local to global coordinates
  // The element rotates around its center, not the top-left corner
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  // First get the unrotated global position
  const unrotatedX = element.x + tipPoint[0];
  const unrotatedY = element.y + tipPoint[1];

  // Then rotate around the center
  const cos = Math.cos(element.angle);
  const sin = Math.sin(element.angle);
  const dx = unrotatedX - cx;
  const dy = unrotatedY - cy;
  const globalX = cx + dx * cos - dy * sin;
  const globalY = cy + dx * sin + dy * cos;

  return [globalX, globalY];
};

export const CALLOUT_HANDLE_SIZE = 16;
export const CALLOUT_ATTACHMENT_HANDLE_SIZE = 12;

/**
 * Checks if a point (in scene coordinates) is on the callout tail tip handle.
 */
export const isPointOnCalloutTailHandle = (
  element: ExcalidrawCalloutElement,
  sceneX: number,
  sceneY: number,
  zoom: number,
): boolean => {
  const [tipX, tipY] = getCalloutTailTipGlobalCoords(element);

  const distance = Math.hypot(sceneX - tipX, sceneY - tipY);
  // Use a larger hit area at higher zoom levels
  const hitRadius = (CALLOUT_HANDLE_SIZE + 2) / zoom;

  return distance < hitRadius;
};

/**
 * Gets the global coordinates of the callout tail attachment point.
 */
export const getCalloutAttachmentGlobalCoords = (
  element: ExcalidrawCalloutElement,
): [number, number] => {
  const { attachPoint } = getCalloutTailPoints(element);

  // Transform from local to global coordinates
  // The element rotates around its center, not the top-left corner
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  // First get the unrotated global position
  const unrotatedX = element.x + attachPoint[0];
  const unrotatedY = element.y + attachPoint[1];

  // Then rotate around the center
  const cos = Math.cos(element.angle);
  const sin = Math.sin(element.angle);
  const dx = unrotatedX - cx;
  const dy = unrotatedY - cy;
  const globalX = cx + dx * cos - dy * sin;
  const globalY = cy + dx * sin + dy * cos;

  return [globalX, globalY];
};

/**
 * Checks if a point (in scene coordinates) is on the callout tail attachment handle.
 */
export const isPointOnCalloutAttachmentHandle = (
  element: ExcalidrawCalloutElement,
  sceneX: number,
  sceneY: number,
  zoom: number,
): boolean => {
  const [attachX, attachY] = getCalloutAttachmentGlobalCoords(element);

  const distance = Math.hypot(sceneX - attachX, sceneY - attachY);
  const hitRadius = (CALLOUT_ATTACHMENT_HANDLE_SIZE + 2) / zoom;

  return distance < hitRadius;
};

/**
 * Calculates arrowhead points for the callout tail.
 * Returns points in the same format as getArrowheadPoints in bounds.ts.
 *
 * For arrow/bar type: returns [tipX, tipY, leftX, leftY, rightX, rightY]
 * For circle type: returns [centerX, centerY, diameter]
 * For triangle type: returns [tipX, tipY, leftX, leftY, rightX, rightY]
 * For diamond type: returns [tipX, tipY, leftX, leftY, oppositeX, oppositeY, rightX, rightY]
 */
export const getCalloutTailArrowheadPoints = (
  element: ExcalidrawCalloutElement,
  requestedArrowhead: Arrowhead | null = element.tailArrowhead,
  offsetMultiplier = 0,
): number[] | null => {
  const arrowhead = normalizeArrowhead(requestedArrowhead);
  if (!arrowhead) {
    return null;
  }

  const { controlPoint, tipPoint } = getCalloutTailPoints(element);

  // Calculate direction vector from control point to tip
  const dx = tipPoint[0] - controlPoint[0];
  const dy = tipPoint[1] - controlPoint[1];
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return null;
  }

  // Normalized direction vector
  const nx = dx / length;
  const ny = dy / length;

  const size = getArrowheadSize(arrowhead);
  const angle = getArrowheadAngle(arrowhead);

  // Scale down arrowhead if tail is short
  const minSize = Math.min(
    size,
    length *
      (arrowhead === "diamond" || arrowhead === "diamond_outline" ? 0.25 : 0.5),
  );

  const x2 = tipPoint[0] - nx * minSize * offsetMultiplier;
  const y2 = tipPoint[1] - ny * minSize * offsetMultiplier;
  const xs = x2 - nx * minSize;
  const ys = y2 - ny * minSize;

  // Handle circle/dot arrowheads
  if (arrowhead === "circle" || arrowhead === "circle_outline") {
    const diameter = Math.hypot(ys - y2, xs - x2) + element.strokeWidth - 2;
    return [x2, y2, diameter];
  }

  // Convert angle from degrees to radians
  const angleRad = (angle * Math.PI) / 180;

  // Handle crowfoot arrowheads (swap points)
  if (
    arrowhead === "cardinality_many" ||
    arrowhead === "cardinality_one_or_many"
  ) {
    const [x3, y3] = pointRotateRads(
      pointFrom(x2, y2),
      pointFrom(xs, ys),
      -angleRad as Radians,
    );
    const [x4, y4] = pointRotateRads(
      pointFrom(x2, y2),
      pointFrom(xs, ys),
      angleRad as Radians,
    );
    return [xs, ys, x3, y3, x4, y4];
  }

  // Standard arrowheads (arrow, bar, triangle, etc.)
  const [x3, y3] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(x2, y2),
    -angleRad as Radians,
  );
  const [x4, y4] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(x2, y2),
    angleRad as Radians,
  );

  // Handle diamond arrowheads (need an opposite point)
  if (arrowhead === "diamond" || arrowhead === "diamond_outline") {
    // Diamond needs 4 points: tip, left, opposite, right (in that order)
    // Opposite point is behind the tip
    const oppositeX = x2 - nx * minSize * 2;
    const oppositeY = y2 - ny * minSize * 2;
    return [x2, y2, x3, y3, oppositeX, oppositeY, x4, y4];
  }

  return [x2, y2, x3, y3, x4, y4];
};
