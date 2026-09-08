import React, { useState, useCallback } from "react";

import { useTunnels } from "@excalidraw/excalidraw/context/tunnels";
import {
  cropIcon,
  RectangleIcon,
  LassoIcon,
  polygonIcon,
} from "@excalidraw/excalidraw/components/icons";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { CaptureRectangleOverlay } from "./CaptureRectangleOverlay";
import { CaptureLassoOverlay } from "./CaptureLassoOverlay";
import { CapturePolygonOverlay } from "./CapturePolygonOverlay";

interface CaptureToolButtonProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

type CaptureMode = "rectangle" | "lasso" | "polygon";

/** Get active/inactive styles for mode buttons */
const getModeButtonStyle = (isActive: boolean): React.CSSProperties => ({
  color: isActive ? "var(--color-primary)" : undefined,
  backgroundColor: isActive ? "var(--color-primary-light)" : undefined,
});

/**
 * Capture tool button for the toolbar.
 * When active, allows user to draw a rectangle or lasso to capture as an image.
 */
export const CaptureToolButton: React.FC<CaptureToolButtonProps> = ({
  excalidrawAPI,
}) => {
  const [isCaptureMode, setIsCaptureMode] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("rectangle");

  const handleToggle = useCallback(() => {
    setIsCaptureMode((prev) => !prev);
  }, []);

  const handleCaptureComplete = useCallback(() => {
    setIsCaptureMode(false);
  }, []);

  return (
    <div style={{ position: "relative", zIndex: isCaptureMode ? 1000 : undefined }}>
      <button
        type="button"
        onClick={handleToggle}
        title={isCaptureMode ? "Cancel capture" : "Capture region"}
        className="ToolIcon_type_button"
        aria-label="Capture region"
        data-testid="capture-tool-button"
        style={{
          position: "relative",
          zIndex: isCaptureMode ? 1001 : undefined,
          color: isCaptureMode ? "var(--color-primary)" : undefined,
          backgroundColor: isCaptureMode
            ? "var(--color-primary-light)"
            : undefined,
        }}
      >
        <div className="ToolIcon__icon" aria-hidden="true">
          {cropIcon}
        </div>
      </button>

      {/* Mode switcher popover */}
      {isCaptureMode && (
        <div
          data-capture-mode-switcher
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "4px",
            display: "flex",
            gap: "2px",
            backgroundColor: "var(--island-bg-color)",
            padding: "4px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1000,
          }}
        >
          <button
            type="button"
            className="ToolIcon_type_button"
            onClick={() => setCaptureMode("rectangle")}
            title="Rectangle selection"
            style={getModeButtonStyle(captureMode === "rectangle")}
          >
            <div className="ToolIcon__icon" aria-hidden="true">
              {RectangleIcon}
            </div>
          </button>
          <button
            type="button"
            className="ToolIcon_type_button"
            onClick={() => setCaptureMode("lasso")}
            title="Lasso selection"
            style={getModeButtonStyle(captureMode === "lasso")}
          >
            <div className="ToolIcon__icon" aria-hidden="true">
              {LassoIcon}
            </div>
          </button>
          <button
            type="button"
            className="ToolIcon_type_button"
            onClick={() => setCaptureMode("polygon")}
            title="Polygon selection"
            style={getModeButtonStyle(captureMode === "polygon")}
          >
            <div className="ToolIcon__icon" aria-hidden="true">
              {polygonIcon}
            </div>
          </button>
        </div>
      )}

      {/* Render appropriate overlay based on mode */}
      {captureMode === "rectangle" && (
        <CaptureRectangleOverlay
          isActive={isCaptureMode}
          excalidrawAPI={excalidrawAPI}
          onCaptureComplete={handleCaptureComplete}
        />
      )}
      {captureMode === "lasso" && (
        <CaptureLassoOverlay
          isActive={isCaptureMode}
          excalidrawAPI={excalidrawAPI}
          onCaptureComplete={handleCaptureComplete}
        />
      )}
      {captureMode === "polygon" && (
        <CapturePolygonOverlay
          isActive={isCaptureMode}
          excalidrawAPI={excalidrawAPI}
          onCaptureComplete={handleCaptureComplete}
        />
      )}
    </div>
  );
};

/**
 * Wrapper component that injects CaptureToolButton into the toolbar via tunnel.
 */
export const CaptureToolbarContent: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const { ExtraToolbarTunnel } = useTunnels();

  return (
    <ExtraToolbarTunnel.In>
      <CaptureToolButton excalidrawAPI={excalidrawAPI} />
    </ExtraToolbarTunnel.In>
  );
};

export default CaptureToolButton;
