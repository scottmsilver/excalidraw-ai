import clsx from "clsx";

import "./Switch.scss";

export type SwitchProps = {
  name: string;
  checked: boolean;
  title?: string;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  role?: "switch";
  mixed?: boolean;
};

export const Switch = ({
  title,
  name,
  checked,
  onChange,
  disabled = false,
  label,
  description,
  role,
  mixed = false,
}: SwitchProps) => {
  return (
    <div className={clsx("Switch", { toggled: checked, disabled, mixed })}>
      <input
        name={name}
        id={name}
        title={title}
        type="checkbox"
        role={role}
        aria-label={label}
        aria-describedby={description}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(!checked)}
        onKeyDown={(event) => {
          // Keep native Space activation, but do not let the canvas consume
          // the key as its temporary hand-tool shortcut.
          if (event.key === " ") {
            event.stopPropagation();
          }
        }}
      />
    </div>
  );
};
