import { fireEvent, render, screen } from "@testing-library/react";

import { Switch } from "./Switch";

it("leaves Space activation to the native input so it does not toggle twice", async () => {
  const onChange = vi.fn();
  const onCanvasKeyDown = vi.fn();
  await render(
    <div onKeyDown={onCanvasKeyDown}>
      <Switch name="native-switch" checked={false} onChange={onChange} />
    </div>,
  );
  const input = screen.getByRole("checkbox");
  fireEvent.keyDown(input, { key: " " });
  expect(onChange).not.toHaveBeenCalled();
  expect(onCanvasKeyDown).not.toHaveBeenCalled();
  fireEvent.click(input);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(true);
});
