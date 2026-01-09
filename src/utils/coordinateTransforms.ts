/**
 * Coordinate Transformation Utilities
 *
 * Centralizes all coordinate space transformations in the application.
 * There are three coordinate spaces:
 *
 * 1. CANVAS - Excalidraw's internal coordinate system where elements and
 *    reference points live. This is the "source of truth" for positions.
 *
 * 2. IMAGE - The coordinate system of exported PNG images sent to the AI.
 *    When Excalidraw exports to PNG, it crops to fit the element bounds
 *    and adds padding, so image coords differ from canvas coords.
 *
 * 3. SCREEN - Pixel coordinates on the viewport. Depends on the current
 *    zoom level and scroll position.
 *
 * Transformation formulas:
 *   Canvas → Image: imageX = canvasX - minX + exportPadding
 *   Image → Canvas: canvasX = imageX + minX - exportPadding
 *   Canvas → Screen: screenX = (canvasX + scrollX) * zoom
 *   Screen → Canvas: canvasX = screenX / zoom - scrollX
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Bounds information from Excalidraw export.
 * Used to transform between canvas and image coordinate spaces.
 */
export interface ExportBounds {
  /** Minimum X coordinate of all elements (left edge of content bounding box) */
  minX: number;
  /** Minimum Y coordinate of all elements (top edge of content bounding box) */
  minY: number;
  /** Padding added around exported content (default: 10) */
  exportPadding: number;
  /** Width of the exported image in pixels (optional, for positioning interim images) */
  imageWidth?: number;
  /** Height of the exported image in pixels (optional, for positioning interim images) */
  imageHeight?: number;
}

/**
 * Current viewport state from Excalidraw.
 * Used to transform between canvas and screen coordinate spaces.
 */
export interface ViewportState {
  /** Horizontal scroll offset */
  scrollX: number;
  /** Vertical scroll offset */
  scrollY: number;
  /** Zoom level (1.0 = 100%) */
  zoom: number;
}

/**
 * A point in any coordinate space.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A rectangular region defined by two corners.
 */
export interface Region {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// =============================================================================
// Canvas ↔ Image Transformations
// =============================================================================

/**
 * Transform a point from canvas coordinates to image coordinates.
 *
 * When Excalidraw exports to PNG, it crops to the bounding box of all elements
 * and adds padding. This function converts a canvas coordinate to where it
 * would appear in the exported image.
 *
 * Formula: imageX = canvasX - minX + exportPadding
 */
export function canvasToImage(point: Point, bounds: ExportBounds): Point {
  return {
    x: point.x - bounds.minX + bounds.exportPadding,
    y: point.y - bounds.minY + bounds.exportPadding,
  };
}

/**
 * Transform a point from image coordinates to canvas coordinates.
 *
 * This is the inverse of canvasToImage - converts a coordinate from an
 * exported PNG back to where it is on the canvas.
 *
 * Formula: canvasX = imageX + minX - exportPadding
 */
export function imageToCanvas(point: Point, bounds: ExportBounds): Point {
  return {
    x: point.x + bounds.minX - bounds.exportPadding,
    y: point.y + bounds.minY - bounds.exportPadding,
  };
}

/**
 * Transform a region from canvas coordinates to image coordinates.
 */
export function canvasRegionToImage(
  region: Region,
  bounds: ExportBounds,
): Region {
  const p1 = canvasToImage({ x: region.x1, y: region.y1 }, bounds);
  const p2 = canvasToImage({ x: region.x2, y: region.y2 }, bounds);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/**
 * Transform a region from image coordinates to canvas coordinates.
 */
export function imageRegionToCanvas(
  region: Region,
  bounds: ExportBounds,
): Region {
  const p1 = imageToCanvas({ x: region.x1, y: region.y1 }, bounds);
  const p2 = imageToCanvas({ x: region.x2, y: region.y2 }, bounds);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

// =============================================================================
// Canvas ↔ Screen Transformations
// =============================================================================

/**
 * Transform a point from canvas coordinates to screen coordinates.
 *
 * Screen coordinates are where things appear on the viewport, accounting
 * for the current zoom level and scroll position.
 *
 * Formula: screenX = (canvasX + scrollX) * zoom
 */
export function canvasToScreen(point: Point, viewport: ViewportState): Point {
  return {
    x: (point.x + viewport.scrollX) * viewport.zoom,
    y: (point.y + viewport.scrollY) * viewport.zoom,
  };
}

/**
 * Transform a point from screen coordinates to canvas coordinates.
 *
 * This is the inverse of canvasToScreen - converts a screen position
 * (like a mouse click) to canvas coordinates.
 *
 * Formula: canvasX = screenX / zoom - scrollX
 */
export function screenToCanvas(point: Point, viewport: ViewportState): Point {
  return {
    x: point.x / viewport.zoom - viewport.scrollX,
    y: point.y / viewport.zoom - viewport.scrollY,
  };
}

/**
 * Transform a region from canvas coordinates to screen coordinates.
 */
export function canvasRegionToScreen(
  region: Region,
  viewport: ViewportState,
): Region {
  const p1 = canvasToScreen({ x: region.x1, y: region.y1 }, viewport);
  const p2 = canvasToScreen({ x: region.x2, y: region.y2 }, viewport);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

// =============================================================================
// Compound Transformations (Image ↔ Screen)
// =============================================================================

/**
 * Transform a point from image coordinates directly to screen coordinates.
 *
 * This is a compound transformation: Image → Canvas → Screen
 * Useful when displaying AI output coordinates on the canvas overlay.
 */
export function imageToScreen(
  point: Point,
  bounds: ExportBounds,
  viewport: ViewportState,
): Point {
  const canvasPoint = imageToCanvas(point, bounds);
  return canvasToScreen(canvasPoint, viewport);
}

/**
 * Transform a region from image coordinates directly to screen coordinates.
 */
export function imageRegionToScreen(
  region: Region,
  bounds: ExportBounds,
  viewport: ViewportState,
): Region {
  const canvasRegion = imageRegionToCanvas(region, bounds);
  return canvasRegionToScreen(canvasRegion, viewport);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a ViewportState from Excalidraw's AppState.
 */
export function getViewportFromAppState(appState: {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
}): ViewportState {
  return {
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom.value,
  };
}

/**
 * Default export padding used by Excalidraw.
 */
export const DEFAULT_EXPORT_PADDING = 10;
