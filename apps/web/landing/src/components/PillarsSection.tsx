import { LANDING_COPY } from "@osaja/config";
import {
  Cake,
  HandHeart,
  Landmark,
  Megaphone,
  Scale,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: LucideIcon[] = [HandHeart, Wallet, Megaphone, Scale, Cake, Landmark];

export function PillarsSection() {
  const { pillars } = LANDING_COPY;

  return (
    <section id="pillars" className="section-pad scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl">
        <p className="section-label text-center">What we do</p>
        <h2 className="section-title text-center">Our welfare pillars</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
          A complete ecosystem for member care — from monthly dues to emergency support, governance, and celebration.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar, index) => {
            const Icon = ICONS[index] ?? HandHeart;
            return (
              <article
                key={pillar.title}
                className="rounded-2xl border border-brand-navy/8 bg-brand-cream/50 p-6 transition hover:border-brand-navy/15 hover:bg-white hover:shadow-card"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-navy text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-brand-navy">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{pillar.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
