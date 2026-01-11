/**
 * API client for python-server endpoints.
 *
 * Provides functions to call python-server endpoints with proper error handling
 * and SSE streaming support for real-time progress updates.
 *
 * Endpoints:
 * - agenticEdit() - POST /api/agentic/edit (SSE streaming)
 * - generateImage() - POST /api/images/generate
 * - inpaint() - POST /api/images/inpaint (SSE streaming)
 *
 * The Vite dev server proxies /api/* requests to python-server on port 8001.
 */

/// <reference types="vite/client" />

import type {
  AgenticEditResponse,
  AgenticEditOptions,
  AIProgressEvent,
  GenerateImageOptions,
  GenerateImageResponse,
  InpaintOptions,
  InpaintResponse,
} from "./types";

// =============================================================================
// Debug Logging
// =============================================================================

// Only log in development
const DEBUG = import.meta.env.DEV;

function debugLog(message: string, data?: Record<string, unknown>): void {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`[apiClient] ${message}`, data ?? "");
  }
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for API-related errors.
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Custom error class for SSE-related errors.
 */
export class SSEError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = "SSEError";
  }
}

// =============================================================================
// SSE Line Parser
// =============================================================================

/**
 * Parse SSE stream lines into events.
 *
 * SSE format:
 * - event: <event-type>
 * - data: <json-data>
 * - Empty line marks end of event
 */
interface SSEEvent {
  event: string;
  data: string;
}

function parseSSELine(
  line: string,
  currentEvent: Partial<SSEEvent>,
): { event?: SSEEvent; partial: Partial<SSEEvent> } {
  // Empty line = end of event
  if (line === "") {
    if (currentEvent.data !== undefined) {
      const event = {
        event: currentEvent.event || "message",
        data: currentEvent.data,
      };
      return { event, partial: {} };
    }
    return { partial: {} };
  }

  // Parse "field: value" format
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return { partial: currentEvent };
  }

  const field = line.slice(0, colonIndex);
  // Value starts after colon and optional space
  let value = line.slice(colonIndex + 1);
  if (value.startsWith(" ")) {
    value = value.slice(1);
  }

  if (field === "event") {
    return { partial: { ...currentEvent, event: value } };
  } else if (field === "data") {
    // Append data (SSE allows multiple data: lines)
    const existingData = currentEvent.data ?? "";
    const newData = existingData ? `${existingData}\n${value}` : value;
    return { partial: { ...currentEvent, data: newData } };
  }

  return { partial: currentEvent };
}

// =============================================================================
// SSE POST Request Helper
// =============================================================================

/**
 * Promise-based SSE client using POST with JSON body.
 *
 * Implements SSE parsing manually using fetch() to support POST requests.
 * This avoids HTTP 431 errors when sending large data (e.g., base64 images) in URLs.
 *
 * Key insight: EventSource API only supports GET requests, so we use fetch
 * with streaming response to parse SSE events from POST requests.
 */
async function ssePostRequest<TComplete, TProgress>(
  url: string,
  body: unknown,
  options: {
    onProgress?: (data: TProgress) => void;
  } = {},
): Promise<TComplete> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  debugLog("SSE connection opened", { status: response.status });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let details: string | undefined;

    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
      details = errorData.details;
    } catch {
      // Use default error message
    }

    throw new SSEError(errorMessage, details);
  }

  if (!response.body) {
    throw new SSEError("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let currentEvent: Partial<SSEEvent> = {};
  let lastProgressJson: string | undefined;

  return new Promise<TComplete>(async (resolve, reject) => {
    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          reject(new SSEError("SSE stream closed without complete event"));
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const result = parseSSELine(line, currentEvent);
          currentEvent = result.partial;

          if (result.event) {
            const ev = result.event;
            debugLog("SSE raw event", {
              event: ev.event,
              dataLength: ev.data?.length || 0,
            });

            if (!ev.data) {
              continue;
            }

            try {
              const data = JSON.parse(ev.data);

              if (ev.event === "progress") {
                // Prevent duplicate progress events
                if (ev.data === lastProgressJson) {
                  debugLog("Skipping duplicate progress event");
                  continue;
                }
                lastProgressJson = ev.data;
                debugLog("SSE received progress", {
                  step: data.step,
                  message: data.message,
                  hasInputImages: data.inputImages?.length ?? 0,
                  hasIterationImage: !!data.iterationImage,
                });
                options.onProgress?.(data);
              } else if (ev.event === "complete") {
                debugLog("SSE received complete event", {
                  hasImageData: !!data.imageData,
                  imageDataLength: data.imageData?.length || 0,
                });
                reader.cancel();
                resolve(data as TComplete);
                return;
              } else if (ev.event === "error") {
                reader.cancel();
                reject(
                  new SSEError(data.message || "Server error", data.details),
                );
                return;
              }
            } catch (parseError) {
              // Ignore JSON parse errors (e.g., SSE comments)
              if (!(parseError instanceof SyntaxError)) {
                throw parseError;
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof SSEError) {
        reject(error);
      } else {
        reject(
          new SSEError(
            "SSE connection error",
            error instanceof Error ? error.message : undefined,
          ),
        );
      }
    }
  });
}

// =============================================================================
// API Endpoints
// =============================================================================

// API base URL:
// - Development: empty (Vite proxy handles /api/* -> localhost:8001)
// - Production: set VITE_API_BASE_URL to the backend URL (e.g., https://screenmark-api.fly.dev)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const API_ENDPOINTS = {
  AGENTIC_EDIT: `${API_BASE_URL}/api/agentic/edit`,
  GENERATE_IMAGE: `${API_BASE_URL}/api/images/generate`,
  INPAINT: `${API_BASE_URL}/api/images/inpaint`,
} as const;

// =============================================================================
// Agentic Edit (SSE Streaming)
// =============================================================================

/**
 * Perform agentic image editing with SSE streaming progress.
 *
 * This is the primary endpoint for AI-powered image editing. It:
 * 1. Plans the edit using AI reasoning
 * 2. Generates the edited image
 * 3. Self-checks the result
 * 4. Iterates if needed (up to maxIterations)
 *
 * Progress is streamed via Server-Sent Events (SSE).
 *
 * @param image - Base64 encoded source image (data URL)
 * @param prompt - User's edit command (e.g., "Move A to B")
 * @param options.mask - Optional mask for inpainting (base64 data URL)
 * @param options.referencePoints - Reference points for spatial commands
 * @param options.maxIterations - Max self-check iterations (default: 3)
 * @param options.onProgress - Callback for SSE progress events
 * @returns Promise resolving to the final edited image and metadata
 *
 * @example
 * ```ts
 * const result = await agenticEdit(
 *   imageDataUrl,
 *   "Move the red circle to point B",
 *   {
 *     referencePoints: [
 *       { label: "A", x: 100, y: 100 },
 *       { label: "B", x: 300, y: 200 },
 *     ],
 *     onProgress: (event) => {
 *       console.log(`${event.step}: ${event.message}`);
 *       if (event.iterationImage) {
 *         showPreview(event.iterationImage);
 *       }
 *     },
 *   }
 * );
 * console.log('Final image:', result.imageData);
 * ```
 */
export async function agenticEdit(
  image: string,
  prompt: string,
  options: AgenticEditOptions = {},
): Promise<AgenticEditResponse> {
  const { mask, referencePoints, maxIterations, onProgress } = options;

  // Build request body matching Python AgenticEditRequest schema
  const requestBody = {
    sourceImage: image,
    prompt,
    maskImage: mask,
    referencePoints,
    maxIterations: maxIterations ?? 3,
  };

  debugLog("Agentic edit request", {
    hasImage: !!image,
    promptLength: prompt.length,
    hasMask: !!mask,
    referencePointCount: referencePoints?.length ?? 0,
    maxIterations: requestBody.maxIterations,
  });

  try {
    return await ssePostRequest<AgenticEditResponse, AIProgressEvent>(
      API_ENDPOINTS.AGENTIC_EDIT,
      requestBody,
      { onProgress },
    );
  } catch (error) {
    if (error instanceof SSEError) {
      throw new APIError(error.message, undefined, error.details);
    }
    throw error;
  }
}

// =============================================================================
// Generate Image (Non-streaming)
// =============================================================================

/**
 * Generate or edit an image using the AI model.
 *
 * This is a simpler, non-streaming endpoint for basic image generation/editing.
 * For more advanced editing with progress feedback, use agenticEdit().
 *
 * @param sourceImage - Base64 encoded source image (data URL)
 * @param prompt - Edit prompt describing the desired changes
 * @param options.model - The model to use (default: "gemini-3-pro-image-preview")
 * @param options.maskImage - Optional mask for inpainting
 * @param options.logLabel - Label for logging
 * @returns Promise resolving to the generated image
 *
 * @example
 * ```ts
 * const result = await generateImage(
 *   imageDataUrl,
 *   "Make the sky more blue",
 *   { model: "gemini-3-pro-image-preview" }
 * );
 * console.log('Generated image:', result.imageData);
 * ```
 */
export async function generateImage(
  sourceImage: string,
  prompt: string,
  options: GenerateImageOptions,
): Promise<GenerateImageResponse> {
  const { model, maskImage, logLabel } = options;

  const requestBody = {
    model,
    sourceImage,
    prompt,
    maskImage,
    isImageGeneration: true,
    logLabel,
  };

  debugLog("Generate image request", {
    model,
    hasSourceImage: !!sourceImage,
    promptLength: prompt.length,
    hasMaskImage: !!maskImage,
  });

  try {
    const response = await fetch(API_ENDPOINTS.GENERATE_IMAGE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let details: string | undefined;

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        details = errorData.details;
      } catch {
        // Use default error message
      }

      throw new APIError(errorMessage, response.status, details);
    }

    const data = (await response.json()) as GenerateImageResponse;
    debugLog("Generate image success", {
      hasImageData: !!data.imageData,
      imageDataLength: data.imageData?.length || 0,
    });

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(
      "Network error",
      undefined,
      error instanceof Error ? error.message : undefined,
    );
  }
}

// =============================================================================
// Inpaint (SSE Streaming)
// =============================================================================

/**
 * Perform inpainting with SSE streaming progress.
 *
 * This endpoint uses the full agentic workflow for inpainting:
 * 1. Plans the edit using AI reasoning (mask-aware)
 * 2. Generates the edited image
 * 3. Self-checks the result
 * 4. Iterates if needed
 *
 * @param sourceImage - Base64 encoded source image (data URL)
 * @param maskImage - Base64 encoded mask image (data URL, white = edit area)
 * @param prompt - Edit prompt describing what to do in the masked area
 * @param options.thinkingBudget - Thinking budget for planning
 * @param options.onProgress - Callback for SSE progress events
 * @returns Promise resolving to the inpainted image and metadata
 *
 * @example
 * ```ts
 * const result = await inpaint(
 *   imageDataUrl,
 *   maskDataUrl,
 *   "Replace the background with a sunset",
 *   {
 *     onProgress: (event) => {
 *       console.log(`${event.step}: ${event.message}`);
 *     },
 *   }
 * );
 * console.log('Inpainted image:', result.imageData);
 * ```
 */
export async function inpaint(
  sourceImage: string,
  maskImage: string,
  prompt: string,
  options: InpaintOptions = {},
): Promise<InpaintResponse> {
  const { thinkingBudget, onProgress } = options;

  const requestBody = {
    sourceImage,
    maskImage,
    prompt,
    thinkingBudget,
  };

  debugLog("Inpaint request", {
    hasSourceImage: !!sourceImage,
    hasMaskImage: !!maskImage,
    promptLength: prompt.length,
    thinkingBudget,
  });

  try {
    return await ssePostRequest<InpaintResponse, AIProgressEvent>(
      API_ENDPOINTS.INPAINT,
      requestBody,
      { onProgress },
    );
  } catch (error) {
    if (error instanceof SSEError) {
      throw new APIError(error.message, undefined, error.details);
    }
    throw error;
  }
}

// =============================================================================
// Export Types
// =============================================================================

export type {
  AgenticEditResponse,
  AgenticEditOptions,
  AIProgressEvent,
  GenerateImageOptions,
  GenerateImageResponse,
  InpaintOptions,
  InpaintResponse,
  ReferencePoint,
} from "./types";
