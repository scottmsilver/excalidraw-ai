/**
 * Shape Extractor Utility
 *
 * Extracts shape metadata from Excalidraw elements for sending to the AI.
 * Handles coordinate transformation from canvas space to image space.
 */

import {
  SHAPE_TYPES,
  type BoundingBox,
  type Point2D,
  type ShapeMetadata,
  type ShapeType,
} from "../services/types";

import { canvasToImage, type ExportBounds } from "./coordinateTransforms";

// Excalidraw element types we need to extract
// We use a minimal interface to avoid importing from @excalidraw/element
interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  isDeleted?: boolean;
}

interface LinearElement extends BaseElement {
  type: "line" | "arrow";
  points: readonly [number, number][];
  startArrowhead: string | null;
  endArrowhead: string | null;
  /** When set, line uses cubic bezier curves between points */
  roundness: { type: number; value?: number } | null;
  /** Whether the start and end connect to form a closed polygon */
  // Note: Excalidraw doesn't have a dedicated "polygon" flag for lines,
  // but we can detect closure by comparing first and last points
}

interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
}

interface FreedrawElement extends BaseElement {
  type: "freedraw";
  points: readonly [number, number][];
}

type SupportedElement =
  | (BaseElement & { type: "rectangle" | "ellipse" | "diamond" })
  | LinearElement
  | TextElement
  | FreedrawElement;

/**
 * Check if an element type is supported for extraction.
 */
function isSupportedType(type: string): type is ShapeType {
  return (SHAPE_TYPES as readonly string[]).includes(type);
}

/**
 * Transform a point from canvas to image coordinates.
 */
function transformPoint(point: Point2D, bounds: ExportBounds): Point2D {
  const transformed = canvasToImage(point, bounds);
  return { x: transformed.x, y: transformed.y };
}

/**
 * Extract metadata from a single element.
 */
function extractElementMetadata(
  element: SupportedElement,
  bounds: ExportBounds,
): ShapeMetadata | null {
  if (element.isDeleted) {
    return null;
  }

  if (!isSupportedType(element.type)) {
    return null;
  }

  // Transform bounding box to image coordinates
  const topLeft = transformPoint({ x: element.x, y: element.y }, bounds);
  const boundingBox: BoundingBox = {
    x: topLeft.x,
    y: topLeft.y,
    width: element.width,
    height: element.height,
  };

  const base: ShapeMetadata = {
    type: element.type as ShapeType,
    strokeColor: element.strokeColor,
    strokeWidth: element.strokeWidth,
    backgroundColor:
      element.backgroundColor !== "transparent"
        ? element.backgroundColor
        : undefined,
    boundingBox,
  };

  // Add type-specific properties
  if (element.type === "line" || element.type === "arrow") {
    const linearEl = element as LinearElement;
    const rawPoints = linearEl.points;

    if (rawPoints.length >= 2) {
      // Transform all points from canvas to image coordinates
      // Points are relative to element.x, element.y
      const transformedPoints = rawPoints.map((pt) => {
        const canvasPoint = {
          x: element.x + pt[0],
          y: element.y + pt[1],
        };
        return transformPoint(canvasPoint, bounds);
      });

      // Set start and end points (backwards compatible)
      base.startPoint = transformedPoints[0];
      base.endPoint = transformedPoints[transformedPoints.length - 1];

      // Include all points for multi-segment lines/polylines
      // Only include if there are more than 2 points (otherwise start/end are sufficient)
      if (transformedPoints.length > 2) {
        base.points = transformedPoints;
      }

      // Detect if line forms a closed polygon
      // Check if first and last points are very close (within 5px threshold)
      const firstPt = rawPoints[0];
      const lastPt = rawPoints[rawPoints.length - 1];
      const closureThreshold = 5;
      const distance = Math.sqrt(
        Math.pow(lastPt[0] - firstPt[0], 2) +
          Math.pow(lastPt[1] - firstPt[1], 2),
      );
      if (distance < closureThreshold && rawPoints.length > 2) {
        base.isClosed = true;
      }

      // Check if line uses curves (bezier)
      if (linearEl.roundness !== null) {
        base.isCurved = true;
      }

      if (element.type === "arrow") {
        base.hasStartArrowhead = linearEl.startArrowhead !== null;
        base.hasEndArrowhead = linearEl.endArrowhead !== null;
      }
    }
  } else if (element.type === "text") {
    const textEl = element as TextElement;
    base.textContent = textEl.text;
    base.fontSize = textEl.fontSize;
  } else if (element.type === "freedraw") {
    const freedrawEl = element as FreedrawElement;
    base.pointCount = freedrawEl.points.length;
  }

  return base;
}

/**
 * Extract shape metadata from Excalidraw elements.
 *
 * Filters to supported annotation types and transforms coordinates
 * from canvas space to image space.
 *
 * @param elements - Excalidraw elements from the scene
 * @param bounds - Export bounds for coordinate transformation
 * @returns Array of shape metadata for the AI
 *
 * @example
 * ```ts
 * const elements = excalidrawAPI.getSceneElements();
 * const bounds = { minX: 0, minY: 0, exportPadding: 10 };
 * const shapes = extractShapesFromElements(elements, bounds);
 * ```
 */
export function extractShapesFromElements(
  elements: readonly unknown[],
  bounds: ExportBounds,
): ShapeMetadata[] {
  const shapes: ShapeMetadata[] = [];

  for (const element of elements) {
    const el = element as SupportedElement;

    // Filter to supported types
    if (!isSupportedType(el.type)) {
      continue;
    }

    // Skip deleted elements
    if (el.isDeleted) {
      continue;
    }

    const metadata = extractElementMetadata(el, bounds);
    if (metadata) {
      shapes.push(metadata);
    }
  }

  return shapes;
}

/**
 * Calculate export bounds from elements.
 *
 * This computes the minX and minY values needed for coordinate transformation.
 *
 * @param elements - Excalidraw elements from the scene
 * @param exportPadding - Padding used in export (default: 10)
 * @returns ExportBounds for coordinate transformation
 */
export function calculateExportBounds(
  elements: readonly unknown[],
  exportPadding: number = 10,
): ExportBounds {
  let minX = Infinity;
  let minY = Infinity;

  for (const element of elements) {
    const el = element as BaseElement;
    if (el.isDeleted) {
      continue;
    }

    if (el.x < minX) {
      minX = el.x;
    }
    if (el.y < minY) {
      minY = el.y;
    }
  }

  // Handle empty elements case
  if (!isFinite(minX)) {
    minX = 0;
  }
  if (!isFinite(minY)) {
    minY = 0;
  }

  return {
    minX,
    minY,
    exportPadding,
  };
}
