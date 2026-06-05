import type { Metadata } from "next";
import BeelineCureHomepage from "@/components/BeelineCureHomepage";

export const metadata: Metadata = {
  title: "BeelineCure | Turn every patient into a confirmed appointment",
  description:
    "BeelineCure gives your clinic a branded booking system so patients who find you book instantly and come back directly, not through marketplaces.",
};

export default function Home() {
  return <BeelineCureHomepage />;
}
