import { useState, useEffect } from "react";
import { Hourglass, AlertTriangle } from "lucide-react";

interface OrderCountdownProps {
  createdAt: string | null;
  acceptedAt?: string | null;
  deliveryTimeMin: number | null | undefined;
  status: string;
  compact?: boolean;
}

/**
 * Countdown timer for delivery orders.
 * Shows time remaining based on deliveryTimeMin. Goes red when overdue.
 * If no deliveryTimeMin is set, shows elapsed time counting up.
 */
export function OrderCountdown({ createdAt, acceptedAt, deliveryTimeMin, status, compact = false }: OrderCountdownProps) {
  const [now, setNow] = useState(Date.now());

  const terminalStatuses = ["delivered", "cancelled", "rejected"];
  const isTerminal = terminalStatuses.includes(status);

  useEffect(() => {
    if (isTerminal || !createdAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isTerminal, createdAt]);

  if (!createdAt || isTerminal) return null;

  // Use acceptedAt as start time for countdown (delivery time starts when order is accepted)
  // Fall back to createdAt if acceptedAt is not available
  const startTime = acceptedAt ? new Date(acceptedAt).getTime() : new Date(createdAt).getTime();
  const hasDeadline = !!deliveryTimeMin && deliveryTimeMin > 0;

  if (hasDeadline) {
    const deadline = startTime + deliveryTimeMin * 60 * 1000;
    const diff = deadline - now;
    const isOverdue = diff < 0;
    const absDiff = Math.abs(diff);
    const timeStr = formatTime(absDiff);
    const isWarning = !isOverdue && diff < 5 * 60 * 1000;

    if (compact) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold tabular-nums ${
            isOverdue
              ? "bg-red-600 text-white"
              : isWarning
              ? "bg-amber-500 text-white"
              : "bg-emerald-600 text-white"
          }`}
        >
          <Hourglass className="w-3 h-3" />
          {isOverdue ? `-${timeStr}` : timeStr}
        </span>
      );
    }

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-bold tabular-nums ${
          isOverdue
            ? "bg-red-600 text-white"
            : isWarning
            ? "bg-amber-500 text-white"
            : "bg-emerald-600 text-white"
        }`}
      >
        {isOverdue ? <AlertTriangle className="w-4 h-4" /> : <Hourglass className="w-4 h-4" />}
        <span>{isOverdue ? `Atrasado ${timeStr}` : timeStr}</span>
      </div>
    );
  }

  // No deadline — show elapsed time
  const elapsed = now - startTime;
  const timeStr = formatTime(elapsed);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold tabular-nums bg-muted text-muted-foreground">
        <Hourglass className="w-3 h-3" />
        {timeStr}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-bold tabular-nums bg-muted text-muted-foreground">
      <Hourglass className="w-4 h-4" />
      <span>{timeStr}</span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
