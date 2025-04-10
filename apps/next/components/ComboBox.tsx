import React, { useEffect, useId, useState } from "react";
import Input from "@/components/Input";

const ComboBox = ({
  options,
  value,
  onChange,
  invalid,
  help,
  ...inputProps
}: { options: { key: string; name: string }[] } & React.ComponentProps<typeof Input>) => {
  const [inputValue, setInputValue] = useState("");
  const [touched, setTouched] = useState(false);
  const id = useId();

  useEffect(() => {
    const matchedOption = options.find((option) => option.key === value);
    setInputValue(matchedOption?.name ?? "");
  }, [value, options]);

  const matchedValue = options.find((option) => option.name === inputValue)?.key;

  useEffect(() => {
    if (matchedValue) {
      onChange?.(matchedValue);
    }
  }, [matchedValue]);

  return (
    <>
      <Input
        {...inputProps}
        value={inputValue}
        onChange={setInputValue}
        list={`${id}-list`}
        invalid={invalid || (touched && !matchedValue)}
        help={touched && !matchedValue ? "Please select an option from the list." : help}
        onBlur={(e) => {
          setTouched(true);
          inputProps.onBlur?.(e);
        }}
      />
      <datalist id={`${id}-list`}>
        {options.map((option) => (
          <option key={option.key} value={option.name} />
        ))}
      </datalist>
    </>
  );
};

export default ComboBox;
