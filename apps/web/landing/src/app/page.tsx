import { DreamSection } from "@/components/DreamSection";
import { GallerySection } from "@/components/GallerySection";
import { HeroSection } from "@/components/HeroSection";
import { JoinSection } from "@/components/JoinSection";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingHeader } from "@/components/LandingHeader";
import { PillarsSection } from "@/components/PillarsSection";
import { VisionSection } from "@/components/VisionSection";

export default function HomePage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brand-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <LandingHeader />
      <main id="main-content">
        <HeroSection />
        <VisionSection />
        <DreamSection />
        <PillarsSection />
        <GallerySection />
        <JoinSection />
      </main>
      <LandingFooter />
    </>
  );
}
