"use client";

import {
  GALLERY_CATEGORY_LABELS,
  GALLERY_ITEMS,
  LANDING_COPY,
  type GalleryItem,
} from "@osaja/config";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { aos } from "@/lib/aos";

function GalleryCard({
  item,
  index,
  onOpen,
}: {
  item: GalleryItem;
  index: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative w-full overflow-hidden rounded-2xl bg-brand-navy/5 text-left shadow-sm ring-1 ring-brand-navy/10 transition hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
        item.featured ? "md:row-span-2" : ""
      }`}
      {...aos("fade-up", { delay: 60 + index * 80 })}
    >
      <div className={`relative w-full ${item.featured ? "aspect-[4/5] md:min-h-full md:flex-1" : "aspect-[4/3]"}`}>
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-dark/85 via-brand-navy-dark/20 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-navy">
          {GALLERY_CATEGORY_LABELS[item.category]}
        </span>
        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand-navy opacity-0 transition group-hover:opacity-100">
          <ZoomIn className="h-4 w-4" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-xs font-medium text-brand-gold-light">{item.date}</p>
          <h3 className="mt-1 text-lg font-bold leading-snug">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-200">{item.description}</p>
        </div>
      </div>
    </button>
  );
}

export function GallerySection() {
  const { gallery } = LANDING_COPY;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex !== null ? GALLERY_ITEMS[activeIndex] : null;

  const close = useCallback(() => setActiveIndex(null), []);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i - 1 + GALLERY_ITEMS.length) % GALLERY_ITEMS.length));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i + 1) % GALLERY_ITEMS.length));
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, close, goPrev, goNext]);

  useEffect(() => {
    document.body.style.overflow = activeIndex !== null ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeIndex]);

  return (
    <section id="gallery" className="section-pad scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <p className="section-label text-center" {...aos("fade-up")}>
          {gallery.title}
        </p>
        <h2 className="section-title text-center" {...aos("fade-up", { delay: 80 })}>
          Activities & memories
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600" {...aos("fade-up", { delay: 120 })}>
          {gallery.subtitle}
        </p>

        <div className="mt-12 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY_ITEMS.map((item, index) => (
            <GalleryCard key={item.id} item={item} index={index} onOpen={() => setActiveIndex(index)} />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">{gallery.hint}</p>
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-navy-dark/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={close}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close gallery"
            onClick={close}
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-4 sm:flex"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-4 sm:flex"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-hero"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/10] w-full bg-brand-navy/5">
              <Image src={active.image} alt={active.title} fill className="object-cover" sizes="(max-width: 896px) 100vw, 896px" />
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-gold-dark">
                  {GALLERY_CATEGORY_LABELS[active.category]}
                </span>
                <span className="text-sm text-slate-500">{active.date}</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold text-brand-navy">{active.title}</h3>
              <p className="mt-2 text-slate-600">{active.description}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
