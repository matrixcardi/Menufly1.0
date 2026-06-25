import { Input } from "@/components/ui/input";
import { forwardRef, useEffect, useState } from "react";

interface PhoneInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
}

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  // 11 dígitos (celular): (XX) XXXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const parsePhone = (formatted: string): string => {
  return formatted.replace(/\D/g, "");
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(formatPhone(value));

    useEffect(() => {
      setDisplayValue(formatPhone(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newRaw = e.target.value;
      let digits = parsePhone(newRaw);
      const prevDigits = parsePhone(displayValue);

      // Se o usuário apagou mas a contagem de dígitos não mudou,
      // ele apagou um caractere da máscara — remove o dígito anterior também
      if (newRaw.length < displayValue.length && digits.length === prevDigits.length) {
        digits = digits.slice(0, -1);
      }

      const formatted = formatPhone(digits);
      setDisplayValue(formatted);
      onChange?.(digits);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        maxLength={15} // (XX) XXXXX-XXXX = 15 chars
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
