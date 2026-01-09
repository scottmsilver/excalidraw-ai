import React, { useMemo, useState, useEffect, useRef } from "react";

import "./ThinkingOverlay.scss";

export type ThinkingStatus = "idle" | "thinking" | "accepted" | "rejected";

interface ThinkingOverlayProps {
  /** Current status of the thinking process */
  status: ThinkingStatus;
  /** Whether to show the rainbow border animation */
  showBorder?: boolean;
  /** Semi-transparent interim proposal image (base64 data URL) */
  image?: string | null;
}

/**
 * ThinkingOverlay Component
 *
 * Displays an animated gradient border and shimmer particles when the AI is processing.
 * Covers the entire excalidraw canvas area.
 *
 * Features:
 * - Rotating warm red/orange glow border
 * - Shimmer particles floating across the canvas
 * - Initial flash wash when thinking starts
 * - Green/red flash for accepted/rejected states
 */
export const ThinkingOverlay: React.FC<ThinkingOverlayProps> = ({
  status,
  showBorder = true,
  image = null,
}) => {
  // Track flash animation state
  const [showFlash, setShowFlash] = useState(false);
  const prevStatusRef = useRef<ThinkingStatus>("idle");

  // Trigger flash when transitioning to thinking
  useEffect(() => {
    if (status === "thinking" && prevStatusRef.current !== "thinking") {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 700);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = status;
  }, [status]);

  // Generate shimmer particles with randomized positions
  const particles = useMemo(() => {
    if (status !== "thinking") {
      return [];
    }

    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      animationDelay: Math.random() * 2,
      animationDuration: 1.5 + Math.random() * 1.5,
      size: 4 + Math.random() * 6,
    }));
  }, [status]);

  // Don't render if status is idle
  if (status === "idle") {
    return null;
  }

  // Determine the border class based on status
  let borderClass = "thinking-overlay__border";
  if (status === "thinking" && showBorder) {
    borderClass += " thinking-overlay__border--thinking";
  } else if (status === "accepted") {
    borderClass += " thinking-overlay__border--accepted";
  } else if (status === "rejected") {
    borderClass += " thinking-overlay__border--rejected";
  }

  const shouldRenderBorder = status !== "thinking" || showBorder;

  // Wrapper class with flash state
  const wrapperClass = `thinking-overlay${
    showFlash && showBorder ? " thinking-overlay--flash" : ""
  }`;

  return (
    <div className={wrapperClass}>
      {/* Semi-transparent interim proposal image */}
      {image && (
        <img
          src={image}
          alt="AI iteration preview"
          className="thinking-overlay__image"
        />
      )}

      {/* Initial flash wash effect */}
      <div className="thinking-overlay__flash" />

      {/* Animated gradient border with rotating glow */}
      {shouldRenderBorder && <div className={borderClass} />}

      {/* Shimmer particles (only during thinking) */}
      {status === "thinking" && (
        <div className="thinking-overlay__particles">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="thinking-overlay__particle"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: `${particle.animationDelay}s`,
                animationDuration: `${particle.animationDuration}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ThinkingOverlay;
