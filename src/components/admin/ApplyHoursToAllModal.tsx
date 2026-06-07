import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  sourceDayLabel: string;
  sourcePeriods: { opening_time: string; closing_time: string }[];
  onConfirm: (options: { includeSaturday: boolean; includeSunday: boolean }) => void;
}

export function ApplyHoursToAllModal({ 
  open, onClose, sourceDayLabel, sourcePeriods, onConfirm 
}: Props) {
  const [includeSaturday, setIncludeSaturday] = useState(true);
  const [includeSunday, setIncludeSunday] = useState(true);

  const periodsLabel = sourcePeriods
    .map(p => `${p.opening_time} às ${p.closing_time}`)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Copy className="w-5 h-5 text-orange-500" />
            </div>
            <DialogTitle className="text-white">
              Aplicar horário a todos os dias?
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-zinc-400 text-sm">
            Os horários de <strong className="text-white">{sourceDayLabel}</strong>{' '}
            (<span className="text-orange-400">{periodsLabel}</span>) serão copiados 
            para os outros dias da semana.
          </p>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-amber-300 text-sm">
              ⚠️ Isso vai sobrescrever os horários atuais dos outros dias.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSaturday}
                onChange={(e) => setIncludeSaturday(e.target.checked)}
                className="rounded"
              />
              <span className="text-white">Incluir Sábado</span>
            </label>

            <label className="flex items-center gap-2 p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSunday}
                onChange={(e) => setIncludeSunday(e.target.checked)}
                className="rounded"
              />
              <span className="text-white">Incluir Domingo</span>
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onConfirm({ includeSaturday, includeSunday });
                onClose();
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium"
            >
              Sim, aplicar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
