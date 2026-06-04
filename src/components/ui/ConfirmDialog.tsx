import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, CheckCircle2, Info } from "lucide-react";

export type ConfirmDialogType = "danger" | "warning" | "success" | "info";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: ConfirmDialogType;
  title: string;
  description?: string;
  impact?: string;
  footer?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
}

const presets: Record<
  ConfirmDialogType,
  { icon: React.ElementType; iconBg: string; iconColor: string; actionClass: string }
> = {
  danger: {
    icon: Trash2,
    iconBg: "bg-red-500/15 dark:bg-red-500/20",
    iconColor: "text-red-500",
    actionClass: "bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-orange-500/15 dark:bg-orange-500/20",
    iconColor: "text-orange-500",
    actionClass: "bg-orange-500 hover:bg-orange-600 focus:ring-orange-500 text-white",
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-green-500/15 dark:bg-green-500/20",
    iconColor: "text-green-500",
    actionClass: "bg-green-600 hover:bg-green-700 focus:ring-green-600 text-white",
  },
  info: {
    icon: Info,
    iconBg: "bg-blue-500/15 dark:bg-blue-500/20",
    iconColor: "text-blue-500",
    actionClass: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-600 text-white",
  },
};

const impactBg: Record<ConfirmDialogType, string> = {
  danger: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
  warning: "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300",
  success: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
  info: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
};

export function ConfirmDialog({
  open,
  onOpenChange,
  type = "danger",
  title,
  description,
  impact,
  footer,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
}: ConfirmDialogProps) {
  const { icon: Icon, iconBg, iconColor, actionClass } = presets[type];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle className="text-base leading-snug">{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription className="mt-1.5 text-sm leading-relaxed">
                  {description}
                </AlertDialogDescription>
              )}
            </div>
          </div>

          {impact && (
            <div className={`mt-3 ml-13 p-3 rounded-lg border text-sm ${impactBg[type]}`}>
              {impact}
            </div>
          )}

          {footer && (
            <p className="mt-2 ml-13 text-xs text-muted-foreground">{footer}</p>
          )}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            className={actionClass}
            onClick={onConfirm}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
