import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";

interface NFeStatusBadgeProps {
  status: 'pending' | 'processing' | 'authorized' | 'cancelled' | 'error';
  nfeNumber?: string;
}

export default function NFeStatusBadge({ status, nfeNumber }: NFeStatusBadgeProps) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary" className="text-xs">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary" className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Processando...
        </Badge>
      );
    case 'authorized':
      return (
        <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
          <CheckCircle className="w-3 h-3 mr-1" />
          NFe #{nfeNumber || 'Emitida'}
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="secondary" className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelada
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="w-3 h-3 mr-1" />
          Erro NFe
        </Badge>
      );
    default:
      return null;
  }
}
