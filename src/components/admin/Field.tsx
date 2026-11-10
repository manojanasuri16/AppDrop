export function Field({
  id, label, hint, error, children, optional,
}: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-footnote font-medium text-label-2">
        <span>{label}</span>
        {optional && <span className="font-normal text-label-3">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-footnote text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-footnote text-label-2">{hint}</p>
      ) : null}
    </div>
  );
}

export function Section({
  title, footer, children, className = "",
}: { title?: string; footer?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h2 className="text-eyebrow mb-2 px-4 text-label-2">{title}</h2>}
      {children}
      {footer && <p className="text-footnote mt-2 px-4 text-label-2">{footer}</p>}
    </section>
  );
}
