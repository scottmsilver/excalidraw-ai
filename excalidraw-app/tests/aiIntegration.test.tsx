import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import { Excalidraw } from "@excalidraw/excalidraw";
import { useTunnels } from "@excalidraw/excalidraw/context/tunnels";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  CoordinateHighlightProvider,
  useCoordinateHighlight,
} from "../ai/CoordinateHighlightContext";
import { CoordinateHighlightOverlay } from "../ai/CoordinateHighlightOverlay";
import { AILogPanel } from "../ai/AILogPanel";
import { aiLogService } from "../ai/aiLogService";
import { AppMainMenu } from "../components/AppMainMenu";
import {
  getImageProviderPreference,
  setImageProviderPreference,
} from "../../src/services/imageProviderPreference";

const MarkerTunnel = () => {
  const { AIToolbarTunnel } = useTunnels();
  const [active, setActive] = React.useState(false);
  return (
    <AIToolbarTunnel.In>
      <button
        aria-label="AI marker"
        aria-pressed={active}
        onClick={() => setActive(!active)}
      >
        AI marker
      </button>
    </AIToolbarTunnel.In>
  );
};

const HighlightControls = () => {
  const { setHighlightedCoord, setExportBounds } = useCoordinateHighlight();
  return (
    <button
      onClick={() => {
        setExportBounds({ minX: -200, minY: 50, exportPadding: 10 });
        setHighlightedCoord({ type: "point", x: 35, y: 60 });
      }}
    >
      Highlight AI point
    </button>
  );
};

const HighlightEditor = () => {
  const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null);
  return (
    <CoordinateHighlightProvider>
      <Excalidraw onExcalidrawAPI={setApi}>
        <HighlightControls />
        <CoordinateHighlightOverlay excalidrawAPI={api} />
      </Excalidraw>
    </CoordinateHighlightProvider>
  );
};

afterEach(() => {
  unmountComponent();
  restoreOriginalGetBoundingClientRect();
  localStorage.clear();
  aiLogService.clearLog();
});

describe("AI integration with the upstream editor", () => {
  it("selects and persists OpenAI in the Preferences submenu", async () => {
    mockBoundingClientRect({ width: 1440, height: 900 });
    await render(
      <Excalidraw>
        <AppMainMenu
          onCollabDialogOpen={() => {}}
          isCollaborating={false}
          isCollabEnabled={false}
          theme="light"
          refresh={() => {}}
        />
      </Excalidraw>,
    );
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByText("Preferences"));
    const gemini = screen.getByRole("radio", { name: "Gemini" });
    const openai = screen.getByRole("radio", { name: "OpenAI (Sunburst)" });
    expect(gemini).toBeChecked();
    fireEvent.click(openai);
    expect(getImageProviderPreference()).toBe("openai");
    expect(openai).toBeChecked();
    unmountComponent();
    await render(
      <Excalidraw>
        <AppMainMenu
          onCollabDialogOpen={() => {}}
          isCollaborating={false}
          isCollabEnabled={false}
          theme="light"
          refresh={() => {}}
        />
      </Excalidraw>,
    );
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByText("Preferences"));
    expect(
      screen.getByRole("radio", { name: "OpenAI (Sunburst)" }),
    ).toBeChecked();
  });

  it("shows the missing OpenAI key message in the existing AI log UI", async () => {
    setImageProviderPreference("openai");
    mockBoundingClientRect({ width: 1440, height: 900 });
    await render(
      <Excalidraw>
        <AILogPanel />
      </Excalidraw>,
    );
    act(() => {
      aiLogService.startOperation("planning", "AI edit");
      aiLogService.endOperation("error", "OPENAI_API_KEY is not configured", {
        message: "OPENAI_API_KEY is not configured",
      });
    });
    expect(
      await screen.findAllByText("OPENAI_API_KEY is not configured"),
    ).not.toHaveLength(0);
  });

  it.each([
    { formFactor: "desktop", width: 1440, height: 900 },
    { formFactor: "phone", width: 390, height: 844 },
  ])(
    "preserves AI tunnel availability in the $formFactor layout",
    async ({ formFactor, width, height }) => {
      mockBoundingClientRect({ width, height });
      await render(
        <Excalidraw
          UIOptions={{ getFormFactor: () => formFactor as "desktop" | "phone" }}
        >
          <MarkerTunnel />
        </Excalidraw>,
      );
      act(() => window.h.app.refreshEditorInterface());
      API.setAppState({ name: "AI layout verification" });
      expect(window.h.app.editorInterface.formFactor).toBe(formFactor);
      const marker = await screen.findByRole("button", { name: "AI marker" });
      expect(
        marker.closest(
          formFactor === "phone" ? ".mobile-toolbar" : ".App-toolbar",
        ),
      ).not.toBeNull();
      fireEvent.click(marker);
      expect(marker).toHaveAttribute("aria-pressed", "true");
      expect(screen.getAllByRole("button", { name: "AI marker" })).toHaveLength(
        1,
      );
    },
  );

  it("moves an existing AI highlight when editor scroll and zoom change without new AI events", async () => {
    mockBoundingClientRect({ width: 1440, height: 900 });
    const { container } = await render(<HighlightEditor />);
    API.setAppState({ scrollX: 300, scrollY: -25 });
    fireEvent.click(screen.getByRole("button", { name: "Highlight AI point" }));
    const crosshair = container.querySelector(".coord-overlay__crosshair")!;
    expect(crosshair).toHaveStyle({ left: "125px", top: "75px" });
    API.setAppState({ scrollX: 400, scrollY: 25 });
    await waitFor(() => {
      expect(crosshair).toHaveStyle({ left: "225px", top: "125px" });
    });
    API.setAppState({ zoom: { value: getNormalizedZoom(2) } });
    await waitFor(() => {
      expect(crosshair).toHaveStyle({ left: "450px", top: "250px" });
    });
  });
});
