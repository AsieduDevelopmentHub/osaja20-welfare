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
      <LandingHeader />
      <main className="pt-16">
        <BraFieProgramSection />
      </main>
      <LandingFooter />
    </>
  );
}
