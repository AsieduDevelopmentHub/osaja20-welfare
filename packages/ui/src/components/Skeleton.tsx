export type SkeletonVariant = "light" | "dark";

function bone(variant: SkeletonVariant, className: string) {
  const tone = variant === "dark" ? "bg-white/10" : "bg-slate-200/90";
  return `animate-pulse rounded-lg ${tone} ${className}`;
}

export interface SkeletonProps {
  className?: string;
  variant?: SkeletonVariant;
}

export function Skeleton({ className = "", variant = "light" }: SkeletonProps) {
  return <div className={bone(variant, className)} aria-hidden />;
}

export function PageHeaderSkeleton({ variant = "light" }: { variant?: SkeletonVariant }) {
  return (
    <header className="mb-5 space-y-2 sm:mb-6">
      <Skeleton variant={variant} className="h-7 w-48 sm:h-8" />
      <Skeleton variant={variant} className="h-4 w-full max-w-md" />
    </header>
  );
}

export function StatCardsSkeleton({
  count = 4,
  variant = "light",
}: {
  count?: number;
  variant?: SkeletonVariant;
}) {
  const cardBg =
    variant === "dark"
      ? "rounded-2xl border border-white/10 bg-brand-navy/60 p-4 sm:p-5"
      : "rounded-2xl border border-white/40 bg-white/80 p-4 sm:p-5 shadow-glass";

  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex min-h-[7.25rem] flex-col ${cardBg}`}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <Skeleton variant={variant} className="h-3 w-20" />
            <Skeleton variant={variant} className="h-9 w-9 shrink-0 rounded-xl" />
          </div>
          <Skeleton variant={variant} className="mt-auto h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ListRowsSkeleton({
  rows = 4,
  variant = "light",
}: {
  rows?: number;
  variant?: SkeletonVariant;
}) {
  const wrap =
    variant === "dark"
      ? "rounded-2xl border border-white/10 bg-brand-navy/60 divide-y divide-white/5"
      : "glass-card divide-y divide-slate-100";

  return (
    <div className={wrap}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-6">
          <Skeleton variant={variant} className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton variant={variant} className="h-4 w-2/5 max-w-[180px]" />
            <Skeleton variant={variant} className="h-3 w-3/5 max-w-[240px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationListSkeleton({ variant = "light" }: { variant?: SkeletonVariant }) {
  const wrap = variant === "dark" ? "rounded-2xl border border-white/10 bg-brand-navy/60" : "glass-card";

  return (
    <div className={`${wrap} divide-y divide-slate-100`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-4 sm:px-6">
          <Skeleton variant={variant} className="mt-1 h-2 w-2 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton variant={variant} className="h-4 w-1/2 max-w-[200px]" />
            <Skeleton variant={variant} className="h-3 w-full max-w-sm" />
            <Skeleton variant={variant} className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MemberListSkeleton({ variant = "dark" }: { variant?: SkeletonVariant }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-brand-navy/60">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border-b border-white/5 p-4 last:border-0 sm:p-5">
          <Skeleton variant={variant} className="mb-2 h-4 w-40" />
          <Skeleton variant={variant} className="mb-3 h-3 w-56" />
          <div className="flex gap-2">
            <Skeleton variant={variant} className="h-5 w-16 rounded-full" />
            <Skeleton variant={variant} className="h-5 w-20 rounded-full" />
            <Skeleton variant={variant} className="h-5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContributionCardSkeleton({ variant = "light" }: { variant?: SkeletonVariant }) {
  const card = variant === "dark" ? "rounded-2xl border border-white/10 bg-brand-navy/60" : "glass-card";

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="border-b border-slate-100/10 px-5 py-6 sm:px-6">
        <div className="flex items-center gap-4">
          <Skeleton variant={variant} className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton variant={variant} className="h-3 w-28" />
            <Skeleton variant={variant} className="h-8 w-36" />
          </div>
        </div>
      </div>
      <div className="px-5 py-4 sm:px-6">
        <Skeleton variant={variant} className="h-4 w-full max-w-md" />
      </div>
    </div>
  );
}

/** Full-screen portal shell skeleton (auth session check). */
export function PortalShellSkeleton({ variant = "light" }: { variant?: SkeletonVariant }) {
  const shellBg = variant === "dark" ? "bg-brand-navy-dark" : "bg-brand-cream";
  const headerBorder = variant === "dark" ? "border-white/10 bg-brand-navy/80" : "border-white/60 bg-white/80";
  const navBorder = variant === "dark" ? "border-white/10 bg-brand-navy/80" : "border-white/60 bg-white/80";

  return (
    <div className={`min-h-screen ${shellBg}`}>
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md lg:hidden ${headerBorder}`}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Skeleton variant={variant} className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton variant={variant} className="h-3.5 w-24" />
            <Skeleton variant={variant} className="h-2.5 w-16" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl lg:gap-6 lg:p-6">
        <aside
          className={`sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col rounded-2xl border p-5 lg:flex ${headerBorder}`}
        >
          <div className="mb-6 flex items-center gap-3">
            <Skeleton variant={variant} className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton variant={variant} className="h-4 w-28" />
              <Skeleton variant={variant} className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant={variant} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 px-4 py-4 pb-24 lg:px-0 lg:py-0 lg:pb-0">
          <PageHeaderSkeleton variant={variant} />
          <StatCardsSkeleton variant={variant} />
          <div className={variant === "dark" ? "rounded-2xl border border-white/10 bg-brand-navy/60 p-4 sm:p-6" : "glass-card p-4 sm:p-6"}>
            <Skeleton variant={variant} className="mb-4 h-5 w-40" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton variant={variant} className="h-2 w-2 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton variant={variant} className="h-4 w-48" />
                    <Skeleton variant={variant} className="h-3 w-full max-w-sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <nav
        className={`fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-md lg:hidden ${navBorder}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-lg justify-around py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-2">
              <Skeleton variant={variant} className="h-5 w-5 rounded" />
              <Skeleton variant={variant} className="h-2 w-8" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function AuthFormSkeleton({ variant = "light" }: { variant?: SkeletonVariant }) {
  const card =
    variant === "dark"
      ? "space-y-4 rounded-2xl border border-white/10 bg-brand-navy/80 p-6 sm:p-8"
      : "glass-card space-y-4 p-6 sm:p-8";

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center gap-4">
        <Skeleton variant={variant} className="h-16 w-16 rounded-2xl" />
        <Skeleton variant={variant} className="h-6 w-48" />
        <Skeleton variant={variant} className="h-4 w-64" />
      </div>
      <div className={card}>
        <div className="space-y-2">
          <Skeleton variant={variant} className="h-4 w-24" />
          <Skeleton variant={variant} className="h-12 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton variant={variant} className="h-4 w-20" />
          <Skeleton variant={variant} className="h-12 w-full rounded-xl" />
        </div>
        <Skeleton variant={variant} className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardPageSkeleton({ variant = "light" }: { variant?: SkeletonVariant }) {
  const sectionClass =
    variant === "dark" ? "rounded-2xl border border-white/10 bg-brand-navy/60 p-4 sm:p-6" : "glass-card p-4 sm:p-6";

  return (
    <div className="space-y-6">
      <PageHeaderSkeleton variant={variant} />
      <StatCardsSkeleton variant={variant} />
      <section className={sectionClass}>
        <Skeleton variant={variant} className="mb-4 h-5 w-44" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 border-b border-slate-100/10 pb-3 last:border-0 last:pb-0">
              <Skeleton variant={variant} className="mt-1 h-2 w-2 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton variant={variant} className="h-4 w-40" />
                <Skeleton variant={variant} className="h-3 w-full max-w-xs" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
