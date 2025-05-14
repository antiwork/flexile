import { useId } from "react";

interface ColorPickerProps {
  value: string | null;
  onChange: (value: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const id = useId();

  return (
    <div className="relative size-12 overflow-hidden rounded-full border">
      <input
        id={id}
        type="color"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute -inset-1/2 size-auto cursor-pointer"
      />
    </div>
  );
}
