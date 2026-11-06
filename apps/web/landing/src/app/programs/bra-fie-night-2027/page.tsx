import type { Metadata } from "next";
import { BraFieProgramSection } from "@/components/BraFieProgramSection";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingHeader } from "@/components/LandingHeader";

export const metadata: Metadata = {
  title: "Bra Fie Night 2027",
  description:
    "Event details, venue, ticket options, and secure ticket checkout for Bra Fie Night 2027.",
};

export default function BraFieNightPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brand-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <LandingHeader />
      <main id="main-content" className="pt-16">
        <BraFieProgramSection />
      </main>
      <LandingFooter />
    </>
  );
}
