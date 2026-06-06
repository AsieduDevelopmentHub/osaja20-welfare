export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-5 sm:mb-6">
      <h2 className="text-xl font-bold leading-tight text-brand-navy sm:text-2xl">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">{description}</p>
      ) : null}
    </header>
  );
}