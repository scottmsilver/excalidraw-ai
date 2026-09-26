import React from "react";
import { MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";
import { newCalloutElement } from "@excalidraw/element";
import {
  getAutoContrastResolved,
  getAutoContrastFillOpacity,
} from "@excalidraw/element/autoContrast";
import { generateRoughOptions } from "@excalidraw/element/shape";

import { Excalidraw } from "../index";
import { actionChangeStrokeColor } from "../actions/actionProperties";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import {
  act,
  fireEvent,
  render,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";

const { h } = window;
describe("shared Auto contrast controls", () => {
  it("keeps palettes mounted while Auto disables them and opens settings outside layout", async () => {
    const element = API.createElement({ type: "rectangle" });
    API.setElements([element]);
    API.setSelectedElements([element]);
    const master = screen.getByRole("switch", { name: "Auto contrast" });
    const colors = screen.getByRole("group", { name: "Colors" });
    const palette = colors.querySelector("fieldset")!;
    expect(palette).toBeVisible();
    fireEvent.click(master);
    expect(palette).toBeVisible();
    expect(palette).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced color settings" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Automatic color settings" }),
    ).toBeVisible();
    expect(colors).not.toContainElement(
      screen.getByRole("switch", { name: "Auto foreground" }),
    );
    const trigger = screen.getByRole("button", {
      name: "Advanced color settings",
    });
    expect(trigger.getAttribute("aria-controls")).toBe(
      screen.getByRole("dialog", { name: "Automatic color settings" }).id,
    );
    fireEvent.keyDown(screen.getByRole("switch", { name: "Auto foreground" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Automatic color settings" }),
      ).toBeNull(),
    );
    expect(h.state.selectedElementIds[element.id]).toBe(true);
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("keeps manual fields editable in a partially automatic selection", () => {
    const element = API.createElement({ type: "rectangle" });
    API.setElements([element]);
    API.setSelectedElements([element]);
    const master = screen.getByRole("switch", { name: "Auto contrast" });
    fireEvent.click(master);
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced color settings" }),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Auto foreground" }));
    expect(master).not.toBeChecked();
    expect(master).toHaveAccessibleDescription(
      "Some settings are manual. Turn on to make all applicable settings automatic.",
    );
    const rows = screen
      .getByRole("group", { name: "Colors" })
      .querySelectorAll("fieldset");
    expect(rows[0]).not.toBeDisabled();
    expect(rows[1]).toBeDisabled();
  });
  it.each(["rectangle", "callout"] as const)(
    "restores %s manual appearance when the master is unchecked",
    (type) => {
      const element = API.createElement({
        type,
        strokeColor: "#ff0000",
        backgroundColor: "#00ff00",
        fillStyle: "hachure",
      });
      API.setElements([element]);
      API.setSelectedElements([element]);
      if (
        !(screen.getByLabelText("Auto contrast") as HTMLInputElement).checked
      ) {
        fireEvent.click(screen.getByLabelText("Auto contrast"));
      }
      const before = {
        strokeColor: h.elements[0].strokeColor,
        backgroundColor: h.elements[0].backgroundColor,
      };
      const beforeOpacity = getAutoContrastFillOpacity(h.elements[0]);
      expect(getAutoContrastResolved(h.elements[0])).toBeDefined();
      fireEvent.click(screen.getByLabelText("Auto contrast"));
      expect(h.elements[0]).toMatchObject(before);
      expect(getAutoContrastFillOpacity(h.elements[0])).toBe(beforeOpacity);
      expect(getAutoContrastResolved(h.elements[0])).toBeUndefined();
      expect(h.elements[0].fillStyle).toBe("hachure");
      expect(generateRoughOptions(h.elements[0])).toMatchObject({
        stroke: "#ff0000",
        fillStyle: "hachure",
      });
      fireEvent.click(screen.getByLabelText("Auto contrast"));
      fireEvent.click(screen.getByLabelText("Auto contrast"));
      expect(h.elements[0]).toMatchObject(before);
    },
  );
  it("shows only the master switch until Advanced is opened", () => {
    const element = API.createElement({ type: "rectangle" });
    API.setElements([element]);
    API.setSelectedElements([element]);
    expect(screen.getByLabelText("Auto contrast")).toBeVisible();
    expect(screen.queryByLabelText("Auto foreground")).toBeNull();
    expect(screen.queryByLabelText("Auto background")).toBeNull();
    expect(screen.queryByLabelText("Fill opacity")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced color settings" }),
    );
    expect(screen.getByLabelText("Auto foreground")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    expect(screen.getByLabelText("Auto foreground")).toBeChecked();
    expect(screen.getByLabelText("Auto background")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Auto foreground"));
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    expect(screen.getByLabelText("Auto foreground")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Auto contrast"));
    expect(screen.getByLabelText("Auto foreground")).not.toBeChecked();
    expect(screen.getByLabelText("Auto background")).not.toBeChecked();
    const next = API.createElement({ type: "ellipse" });
    API.setElements([next]);
    API.setSelectedElements([next]);
    expect(screen.queryByLabelText("Auto foreground")).toBeNull();
    API.setElements([element, next]);
    API.setSelectedElements([element]);
    expect(screen.queryByLabelText("Auto foreground")).toBeNull();
  });
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
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced color settings" }),
    );
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
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced color settings" }),
    );
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
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced color settings" }),
    );
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
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced color settings" }),
    );
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
    expect(
      screen
        .getByRole("group", { name: "Colors" })
        .querySelector(".auto-contrast__manual"),
    ).toBeVisible();
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
