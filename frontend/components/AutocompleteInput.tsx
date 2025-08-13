"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils";

interface AutocompleteOption {
  value: string;
  label: string;
  keywords?: string[];
  [key: string]: unknown; // Allow additional properties
}

interface AutocompleteInputProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  onOptionSelect?: (option: AutocompleteOption) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  renderOption?: (option: AutocompleteOption) => React.ReactNode;
  filterOptions?: (options: AutocompleteOption[], searchValue: string) => AutocompleteOption[];
}

export default function AutocompleteInput({
  options,
  value,
  onChange,
  onOptionSelect,
  placeholder = "Search...",
  className,
  disabled = false,
  renderOption,
  filterOptions,
}: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastInteractionWasMouse = useRef(false);

  // Default filter function
  const defaultFilterOptions = (options: AutocompleteOption[], searchValue: string) => {
    if (!searchValue.trim()) return options;

    const searchLower = searchValue.toLowerCase();
    return options.filter((option) => {
      // Search in label
      if (option.label.toLowerCase().includes(searchLower)) return true;

      // Search in keywords
      if (option.keywords?.some((keyword) => keyword.toLowerCase().includes(searchLower))) return true;

      // Search in additional properties (excluding value, label, keywords)
      const additionalProps = Object.entries(option).filter(([key]) => !["value", "label", "keywords"].includes(key));

      return additionalProps.some(([_, propValue]) => String(propValue).toLowerCase().includes(searchLower));
    });
  };

  const filteredOptions = filterOptions ? filterOptions(options, value) : defaultFilterOptions(options, value);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
    setActiveSuggestionIndex(-1);
  };

  const handleMouseDown = () => {
    lastInteractionWasMouse.current = true;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only open if user clicked or tabbed in (not on mount/autoFocus)
    if (lastInteractionWasMouse.current || e.nativeEvent instanceof KeyboardEvent) {
      setShowSuggestions(true);
    }
    lastInteractionWasMouse.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
      e.preventDefault();
      if (activeSuggestionIndex < filteredOptions.length) {
        const option = filteredOptions[activeSuggestionIndex];
        if (option) {
          onOptionSelect?.(option);
          setShowSuggestions(false);
          setActiveSuggestionIndex(-1);
        }
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }, 200);
  };

  const defaultRenderOption = (option: AutocompleteOption) => (
    <div>
      <div className="font-medium">{option.label}</div>
    </div>
  );

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onMouseDown={handleMouseDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredOptions.length > 0 ? (
        <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filteredOptions.map((option, index) => (
            <div
              key={option.value}
              className={cn(
                "cursor-pointer px-3 py-2 hover:bg-gray-50",
                index === activeSuggestionIndex ? "bg-gray-50" : "",
              )}
              onClick={() => {
                onOptionSelect?.(option);
                setShowSuggestions(false);
                setActiveSuggestionIndex(-1);
              }}
            >
              {renderOption ? renderOption(option) : defaultRenderOption(option)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
