import { Navbar } from "@/components/Navbar";
import { HeroCarousel } from "@/components/HeroCarousel";
import { FeaturesSection } from "@/components/FeaturesSection";
import { CollaborationSection } from "@/components/CollaborationSection";
import { InnovationSection } from "@/components/InnovationSection";
import { BenefitsSection } from "@/components/BenefitsSection";
import { StatsSection } from "@/components/StatsSection";
import { VideoSection } from "@/components/VideoSection";

export default function Home() {
  return (
    <div className="min-h-screen w-full min-w-0 bg-zinc-50 dark:bg-black">
      <Navbar />
      <HeroCarousel />
      <FeaturesSection />
      <CollaborationSection />
      <InnovationSection />
      <BenefitsSection />
      <StatsSection />
      <VideoSection />
      <StatsSection />
    </div>
  );
}
