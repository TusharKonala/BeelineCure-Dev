import { Navbar } from "@/components/Navbar";
import { HeroCarousel } from "@/components/HeroCarousel";
import { FeaturesSection } from "@/components/FeaturesSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Navbar />
      <HeroCarousel />
      <FeaturesSection />
    </div>
  );
}
