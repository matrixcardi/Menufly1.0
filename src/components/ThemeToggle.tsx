import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="gap-2"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4" />
          Modo claro
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          Modo escuro
        </>
      )}
    </Button>
  );
}
