import { Input } from "@/components/ui/input";
import { forwardRef, useEffect, useState } from "react";

interface CurrencyInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: number;
  onChange?: (value: number) => void;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrency = (formatted: string): number => {
  // Remove all non-digit characters except the last two digits (decimal places)
  const cleaned = formatted.replace(/\D/g, "");
  if (cleaned.length === 0) return 0;
  
  // Convert to number and divide by 100 to get decimal value
  const num = parseInt(cleaned, 10) / 100;
  return num;
};

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value = 0, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(formatCurrency(value));

    useEffect(() => {
      setDisplayValue(formatCurrency(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseCurrency(e.target.value);
      setDisplayValue(formatCurrency(newValue));
      onChange?.(newValue);
    };

    return (
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
