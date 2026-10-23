import { LANDING_COPY } from "@osaja/config";
import { aos } from "@/lib/aos";

export function VisionSection() {
  const { vision, mission } = LANDING_COPY;

  return (
    <section id="vision" className="section-pad scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <p className="section-label text-center" {...aos("fade-up")}>
          Who we are
        </p>
        <h2 className="section-title text-center" {...aos("fade-up", { delay: 80 })}>
          Vision & mission
        </h2>
        <p
          className="mx-auto mt-4 max-w-2xl text-center text-slate-600"
          {...aos("fade-up", { delay: 120 })}
        >
          Built for former students of Asuofua D/A JHS Block A — united in purpose, organised for
          impact.
        </p>

        <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-16">
          <article {...aos("fade-up", { delay: 100 })}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy/50">
              {vision.title}
            </p>
            <p className="mt-4 font-display text-2xl font-semibold leading-snug text-brand-navy sm:text-3xl">
              {vision.body}
            </p>
          </article>

          <article
            className="md:border-l md:border-brand-navy/10 md:pl-16"
            {...aos("fade-up", { delay: 180 })}
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold-dark">
              {mission.title}
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate-600 sm:text-xl">{mission.body}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
