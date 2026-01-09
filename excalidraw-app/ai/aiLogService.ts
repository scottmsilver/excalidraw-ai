/**
 * Centralized AI logging service - singleton that services can log to directly
 * and React components can subscribe to for real-time updates.
 */

import type { AIProgressStep, AILogEntry, AILogState } from "./types";

/**
 * Generate unique ID for log entries
 */
const generateLogId = (): string =>
  `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Listener callback type
 */
type LogListener = (log: AILogEntry[]) => void;
type StateListener = (state: AILogState) => void;

/**
 * Input image for logging
 */
export interface AIInputImage {
  label: string;
  dataUrl: string;
}

/**
 * Options for creating a log entry
 */
export interface LogEntryOptions {
  step: AIProgressStep;
  message: string;
  thinkingText?: string;
  prompt?: string;
  rawOutput?: string;
  inputImages?: AIInputImage[];
  iteration?: { current: number; max: number };
  error?: { message: string; details?: string };
  iterationImage?: string;
}

/**
 * Centralized AI Log Service
 * - Services import this singleton and log directly
 * - React components subscribe to changes
 */
class AILogService {
  private log: AILogEntry[] = [];
  private logListeners: Set<LogListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();

  // Current operation tracking
  private currentOperationId: string | null = null;
  private operationStartTime: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  private currentState: AILogState = {
    step: "idle",
    message: "",
    elapsedMs: 0,
    isActive: false,
  };

  /**
   * Start a new operation (creates a log entry and starts timer)
   */
  startOperation(step: AIProgressStep, message: string): string {
    // End any existing operation first
    if (this.currentOperationId) {
      this.endOperation("complete", "Operation interrupted");
    }

    const id = generateLogId();
    this.currentOperationId = id;
    this.operationStartTime = Date.now();

    const entry: AILogEntry = {
      id,
      timestamp: Date.now(),
      step,
      message,
    };

    this.log.push(entry);
    this.updateState({ step, message, elapsedMs: 0, isActive: true });
    this.notifyLogListeners();
    this.startTimer();

    return id;
  }

  /**
   * Update the current operation by appending a new log entry.
   * Each progress update creates a separate entry for full history visibility.
   */
  updateOperation(options: Partial<LogEntryOptions>): void {
    if (!this.currentOperationId) {
      // No active operation - start one if this is an active step
      if (
        options.step &&
        options.step !== "idle" &&
        options.step !== "complete" &&
        options.step !== "error"
      ) {
        this.startOperation(options.step, options.message || "");
        return;
      }
      return;
    }

    // Create a new log entry for this update (append-only)
    const id = generateLogId();
    const entry: AILogEntry = {
      id,
      timestamp: Date.now(),
      step: options.step ?? this.currentState.step,
      message: options.message ?? "",
      thinkingText: options.thinkingText,
      prompt: options.prompt,
      rawOutput: options.rawOutput,
      inputImages: options.inputImages,
      iteration: options.iteration,
      error: options.error,
      iterationImage: options.iterationImage,
    };

    this.log.push(entry);

    this.updateState({
      step: options.step ?? this.currentState.step,
      message: options.message ?? this.currentState.message,
      elapsedMs: this.operationStartTime
        ? Date.now() - this.operationStartTime
        : 0,
      isActive: true,
    });

    this.notifyLogListeners();
  }

  /**
   * Append thinking text to current operation
   */
  appendThinking(text: string): void {
    if (!this.currentOperationId) {
      return;
    }

    const index = this.log.findIndex((e) => e.id === this.currentOperationId);
    if (index >= 0) {
      const entry = this.log[index];
      this.log[index] = {
        ...entry,
        thinkingText: (entry.thinkingText || "") + text,
      };
      this.notifyLogListeners();
    }
  }

  /**
   * Append raw output to current operation
   */
  appendRawOutput(text: string): void {
    if (!this.currentOperationId) {
      return;
    }

    const index = this.log.findIndex((e) => e.id === this.currentOperationId);
    if (index >= 0) {
      const entry = this.log[index];
      this.log[index] = {
        ...entry,
        rawOutput: (entry.rawOutput || "") + text,
      };
      this.notifyLogListeners();
    }
  }

  /**
   * Attach debug data to current operation (for self-check visualization)
   */
  attachDebugData(debugData: AILogEntry["debugData"]): void {
    if (!this.currentOperationId) {
      return;
    }

    const index = this.log.findIndex((e) => e.id === this.currentOperationId);
    if (index >= 0) {
      this.log[index] = {
        ...this.log[index],
        debugData,
      };
      this.notifyLogListeners();
    }
  }

  /**
   * Log a discrete entry (for operations that don't need start/end tracking)
   */
  logEntry(options: LogEntryOptions): string {
    const id = generateLogId();
    const entry: AILogEntry = {
      id,
      timestamp: Date.now(),
      step: options.step,
      message: options.message,
      thinkingText: options.thinkingText,
      prompt: options.prompt,
      rawOutput: options.rawOutput,
      inputImages: options.inputImages,
      iteration: options.iteration,
      error: options.error,
      iterationImage: options.iterationImage,
    };

    this.log.push(entry);
    this.notifyLogListeners();
    return id;
  }

  /**
   * End the current operation by appending a final entry
   */
  endOperation(
    step: "complete" | "error",
    message?: string,
    error?: { message: string; details?: string },
  ): void {
    if (!this.currentOperationId) {
      return;
    }

    this.stopTimer();

    const durationMs = this.operationStartTime
      ? Date.now() - this.operationStartTime
      : 0;

    // Create a new log entry for the completion (append-only)
    const id = generateLogId();
    const entry: AILogEntry = {
      id,
      timestamp: Date.now(),
      step,
      message: message || (step === "complete" ? "Complete" : "Error"),
      error,
      durationMs,
    };

    this.log.push(entry);

    this.currentOperationId = null;
    this.operationStartTime = null;
    this.updateState({
      step,
      message: message || "",
      elapsedMs: 0,
      isActive: false,
    });
    this.notifyLogListeners();
  }

  /**
   * Subscribe to log changes
   */
  subscribeToLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    // Immediately send current state
    listener([...this.log]);
    return () => this.logListeners.delete(listener);
  }

  /**
   * Subscribe to state changes (for header display)
   */
  subscribeToState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener({ ...this.currentState });
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Get current log entries
   */
  getLog(): AILogEntry[] {
    return [...this.log];
  }

  /**
   * Get current state
   */
  getState(): AILogState {
    return { ...this.currentState };
  }

  /**
   * Clear all log entries
   */
  clearLog(): void {
    this.log = [];
    this.notifyLogListeners();
  }

  /**
   * Check if there's an active operation
   */
  isActive(): boolean {
    return this.currentOperationId !== null;
  }

  // Private methods

  private notifyLogListeners(): void {
    const logCopy = [...this.log];
    this.logListeners.forEach((listener) => listener(logCopy));
  }

  private notifyStateListeners(): void {
    const stateCopy = { ...this.currentState };
    this.stateListeners.forEach((listener) => listener(stateCopy));
  }

  private updateState(state: AILogState): void {
    this.currentState = state;
    this.notifyStateListeners();
  }

  private startTimer(): void {
    if (this.timerInterval) {
      return;
    }

    this.timerInterval = setInterval(() => {
      if (this.operationStartTime) {
        this.updateState({
          ...this.currentState,
          elapsedMs: Date.now() - this.operationStartTime,
        });
      }
    }, 100);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

// Export singleton instance
export const aiLogService = new AILogService();

// Re-export types for convenience
export type { AIProgressStep, AILogEntry, AILogState } from "./types";
