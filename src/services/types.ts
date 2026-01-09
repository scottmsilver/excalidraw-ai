/**
 * TypeScript types for API client communication with python-server.
 *
 * These types match the Python Pydantic schemas in python-server/schemas/
 * to ensure type-safe API communication.
 */

// =============================================================================
// Progress Step Enum (matches Python AIProgressStep)
// =============================================================================

export type AIProgressStep =
  | "idle"
  | "planning"
  | "calling_api"
  | "processing"
  | "self_checking"
  | "iterating"
  | "complete"
  | "error";

// =============================================================================
// Reference Points (for agentic edit)
// =============================================================================

export interface ReferencePoint {
  /** Label for this point (e.g., "A", "B", "C") */
  label: string;
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
}

// =============================================================================
// SSE Event Types
// =============================================================================

export interface IterationInfo {
  current: number;
  max: number;
}

export interface ErrorInfo {
  message: string;
  details?: string;
}

export interface AIInputImage {
  /** Label describing what this image is (e.g., "Original Image", "Edited Result", "Mask") */
  label: string;
  /** Base64 data URL of the image */
  dataUrl: string;
}

/**
 * SSE progress event for streaming operations.
 * Matches Python AIProgressEvent schema.
 */
export interface AIProgressEvent {
  step: AIProgressStep;
  message?: string;

  // Thinking text (full or delta for streaming)
  thinkingText?: string;
  thinkingTextDelta?: string;

  // Full transparency fields
  prompt?: string;
  rawOutput?: string;
  rawOutputDelta?: string;
  inputImages?: AIInputImage[];

  // Iteration tracking
  iteration?: IterationInfo;

  // Error info
  error?: ErrorInfo;

  // Generated image from this iteration (base64 data URL)
  iterationImage?: string;

  // Force new log entry in UI
  newLogEntry?: boolean;
}

// =============================================================================
// Agentic Edit API Types (POST /api/agentic/edit)
// =============================================================================

/**
 * Request body for POST /api/agentic/edit endpoint.
 * This is the primary endpoint for AI-powered image editing.
 */
export interface AgenticEditRequest {
  /** Source image as base64 data URL */
  image: string;
  /** User's edit prompt/command (e.g., "Move A to B") */
  prompt: string;
  /** Optional mask image for inpainting (base64 data URL, white = edit area) */
  mask?: string;
  /** Reference points for spatial commands */
  referencePoints?: ReferencePoint[];
  /** Maximum iterations for self-check loop (1-5, default 3) */
  maxIterations?: number;
}

/**
 * Response from POST /api/agentic/edit endpoint.
 * Sent as SSE 'complete' event after streaming progress.
 */
export interface AgenticEditResponse {
  /** Final generated image as base64 data URL */
  imageData: string;
  /** Number of iterations performed */
  iterations: number;
  /** Final prompt that produced the result */
  finalPrompt: string;
}

// =============================================================================
// Image Generation API Types (POST /api/images/generate)
// =============================================================================

/**
 * Request body for POST /api/images/generate endpoint.
 */
export interface GenerateImageRequest {
  /** The model to use (e.g., "gemini-3-pro-image-preview") */
  model: string;
  /** Source image as base64 data URL */
  sourceImage: string;
  /** Edit prompt */
  prompt: string;
  /** Optional mask image as base64 data URL */
  maskImage?: string;
  /** Whether this is an image generation call */
  isImageGeneration?: boolean;
  /** Label for this call in the log */
  logLabel?: string;
}

/**
 * Response from POST /api/images/generate endpoint.
 */
export interface GenerateImageResponse {
  /** The raw result from the API */
  raw: Record<string, unknown>;
  /** Generated image as base64 data URL */
  imageData: string;
}

// =============================================================================
// Inpaint API Types (POST /api/images/inpaint)
// =============================================================================

/**
 * Request body for POST /api/images/inpaint endpoint.
 */
export interface InpaintRequest {
  /** Source image as base64 data URL */
  sourceImage: string;
  /** Mask image as base64 data URL (white = edit area) */
  maskImage: string;
  /** Edit prompt */
  prompt: string;
  /** Thinking budget for planning */
  thinkingBudget?: number;
}

/**
 * Response from POST /api/images/inpaint endpoint.
 * Now uses agentic workflow so returns same format as AgenticEditResponse.
 */
export interface InpaintResponse {
  /** Generated image as base64 data URL */
  imageData: string;
  /** Number of iterations performed */
  iterations: number;
  /** Final prompt that produced the result */
  finalPrompt: string;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error response from API endpoints.
 */
export interface ErrorResponse {
  error: string;
  details?: string;
  stack?: string;
}

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Callback function type for SSE progress events.
 */
export type OnProgressCallback = (event: AIProgressEvent) => void;

/**
 * Options for agenticEdit function.
 */
export interface AgenticEditOptions {
  /** Optional mask for inpainting */
  mask?: string;
  /** Reference points for spatial commands */
  referencePoints?: ReferencePoint[];
  /** Max self-check iterations (default: 3) */
  maxIterations?: number;
  /** Callback for SSE progress events */
  onProgress?: OnProgressCallback;
}

/**
 * Options for generateImage function.
 */
export interface GenerateImageOptions {
  /** The model to use */
  model: string;
  /** Optional mask image */
  maskImage?: string;
  /** Label for logging */
  logLabel?: string;
}

/**
 * Options for inpaint function.
 */
export interface InpaintOptions {
  /** Thinking budget for planning */
  thinkingBudget?: number;
  /** Callback for SSE progress events */
  onProgress?: OnProgressCallback;
}
