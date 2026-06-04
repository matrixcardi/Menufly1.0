import { useState, useCallback } from "react";
import { ConfirmDialog, ConfirmDialogProps, ConfirmDialogType } from "@/components/ui/ConfirmDialog";

type OpenConfirmOptions = Omit<ConfirmDialogProps, "open" | "onOpenChange" | "onConfirm">;

/**
 * Hook para abrir um modal de confirmação de qualquer lugar do app.
 *
 * Uso:
 *   const { confirm, ConfirmDialogNode } = useConfirm();
 *   // no render: {ConfirmDialogNode}
 *   // na ação: await confirm({ type: "danger", title: "...", ... })
 */
export function useConfirm() {
  const [options, setOptions] = useState<OpenConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: OpenConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    resolver?.(true);
    setOptions(null);
    setResolver(null);
  };

  const handleCancel = () => {
    resolver?.(false);
    setOptions(null);
    setResolver(null);
  };

  const ConfirmDialogNode = options ? (
    <ConfirmDialog
      open={!!options}
      onOpenChange={(open) => { if (!open) handleCancel(); }}
      {...options}
      onConfirm={handleConfirm}
    />
  ) : null;

  return { confirm, ConfirmDialogNode };
}
