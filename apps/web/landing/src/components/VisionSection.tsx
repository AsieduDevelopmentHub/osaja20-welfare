import { LANDING_COPY } from "@osaja/config";
import { Eye, Target } from "lucide-react";
import { aos } from "@/lib/aos";

export function VisionSection() {
  const { vision, mission } = LANDING_COPY;

  return (
    <section id="vision" className="section-pad scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl">
        <p className="section-label text-center" {...aos("fade-up")}>
          Who we are
        </p>
        <h2 className="section-title text-center" {...aos("fade-up", { delay: 80 })}>
          Vision & mission
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600" {...aos("fade-up", { delay: 120 })}>
          Built for former students of Asuofua D/A JHS Block A — united in purpose, organised for impact.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="glass-card group p-8 transition hover:shadow-card" {...aos("fade-up", { delay: 100 })}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy/10 text-brand-navy transition group-hover:bg-brand-navy group-hover:text-white">
              <Eye className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-brand-navy">{vision.title}</h3>
            <p className="mt-3 leading-relaxed text-slate-600">{vision.body}</p>
          </article>

          <article className="glass-card group p-8 transition hover:shadow-card" {...aos("fade-up", { delay: 200 })}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/15 text-brand-gold-dark transition group-hover:bg-brand-gold group-hover:text-brand-navy-dark">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-brand-navy">{mission.title}</h3>
            <p className="mt-3 leading-relaxed text-slate-600">{mission.body}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
