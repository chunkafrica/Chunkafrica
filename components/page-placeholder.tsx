type PagePlaceholderProps = {
  eyebrow: string;
  title: string;
  summary: string;
  focusAreas: string[];
  nextStep: string;
};

export function PagePlaceholder({
  eyebrow,
  title,
  summary,
  focusAreas,
  nextStep,
}: PagePlaceholderProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-line bg-panel p-8 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-ink">{title}</h2>
        <p className="mt-6 max-w-3xl text-base leading-7 text-slate-600">{summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink">Phase 1 focus</h3>
          <ul className="mt-4 space-y-3">
            {focusAreas.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-slate-700"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink">Current note</h3>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            {nextStep}
          </p>
        </div>
      </div>
    </section>
  );
}
