import Image from "next/image";

export interface BrandLogoProps {
  src: string;
  alt: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
}

const sizes = {
  xs: { box: "h-8 w-8", px: 32 },
  sm: { box: "h-10 w-10", px: 40 },
  md: { box: "h-12 w-12", px: 48 },
  lg: { box: "h-16 w-16", px: 64 },
  xl: { box: "h-24 w-24", px: 96 },
};

export function BrandLogo({ src, alt, size = "md", className = "", priority = false }: BrandLogoProps) {
  const s = sizes[size];
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full ${s.box} ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={s.px}
        height={s.px}
        priority={priority}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export interface BrandHeaderProps {
  logoSrc: string;
  logoAlt: string;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  centered?: boolean;
}

export function BrandHeader({
  logoSrc,
  logoAlt,
  title,
  subtitle,
  size = "md",
  variant = "light",
  centered = false,
}: BrandHeaderProps) {
  const logoSize = size === "lg" ? "xl" : size === "sm" ? "sm" : "md";
  const isDark = variant === "dark";

  return (
    <div className={`flex items-center gap-3 ${centered ? "flex-col text-center" : ""}`}>
      <BrandLogo src={logoSrc} alt={logoAlt} size={logoSize} priority />
      <div className={centered ? "text-center" : "min-w-0"}>
        <p
          className={`truncate font-bold leading-tight ${
            size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base"
          } ${isDark ? "text-white" : "text-brand-navy"}`}
        >
          {title}
        </p>
        {subtitle ? (
          <p className={`truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
