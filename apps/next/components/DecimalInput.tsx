"use client"

import React, { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/utils"

const MAXIMUM_FRACTION_DIGITS_ALLOWED_BY_SPEC = 100

const DecimalInput = ({
  value,
  onChange,
  onBlur,
  onFocus,
  prefix,
  invalid,
  maximumFractionDigits = MAXIMUM_FRACTION_DIGITS_ALLOWED_BY_SPEC,
  minimumFractionDigits,
  className,
  ...props
}: {
  value: number | null
  onChange: (value: number | null) => void
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  prefix?: string
  invalid?: boolean
  maximumFractionDigits?: number
  minimumFractionDigits?: number
} & Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "onFocus" | "onBlur" | "inputMode" | "prefix" | "aria-invalid"
>) => {
  const [isFocused, setIsFocused] = useState(false)
  const [inputValue, setInputValue] = useState<string>("")

  const formatDisplayValue = (num: number | null) =>
    num?.toLocaleString(undefined, {
      maximumFractionDigits,
      minimumFractionDigits,
      useGrouping: false,
    }) ?? ""

  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatDisplayValue(value))
    }
  }, [value, isFocused, formatDisplayValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentInput = e.target.value

    if (currentInput === "" || currentInput === "-" || currentInput === ".") {
      setInputValue(currentInput)
      onChange(null)
      return
    }

    const sanitized = currentInput
      .replace(/[^\d.-]/gu, "")
      .replace(/(\..*)\./gu, "$1")
      .replace(/(?!^)-/gu, "")

    if (sanitized !== currentInput && currentInput !== "-" && currentInput !== ".") {
      e.target.value = sanitized
    }

    let valueToParse = sanitized
    const parts = sanitized.split(".")
    if (parts[1] && parts[1].length > maximumFractionDigits) {
      parts[1] = parts[1].slice(0, maximumFractionDigits)
      valueToParse = parts.join(".")
      e.target.value = valueToParse
    }

    const parsed = parseFloat(valueToParse)

    if (!isNaN(parsed)) {
      setInputValue(valueToParse)
      onChange(parsed)
    } else if (valueToParse === "-") {
       setInputValue(valueToParse)
       onChange(null)
    } else {
      setInputValue(formatDisplayValue(value))
      onChange(value)
    }
  }

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
    setIsFocused(false)
    setInputValue(formatDisplayValue(value))
    onBlur?.(e)
  }

  const handleFocus: React.FocusEventHandler<HTMLInputElement> = (e) => {
    setIsFocused(true)
    onFocus?.(e)
    e.target.select()
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      {prefix ? (
        <span className="pointer-events-none absolute left-3 text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <Input
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        inputMode="decimal"
        className={prefix ? "pl-7" : undefined}
        aria-invalid={invalid}
        {...props}
      />
    </div>
  )
}

export default DecimalInput
