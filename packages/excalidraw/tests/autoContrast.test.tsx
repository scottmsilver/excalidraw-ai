import React from "react";
import { MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";
import { newCalloutElement } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { actionChangeStrokeColor } from "../actions/actionProperties";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";

const { h } = window;
describe("shared Auto contrast controls", () => {
  it("creates an Auto shape's label with the owner's opacity rather than a stale tool opacity", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    API.setAppState({ currentItemOpacity: 20 });
    new Pointer("mouse").doubleClickAt(200, 150);
    const editor = await getTextEditor();
    expect(h.elements.find((element) => element.type === "text")?.opacity).toBe(
      100,
    );
    Keyboard.exitTextEditor(editor);
  });
  it("changes a manual shape's fill opacity without enabling Auto or changing its pattern", () => {
    const element = API.createElement({
      type: "rectangle",
      fillStyle: "hachure",
      backgroundColor: "#ff0000",
    });
    API.setElements([element]);
    API.setSelectedElements([element]);
    fireEvent.change(screen.getByLabelText("Fill opacity"), {
      target: { value: "25" },
    });
    expect(h.elements[0]).not.toHaveProperty("autoContrast");
    expect(h.elements[0]).toMatchObject({
      fillOpacity: 25,
      fillStyle: "hachure",
      opacity: 100,
    });
  });
  beforeEach(async () => {
    unmountComponent();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({ width: MQ_MIN_WIDTH_DESKTOP, height: 768 });
  });

  it("defaults callouts on and provides a single master switch", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    expect(screen.getByLabelText("Auto contrast")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    expect(screen.getByLabelText("Auto foreground")).not.toBeChecked();
    expect(screen.getByLabelText("Auto background")).not.toBeChecked();
  });

  it.each([
    "rectangle",
    "ellipse",
    "diamond",
    "text",
    "line",
    "arrow",
  ] as const)("makes %s opt-in and only offers applicable fields", (type) => {
    const element = API.createElement({
      type,
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([element]);
    API.setSelectedElements([element]);
    expect(screen.getByLabelText("Auto contrast")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    expect(screen.getByLabelText("Auto foreground")).toBeChecked();
    if (["text", "line", "arrow"].includes(type)) {
      expect(screen.queryByLabelText("Auto background")).toBeNull();
    } else {
      expect(screen.getByLabelText("Auto background")).toBeChecked();
    }
  });

  it("keeps other fields Auto after a manual color and supports undo", () => {
    const element = API.createElement({ type: "rectangle" });
    API.setElements([element]);
    API.setSelectedElements([element]);
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    act(() =>
      h.app.actionManager.executeAction(actionChangeStrokeColor, "api", {
        currentItemStrokeColor: "#ff0000",
      }),
    );
    expect(screen.getByLabelText("Auto foreground")).not.toBeChecked();
    expect(screen.getByLabelText("Auto background")).toBeChecked();
    Keyboard.undo();
    expect(screen.getByLabelText("Auto foreground")).toBeChecked();
  });

  it("applies the switch to supported members of a mixed selection only", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const text = API.createElement({ type: "text", x: 300 });
    const unsupported = API.createElement({ type: "freedraw", x: 500 });
    API.setElements([rectangle, text, unsupported]);
    API.setSelectedElements([rectangle, text, unsupported]);
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    expect(h.elements[0]).toHaveProperty("autoContrast.foreground", true);
    expect(h.elements[1]).toHaveProperty("autoContrast.foreground", true);
    expect(h.elements[2]).not.toHaveProperty("autoContrast");
  });

  it("routes bound-label controls and manual text color to the contrast owner", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      id: "owner",
      boundElements: [{ id: "label", type: "text" }],
    });
    const text = API.createElement({
      type: "text",
      id: "label",
      containerId: "owner",
    });
    API.setElements([rectangle, text]);
    API.setSelectedElements([text]);
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    expect(h.elements[0]).toHaveProperty("autoContrast.foreground", true);
    expect(h.elements[1]).not.toHaveProperty("autoContrast");
    act(() =>
      h.app.actionManager.executeAction(actionChangeStrokeColor, "api", {
        currentItemStrokeColor: "#ff0000",
      }),
    );
    expect(h.elements[0]).toHaveProperty("autoContrast.foreground", false);
    expect(h.elements[0].strokeColor).toBe("#ff0000");
  });
});
