import React from "react";

import { MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";
import { getNonDeletedElements, newCalloutElement } from "@excalidraw/element";
import { exportToSvg } from "@excalidraw/utils";

import { Excalidraw } from "../index";
import {
  actionChangeBackgroundColor,
  actionChangeStrokeColor,
} from "../actions/actionProperties";
import { actionChangeViewBackgroundColor } from "../actions/actionCanvas";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";

const { h } = window;
describe("Auto callout integration", () => {
  beforeEach(async () => {
    unmountComponent();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({ width: MQ_MIN_WIDTH_DESKTOP, height: 768 });
    const callout = newCalloutElement({
      type: "callout",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
  });

  it("shows independent Auto choices and locks only the field changed manually", () => {
    expect(screen.getByLabelText("Auto foreground")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Auto background")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    act(() =>
      h.app.actionManager.executeAction(actionChangeStrokeColor, "api", {
        currentItemStrokeColor: "#ff0000",
      }),
    );
    expect(h.elements[0]).toMatchObject({
      calloutAutoStyle: { foreground: false, background: true, opacity: true },
      strokeColor: "#ff0000",
    });
    act(() =>
      h.app.actionManager.executeAction(actionChangeBackgroundColor, "api", {
        currentItemBackgroundColor: "#eeeeee",
        viewBackgroundColor: h.state.viewBackgroundColor,
      }),
    );
    expect(h.elements[0]).toMatchObject({
      calloutAutoStyle: { foreground: false, background: false, opacity: true },
    });
    fireEvent.change(screen.getByLabelText("Callout background opacity"), {
      target: { value: "25" },
    });
    expect(h.elements[0]).toMatchObject({
      calloutAutoStyle: {
        foreground: false,
        background: false,
        opacity: false,
      },
      calloutBackgroundOpacity: 25,
      opacity: 100,
    });
  });

  it("keeps displayed colors when turning Auto off in dark mode", () => {
    API.setAppState({ theme: "dark" });
    const before =
      h.elements[0].type === "callout" && h.elements[0].calloutResolvedStyle!;
    fireEvent.click(screen.getByLabelText("Manual foreground"));
    fireEvent.click(screen.getByLabelText("Manual background"));
    expect(h.elements[0]).toMatchObject({
      calloutResolvedStyle: {
        foreground: before && before.foreground,
        background: before && before.background,
      },
    });
  });

  it("creates opaque bound text when an Auto callout follows a faded shape", async () => {
    API.setAppState({ currentItemOpacity: 20 });
    new Pointer("mouse").doubleClickAt(200, 150);
    const editor = await getTextEditor();
    expect(h.elements.find((element) => element.type === "text")?.opacity).toBe(
      100,
    );
    Keyboard.exitTextEditor(editor);
  });

  it("recomputes derived appearance on a single background undo and redo", () => {
    const read = vi
      .spyOn(CanvasRenderingContext2D.prototype, "getImageData")
      .mockImplementation(
        (_x, _y, width, height) =>
          new ImageData(
            new Uint8ClampedArray(width * height * 4).fill(
              h.state.viewBackgroundColor === "#000000" ? 0 : 255,
            ),
            width,
            height,
          ),
      );
    try {
      act(() =>
        h.app.actionManager.executeAction(
          actionChangeViewBackgroundColor,
          "api",
          { viewBackgroundColor: "#ffffff" },
        ),
      );
      act(() =>
        h.app.actionManager.executeAction(
          actionChangeViewBackgroundColor,
          "api",
          { viewBackgroundColor: "#000000" },
        ),
      );
      expect(h.elements[0]).toMatchObject({
        calloutResolvedStyle: { foreground: "#ffffff" },
      });
      Keyboard.undo();
      expect(h.state.viewBackgroundColor).toBe("#ffffff");
      expect(h.elements[0]).toMatchObject({
        calloutResolvedStyle: { foreground: "#000000" },
      });
      Keyboard.redo();
      expect(h.state.viewBackgroundColor).toBe("#000000");
      expect(h.elements[0]).toMatchObject({
        calloutResolvedStyle: { foreground: "#ffffff" },
      });
    } finally {
      read.mockRestore();
    }
  });

  it("resolves SVG exports on clones without changing scene versions or stored appearance", async () => {
    const before = JSON.stringify(h.elements);
    const svg = await exportToSvg({
      elements: getNonDeletedElements(h.elements),
      appState: { ...h.state, exportWithDarkMode: true },
      files: {},
      skipInliningFonts: true,
    });
    expect(svg.querySelector(`[data-id="${h.elements[0].id}"]`)).not.toBeNull();
    expect(JSON.stringify(h.elements)).toBe(before);
  });
});
