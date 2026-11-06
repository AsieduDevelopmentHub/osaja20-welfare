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
      <LandingHeader transparentAtTop />
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
