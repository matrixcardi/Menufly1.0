import { Input } from "@/components/ui/input";
import { forwardRef, useEffect, useState } from "react";

interface PhoneInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
}

const formatPhone = (value: string): string => {
  // Remove all non-digit characters
  const cleaned = value.replace(/\D/g, "");
  
  // Limit to 11 digits (2 DDD + 9 digits)
  const limited = cleaned.slice(0, 11);
  
  if (limited.length === 0) return "";
  
  // Apply mask (DD) 9 DDDD-DDDD or (DD) DDDD-DDDD for 10 digits
  let formatted = "";
  
  if (limited.length > 0) {
    formatted += `(${limited.slice(0, 2)}`;
  }
  if (limited.length > 2) {
    // For 11 digits: (XX) 9 XXXX-XXXX
    // For 10 digits: (XX) XXXX-XXXX
    if (limited.length === 11) {
      formatted += `) ${limited.slice(2, 3)}`;
    } else {
      formatted += `) ${limited.slice(2, 6)}`;
    }
  }
  if (limited.length > 3 && limited.length < 11) {
    formatted += `-${limited.slice(6)}`;
  } else if (limited.length > 7) {
    formatted += `-${limited.slice(7)}`;
  }
  
  return formatted;
};

const parsePhone = (formatted: string): string => {
  // Remove all non-digit characters
  return formatted.replace(/\D/g, "");
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(formatPhone(value));

    useEffect(() => {
      setDisplayValue(formatPhone(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = parsePhone(e.target.value);
      setDisplayValue(formatPhone(cleaned));
      onChange?.(cleaned);
    };

    return (
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        maxLength={15} // (DD) 9 9999-9999 = 15 characters
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
