import React, { useState, useCallback } from "react";

import { useTunnels } from "@excalidraw/excalidraw/context/tunnels";
import { cropIcon } from "@excalidraw/excalidraw/components/icons";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { CaptureRectangleOverlay } from "./CaptureRectangleOverlay";

interface CaptureToolButtonProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

/**
 * Capture tool button for the toolbar.
 * When active, allows user to draw a rectangle to capture as an image.
 */
export const CaptureToolButton: React.FC<CaptureToolButtonProps> = ({
  excalidrawAPI,
}) => {
  const [isCaptureMode, setIsCaptureMode] = useState(false);

  const handleToggle = useCallback(() => {
    setIsCaptureMode((prev) => !prev);
  }, []);

  const handleCaptureComplete = useCallback(() => {
    setIsCaptureMode(false);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        title={isCaptureMode ? "Cancel capture" : "Capture region"}
        className="ToolIcon_type_button"
        aria-label="Capture region"
        data-testid="capture-tool-button"
        style={{
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
      <CaptureRectangleOverlay
        isActive={isCaptureMode}
        excalidrawAPI={excalidrawAPI}
        onCaptureComplete={handleCaptureComplete}
      />
    </>
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
