import { useState } from "react";
import { FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { maskCpfCnpj, validateCpfCnpj } from "@/utils/cpfCnpj";

interface CpfNotaToggleProps {
  onCpfChange: (cpfCnpj: string | null) => void;
  initialCpf?: string;
}

export function CpfNotaToggle({ onCpfChange, initialCpf = "" }: CpfNotaToggleProps) {
  const [incluirCpf, setIncluirCpf] = useState(!!initialCpf);
  const [cpfCnpj, setCpfCnpj] = useState(initialCpf);
  const [erroCpfCnpj, setErroCpfCnpj] = useState("");

  const handleCpfChange = (value: string) => {
    const masked = maskCpfCnpj(value);
    setCpfCnpj(masked);
    
    if (masked.length === 0) {
      setErroCpfCnpj("");
      onCpfChange(null);
      return;
    }

    if (masked.length >= 14) { // CPF completo ou CNPJ parcial
      const isValid = validateCpfCnpj(masked);
      if (!isValid) {
        setErroCpfCnpj("CPF/CNPJ inválido");
      } else {
        setErroCpfCnpj("");
        onCpfChange(masked);
      }
    } else {
      setErroCpfCnpj("");
    }
  };

  const handleToggleChange = (checked: boolean) => {
    setIncluirCpf(checked);
    if (!checked) {
      setCpfCnpj("");
      setErroCpfCnpj("");
      onCpfChange(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            CPF/CNPJ na nota
          </Label>
          <p className="text-xs text-muted-foreground">
            Incluir CPF ou CNPJ na nota fiscal
          </p>
        </div>
        <Switch
          checked={incluirCpf}
          onCheckedChange={handleToggleChange}
        />
      </div>

      {incluirCpf && (
        <div className="space-y-2">
          <Label htmlFor="cpf-cnpj">CPF ou CNPJ *</Label>
          <Input
            id="cpf-cnpj"
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            value={cpfCnpj}
            onChange={(e) => handleCpfChange(e.target.value)}
            className={erroCpfCnpj ? "border-red-500" : ""}
          />
          {erroCpfCnpj && (
            <p className="text-xs text-red-500">{erroCpfCnpj}</p>
          )}
        </div>
      )}
    </div>
  );
}
