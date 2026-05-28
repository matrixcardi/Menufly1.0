import { Gift } from "lucide-react";

export function PromoBanner() {
  return (
    <div className="mx-4 my-2 animate-fade-in">
      <div className="bg-gradient-to-r from-primary to-amber-500 rounded-xl p-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-primary-foreground/20 p-1.5 rounded-lg">
            <Gift className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-primary-foreground font-bold text-sm">5% cashback</p>
            <p className="text-primary-foreground/90 text-xs">compre e ganhe na hora</p>
          </div>
        </div>
        <button className="bg-primary-foreground text-primary font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-primary-foreground/90 transition-colors">
          Aproveite!
        </button>
      </div>
    </div>
  );
}
