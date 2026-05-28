import { useEffect } from "react";
import { useTheme } from "next-themes";

interface ForceThemeProps {
  theme: string;
  children: React.ReactNode;
}

/**
 * Forces a specific theme while this component is mounted.
 * Restores the previous theme on unmount.
 */
export function ForceTheme({ theme, children }: ForceThemeProps) {
  const { setTheme, theme: currentTheme } = useTheme();

  useEffect(() => {
    const previousTheme = currentTheme;
    setTheme(theme);

    return () => {
      if (previousTheme && previousTheme !== theme) {
        setTheme(previousTheme);
      }
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
