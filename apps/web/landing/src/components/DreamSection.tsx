import { LANDING_COPY } from "@osaja/config";
import { Sparkles } from "lucide-react";
import { aos } from "@/lib/aos";

export function DreamSection() {
  const { dream } = LANDING_COPY;

  return (
    <section id="dream" className="section-pad scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[2rem] bg-brand-navy text-white shadow-hero" {...aos("zoom-in", { duration: 800 })}>
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16 lg:p-14">
            <div {...aos("fade-right", { delay: 100 })}>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-gold-light">
                <Sparkles className="h-3.5 w-3.5" />
                {dream.title}
              </div>
              <h2 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">{dream.lead}</h2>
              <p className="mt-5 text-base leading-relaxed text-slate-200 sm:text-lg">{dream.body}</p>
            </div>

            <ul className="space-y-4">
              {dream.highlights.map((item, index) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-100 sm:text-base"
                  {...aos("fade-left", { delay: 120 + index * 80 })}
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-gold" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
