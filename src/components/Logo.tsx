import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";

interface LogoProps {
  className?: string;
  variant?: "auto" | "light" | "dark";
}

export function Logo({ className = "h-10 w-auto", variant = "auto" }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch
  if (!mounted) {
    return <div className={className} />;
  }

  // Determine which logo to show based on variant prop
  const showDarkLogo = variant === "auto" 
    ? resolvedTheme === "dark" 
    : variant === "dark";

  return (
    <img
      src={showDarkLogo ? logoDark : logoLight}
      alt="MenuFly"
      className={className}
    />
  );
}
