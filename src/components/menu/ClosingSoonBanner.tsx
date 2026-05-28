import { Clock, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { playNotificationSound } from "@/lib/notification-sound";

interface ClosingSoonBannerProps {
  isClosingSoon: boolean;
  minutesUntilClose: number | null;
}

export function ClosingSoonBanner({ isClosingSoon, minutesUntilClose }: ClosingSoonBannerProps) {
  const hasPlayedSound = useRef(false);

  useEffect(() => {
    if (isClosingSoon && !hasPlayedSound.current) {
      playNotificationSound();
      hasPlayedSound.current = true;
    }
    
    // Reset when banner disappears (restaurant closes or reopens)
    if (!isClosingSoon) {
      hasPlayedSound.current = false;
    }
  }, [isClosingSoon]);

  if (!isClosingSoon || !minutesUntilClose) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 mt-4 overflow-hidden"
      >
        <div className="relative p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/30">
          {/* Animated background pulse */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 rounded-xl"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <div className="relative flex items-center gap-3">
            {/* Animated icon container */}
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shrink-0 shadow-lg"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Zap className="w-6 h-6 text-white" fill="white" />
            </motion.div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-amber-600 dark:text-amber-400 text-base">
                  Últimos pedidos! 🔥
                </p>
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 rounded-full"
                >
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {minutesUntilClose} min
                  </span>
                </motion.div>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                Corra! Estamos aceitando os últimos pedidos antes de encerrarmos.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
