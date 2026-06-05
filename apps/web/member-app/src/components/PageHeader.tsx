export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      {description ? <p className="text-slate-500">{description}</p> : null}
    </header>
  );
}
