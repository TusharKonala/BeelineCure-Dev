import { BenefitsSection } from "@/components/BenefitsSection";
import { CollaborationSection } from "@/components/CollaborationSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { HeroCarousel } from "@/components/HeroCarousel";
import { InnovationSection } from "@/components/InnovationSection";
import { StatsSection } from "@/components/StatsSection";
import { VideoSection } from "@/components/VideoSection";

export default function Home() {
  return (
    <div className="min-h-screen w-full min-w-0 bg-zinc-50 dark:bg-black">
      <HeroCarousel />
      <FeaturesSection />
      <CollaborationSection />
      <InnovationSection />
      <BenefitsSection />
      <StatsSection />
      <VideoSection />
    </div>
  );
}
