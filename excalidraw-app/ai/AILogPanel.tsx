import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import {
  brainIcon,
  boltIcon,
  tablerCheckIcon,
  alertTriangleIcon,
  clockIcon,
  copyIcon,
  TrashIcon,
  collapseDownIcon,
  collapseUpIcon,
  listEndIcon,
  arrowDownToLineIcon,
  fileCodeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { marked } from "marked";

import { aiLogService } from "./aiLogService";
import { useCoordinateHighlightOptional } from "./CoordinateHighlightContext";
import {
  wrapCoordinatesInHtml,
  parseCoordinateFromElement,
} from "./coordinateMarkup";

import "./AILogPanel.scss";

import type { AIProgressStep, AILogEntry, AILogState } from "./types";

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Render markdown content with interactive coordinate highlighting.
 * Coordinates like (123, 456) or regions become hoverable and highlight on canvas.
 */
const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const coordContext = useCoordinateHighlightOptional();

  // Parse markdown and wrap coordinates in interactive spans
  const html = useMemo(() => {
    try {
      const parsed = marked.parse(content) as string;
      return wrapCoordinatesInHtml(parsed);
    } catch {
      return content;
    }
  }, [content]);

  // Handle mouse events on coordinate/region spans via event delegation
  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const coord = parseCoordinateFromElement(target);
      if (coord) {
        coordContext?.setHighlightedCoord(coord);
      }
    },
    [coordContext],
  );

  const handleMouseOut = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const relatedTarget = e.relatedTarget as HTMLElement | null;

      // Only clear if we're leaving a highlight element
      if (
        target.classList.contains("coord-highlight") ||
        target.classList.contains("region-highlight")
      ) {
        // Check if we're moving to another highlight element - if so, don't clear yet
        if (
          relatedTarget?.classList.contains("coord-highlight") ||
          relatedTarget?.classList.contains("region-highlight")
        ) {
          return;
        }
        coordContext?.setHighlightedCoord(null);
      }
    },
    [coordContext],
  );

  // Fallback: clear when mouse leaves the entire markdown content area
  const handleMouseLeave = useCallback(() => {
    coordContext?.setHighlightedCoord(null);
  }, [coordContext]);

  return (
    <div
      className="ai-log-entry__markdown"
      dangerouslySetInnerHTML={{ __html: html }}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onMouseLeave={handleMouseLeave}
    />
  );
};

/**
 * Maps progress steps to display metadata (icon, label, CSS class)
 */
const STEP_CONFIG: Record<
  AIProgressStep,
  { icon: React.ReactNode; label: string; className: string }
> = {
  idle: { icon: null, label: "Idle", className: "step-idle" },
  planning: { icon: brainIcon, label: "Planning", className: "step-planning" },
  calling_api: {
    icon: boltIcon,
    label: "Generating",
    className: "step-calling",
  },
  processing: {
    icon: clockIcon,
    label: "Processing",
    className: "step-processing",
  },
  self_checking: {
    icon: tablerCheckIcon,
    label: "Evaluating",
    className: "step-checking",
  },
  iterating: {
    icon: clockIcon,
    label: "Refining",
    className: "step-iterating",
  },
  complete: {
    icon: tablerCheckIcon,
    label: "Complete",
    className: "step-complete",
  },
  error: {
    icon: alertTriangleIcon,
    label: "Error",
    className: "step-error",
  },
};

/**
 * Format timestamp to readable time
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

/**
 * Format duration in a human-readable format
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
};

/**
 * Single log entry component
 */
const LogEntryComponent: React.FC<{
  entry: AILogEntry;
  isLatest: boolean;
}> = ({ entry, isLatest }) => {
  const [expanded, setExpanded] = useState(isLatest);
  const stepConfig = STEP_CONFIG[entry.step];
  const hasThinking =
    entry.thinkingText && entry.thinkingText.trim().length > 0;
  const hasPrompt = entry.prompt && entry.prompt.trim().length > 0;
  const hasRawOutput = entry.rawOutput && entry.rawOutput.trim().length > 0;
  const hasInputImages = entry.inputImages && entry.inputImages.length > 0;
  const hasExpandableContent =
    hasThinking || hasPrompt || hasRawOutput || hasInputImages;

  // Auto-expand latest entry when it gets content
  useEffect(() => {
    if (isLatest && hasExpandableContent) {
      setExpanded(true);
    }
  }, [isLatest, hasExpandableContent]);

  return (
    <div className="ai-log-entry">
      {/* Entry header */}
      <div
        className={`ai-log-entry__header ${
          hasExpandableContent ? "clickable" : ""
        }`}
        onClick={() => hasExpandableContent && setExpanded(!expanded)}
      >
        <span className="ai-log-entry__time">
          {formatTime(entry.timestamp)}
        </span>
        <span className={`ai-log-entry__icon ${stepConfig.className}`}>
          {stepConfig.icon}
        </span>
        <span className={`ai-log-entry__label ${stepConfig.className}`}>
          {stepConfig.label}
        </span>
        {entry.iteration && entry.iteration.max > 0 && (
          <span className="ai-log-entry__iteration">
            [{entry.iteration.current}/{entry.iteration.max}]
          </span>
        )}
        {entry.durationMs && (
          <span className="ai-log-entry__duration">
            {formatDuration(entry.durationMs)}
          </span>
        )}
        {hasExpandableContent && (
          <span className="ai-log-entry__expand">
            {expanded ? collapseUpIcon : collapseDownIcon}
          </span>
        )}
      </div>

      {/* Message */}
      {entry.message && (
        <div className="ai-log-entry__message">{entry.message}</div>
      )}

      {/* Error details */}
      {entry.error && (
        <div className="ai-log-entry__error">
          <div className="ai-log-entry__error-message">
            {entry.error.message}
          </div>
          {entry.error.details && (
            <div className="ai-log-entry__error-details">
              {entry.error.details}
            </div>
          )}
        </div>
      )}

      {/* Prompt (collapsible) */}
      {hasPrompt && expanded && (
        <div className="ai-log-entry__section ai-log-entry__section--prompt">
          <div className="ai-log-entry__section-header">PROMPT SENT TO AI:</div>
          <MarkdownContent content={entry.prompt!} />
        </div>
      )}

      {/* Input Images (collapsible) */}
      {hasInputImages && expanded && (
        <div className="ai-log-entry__section ai-log-entry__section--images">
          <div className="ai-log-entry__section-header">INPUT IMAGES:</div>
          <div className="ai-log-entry__images">
            {entry.inputImages!.map((img, idx) => (
              <div key={idx} className="ai-log-entry__image-item">
                <div className="ai-log-entry__image-label">{img.label}:</div>
                <img
                  src={img.dataUrl}
                  alt={img.label}
                  className="ai-log-entry__image"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thinking text (collapsible) */}
      {hasThinking && expanded && (
        <div className="ai-log-entry__section ai-log-entry__section--thinking">
          <div className="ai-log-entry__section-header">AI THINKING:</div>
          <MarkdownContent content={entry.thinkingText!} />
        </div>
      )}

      {/* Raw Output (collapsible) */}
      {hasRawOutput && expanded && (
        <div className="ai-log-entry__section ai-log-entry__section--output">
          <div className="ai-log-entry__section-header">AI OUTPUT:</div>
          <MarkdownContent content={entry.rawOutput!} />
        </div>
      )}

      {/* Generated image preview */}
      {entry.iterationImage && expanded && (
        <div className="ai-log-entry__section ai-log-entry__section--result">
          <div className="ai-log-entry__section-header">GENERATED IMAGE:</div>
          <img
            src={entry.iterationImage}
            alt="Generated iteration"
            className="ai-log-entry__result-image"
          />
        </div>
      )}
    </div>
  );
};

/**
 * AILogPanel displays a console-style log of all AI operations
 * Designed for the Excalidraw sidebar
 */
export const AILogPanel: React.FC = () => {
  const { theme } = useUIAppState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Subscribe to aiLogService
  const [log, setLog] = useState<AILogEntry[]>([]);
  const [state, setState] = useState<AILogState>({
    step: "idle",
    message: "",
    elapsedMs: 0,
    isActive: false,
  });

  useEffect(() => {
    const unsubLog = aiLogService.subscribeToLog(setLog);
    const unsubState = aiLogService.subscribeToState(setState);
    return () => {
      unsubLog();
      unsubState();
    };
  }, []);

  // Auto-scroll to bottom when new entries are added (if enabled)
  useEffect(() => {
    if (scrollRef.current && autoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log, autoScroll]);

  // Detect when user manually scrolls away from bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    // If user scrolls away from bottom, disable auto-scroll
    // If user scrolls back to bottom, re-enable it
    setAutoScroll(isAtBottom);
  }, []);

  // Toggle auto-scroll manually
  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => {
      const next = !prev;
      // If enabling, scroll to bottom immediately
      if (next && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      return next;
    });
  }, []);

  // Manual scroll to bottom
  const handleScrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Clear log
  const handleClearLog = useCallback((): void => {
    aiLogService.clearLog();
  }, []);

  // Copy log content to clipboard
  const handleCopyLog = useCallback(() => {
    const logText = log
      .map((entry) => {
        const lines: string[] = [];
        const stepConfig = STEP_CONFIG[entry.step];

        lines.push(
          `[${formatTime(entry.timestamp)}] ${stepConfig.label}${
            entry.iteration
              ? ` [${entry.iteration.current}/${entry.iteration.max}]`
              : ""
          }${entry.durationMs ? ` (${formatDuration(entry.durationMs)})` : ""}`,
        );

        if (entry.message) {
          lines.push(`  ${entry.message}`);
        }

        if (entry.error) {
          lines.push(`  ERROR: ${entry.error.message}`);
          if (entry.error.details) {
            lines.push(`  ${entry.error.details}`);
          }
        }

        if (entry.prompt) {
          lines.push("");
          lines.push("--- PROMPT ---");
          lines.push(entry.prompt);
        }

        if (entry.thinkingText) {
          lines.push("");
          lines.push("--- AI THINKING ---");
          lines.push(entry.thinkingText);
        }

        if (entry.rawOutput) {
          lines.push("");
          lines.push("--- AI OUTPUT ---");
          lines.push(entry.rawOutput);
        }

        return lines.join("\n");
      })
      .join("\n\n---\n\n");

    navigator.clipboard
      .writeText(logText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy log:", err);
      });
  }, [log]);

  // Copy raw log content to clipboard (including base64 data)
  const handleCopyRawLog = useCallback(() => {
    const logText = log
      .map((entry) => {
        const lines: string[] = [];
        const stepConfig = STEP_CONFIG[entry.step];

        lines.push(
          `[${formatTime(entry.timestamp)}] ${stepConfig.label}${
            entry.iteration
              ? ` [${entry.iteration.current}/${entry.iteration.max}]`
              : ""
          }${entry.durationMs ? ` (${formatDuration(entry.durationMs)})` : ""}`,
        );

        if (entry.message) {
          lines.push(`  ${entry.message}`);
        }

        if (entry.error) {
          lines.push(`  ERROR: ${entry.error.message}`);
          if (entry.error.details) {
            lines.push(`  ${entry.error.details}`);
          }
        }

        // Include everything without stripping
        if (entry.prompt) {
          lines.push("");
          lines.push("--- PROMPT SENT TO AI ---");
          lines.push(entry.prompt);
        }

        if (entry.thinkingText) {
          lines.push("");
          lines.push("--- AI THINKING ---");
          lines.push(entry.thinkingText);
        }

        if (entry.rawOutput) {
          lines.push("");
          lines.push("--- RAW AI OUTPUT ---");
          lines.push(entry.rawOutput);
        }

        // Include iteration image data if present
        if (entry.iterationImage) {
          lines.push("");
          lines.push(`--- GENERATED IMAGE DATA ---`);
          lines.push(entry.iterationImage);
        }

        return lines.join("\n");
      })
      .join("\n\n---\n\n");

    navigator.clipboard
      .writeText(logText)
      .then(() => {
        setCopiedRaw(true);
        setTimeout(() => setCopiedRaw(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy raw log:", err);
      });
  }, [log]);

  return (
    <div className="ai-log-panel" data-theme={theme}>
      {/* Header */}
      <div className="ai-log-panel__header">
        <div className="ai-log-panel__status">
          <div
            className={`ai-log-panel__indicator ${
              state.isActive ? "active" : ""
            }`}
          />
          <span className="ai-log-panel__title">AI Log</span>
          {state.isActive && (
            <span className="ai-log-panel__elapsed">
              {formatDuration(state.elapsedMs)}
            </span>
          )}
        </div>
        <div className="ai-log-panel__actions">
          {log.length > 0 && (
            <>
              <button
                onClick={handleCopyLog}
                className="ai-log-panel__button"
                title={copied ? "Copied!" : "Copy log"}
              >
                {copied ? tablerCheckIcon : copyIcon}
              </button>
              <button
                onClick={handleCopyRawLog}
                className="ai-log-panel__button"
                title={
                  copiedRaw ? "Copied raw data!" : "Copy raw log with base64"
                }
              >
                {copiedRaw ? tablerCheckIcon : fileCodeIcon}
              </button>
              <button
                onClick={handleClearLog}
                className="ai-log-panel__button"
                title="Clear log"
              >
                {TrashIcon}
              </button>
              <div className="ai-log-panel__separator" />
              <button
                onClick={toggleAutoScroll}
                className={`ai-log-panel__button ai-log-panel__button--toggle ${
                  autoScroll ? "active" : ""
                }`}
                title={
                  autoScroll
                    ? "Auto-scroll ON (click to disable)"
                    : "Auto-scroll OFF (click to enable)"
                }
              >
                {listEndIcon}
              </button>
              <button
                onClick={handleScrollToBottom}
                className="ai-log-panel__button"
                title="Scroll to bottom"
              >
                {arrowDownToLineIcon}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="ai-log-panel__content"
        onScroll={handleScroll}
      >
        {log.length === 0 ? (
          <div className="ai-log-panel__empty">No AI activity yet</div>
        ) : (
          log.map((entry, index) => (
            <LogEntryComponent
              key={entry.id}
              entry={entry}
              isLatest={index === log.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default AILogPanel;
