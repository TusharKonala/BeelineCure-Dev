import { Navbar } from "@/components/Navbar";
import { HeroCarousel } from "@/components/HeroCarousel";
import { FeaturesSection } from "@/components/FeaturesSection";
import { CollaborationSection } from "@/components/CollaborationSection";
import { InnovationSection } from "@/components/InnovationSection";
import { BenefitsSection } from "@/components/BenefitsSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Navbar />
      <HeroCarousel />
      <FeaturesSection />
      <CollaborationSection />
      <InnovationSection />
      <BenefitsSection />
    </div>
  );
}
