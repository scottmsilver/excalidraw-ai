/**
 * Agentic Edit Service
 *
 * Business logic layer that orchestrates the agentic image editing workflow.
 * Connects the Excalidraw canvas capture to the AI-powered editing API.
 *
 * This service:
 * 1. Converts canvas blobs to base64 format for API transmission
 * 2. Transforms reference points to API format
 * 3. Calls the agenticEdit API with SSE streaming
 * 4. Returns the final edited image
 *
 * @example
 * ```ts
 * const resultImage = await executeAgenticEdit({
 *   canvasBlob: await excalidrawAPI.exportToBlob(),
 *   referencePoints: points,
 *   command: "Move A to B",
 *   onProgress: (event) => console.log(event.step, event.message),
 * });
 * ```
 */

import { toApiReferencePoints } from "../components/ReferencePoints";

import { agenticEdit, type AIProgressEvent, type ShapeMetadata } from "./apiClient";

import type { ReferencePoint } from "../components/ReferencePoints";

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for executing an agentic edit operation.
 */
export interface AgenticEditParams {
  /** Clean source image as a Blob (original without annotations) */
  cleanImageBlob: Blob;
  /** Annotated image as a Blob (with user's drawings visible for AI guidance) */
  annotatedImageBlob?: Blob;
  /** Reference points placed on the canvas (A, B, C markers) */
  referencePoints: ReferencePoint[];
  /** User-drawn shapes/annotations for context (lines, arrows, rectangles, etc.) */
  shapes?: ShapeMetadata[];
  /** User's edit command (e.g., "Move A to B", "Make A red") */
  command: string;
  /** Optional mask image as base64 data URL for inpainting */
  mask?: string;
  /** Max iterations for self-check loop (default: 3) */
  maxIterations?: number;
  /** Callback for SSE progress events during processing */
  onProgress?: (event: AIProgressEvent) => void;
}

/**
 * Result of an agentic edit operation.
 */
export interface AgenticEditResult {
  /** Final edited image as base64 data URL */
  imageData: string;
  /** Number of self-check iterations performed */
  iterations: number;
  /** The final prompt used to generate the result */
  finalPrompt: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert a Blob to a base64 data URL.
 *
 * Uses FileReader API for cross-browser compatibility.
 * Returns a promise that resolves to the base64 string.
 *
 * @param blob - The blob to convert
 * @returns Promise resolving to base64 data URL (e.g., "data:image/png;base64,...")
 * @throws Error if blob reading fails
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader result is not a string"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read blob as base64"));
    };

    reader.readAsDataURL(blob);
  });
}

// =============================================================================
// Main Service Function
// =============================================================================

/**
 * Execute an agentic edit operation.
 *
 * This is the main entry point for AI-powered image editing. It:
 * 1. Converts the canvas blob to base64
 * 2. Converts reference points to API format
 * 3. Calls the agenticEdit API with SSE streaming
 * 4. Returns the final edited image
 *
 * The operation streams progress events via the onProgress callback,
 * allowing the UI to display thinking text, iteration status, and
 * intermediate results in real-time.
 *
 * @param params - The edit parameters including image, command, and reference points
 * @returns Promise resolving to the edit result with final image
 * @throws APIError if the API call fails
 * @throws Error if blob conversion fails
 *
 * @example
 * ```ts
 * try {
 *   const result = await executeAgenticEdit({
 *     canvasBlob: await excalidrawAPI.exportToBlob({
 *       mimeType: 'image/png',
 *       quality: 0.95,
 *     }),
 *     referencePoints: [
 *       { id: '1', label: 'A', x: 100, y: 100, createdAt: Date.now() },
 *       { id: '2', label: 'B', x: 300, y: 200, createdAt: Date.now() },
 *     ],
 *     command: "Move A to B",
 *     onProgress: (event) => {
 *       console.log(`[${event.step}] ${event.message}`);
 *       if (event.thinkingText) {
 *         console.log('AI thinking:', event.thinkingText);
 *       }
 *     },
 *   });
 *
 *   // Use the result image
 *   imageElement.src = result.imageData;
 * } catch (error) {
 *   console.error('Edit failed:', error);
 * }
 * ```
 */
export async function executeAgenticEdit(
  params: AgenticEditParams,
): Promise<AgenticEditResult> {
  const {
    cleanImageBlob,
    annotatedImageBlob,
    referencePoints,
    shapes,
    command,
    mask,
    maxIterations,
    onProgress,
  } = params;

  // Step 1: Convert blobs to base64 data URLs
  const cleanImageBase64 = await blobToBase64(cleanImageBlob);

  // Convert annotated image if provided
  const annotatedImageBase64 = annotatedImageBlob
    ? await blobToBase64(annotatedImageBlob)
    : undefined;

  // Step 2: Convert reference points to API format
  const apiReferencePoints = toApiReferencePoints(referencePoints);

  // Step 3: Call agentic edit API with SSE streaming
  // The clean image is what gets edited, the annotated image shows the AI what the user drew
  const response = await agenticEdit(cleanImageBase64, command, {
    annotatedImage: annotatedImageBase64,
    mask,
    referencePoints: apiReferencePoints,
    shapes,
    maxIterations,
    onProgress,
  });

  // Step 4: Return the result
  return {
    imageData: response.imageData,
    iterations: response.iterations,
    finalPrompt: response.finalPrompt,
  };
}

// =============================================================================
// Re-export Types for Convenience
// =============================================================================

export type { AIProgressEvent } from "./apiClient";
