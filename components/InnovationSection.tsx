import Image from "next/image";
import { Button } from "@/components/ui/button";

function JoinUsCtaFull() {
  return (
    <Button className="mt-auto flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-black bg-[#2555F3] px-3 py-1.5 text-sm text-white hover:bg-[#1e44c7] md:gap-2 md:px-5 md:py-2 md:text-base">
      <Image
        src="/fi-sr-megaphone.svg"
        alt="Join BeelineCure"
        width={32}
        height={32}
        className="size-3 shrink-0 object-contain md:size-4"
        unoptimized
      />
      <span>Join Us</span>
    </Button>
  );
}

export function InnovationSection() {
  return (
    <section className="flex w-full items-center justify-center bg-white px-4 py-8 md:px-8 md:py-12">
      <div className="flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:gap-8">
        {/* Card 1 */}
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-[#171717] p-6 md:p-8 lg:p-10">
          <h2 className="font-montaga text-2xl leading-snug text-white md:text-3xl lg:text-4xl">
            Security and
            <br />
            Reliability
            <br />
            are no longer
            <br />
            a worry
          </h2>

          <p className="font-montserrat text-xs leading-relaxed text-white/80 md:text-sm">
            Decentralized platform built to promote peer-to-peer connections.
            Local healthcare providers and local employers can use the platform
            to create innovative programs to serve specific diseases or for
            population-based programs. The platform can supplement or replace
            existing networks used in benefit plans.
          </p>

          <JoinUsCtaFull />
        </div>

        {/* Card 2 */}
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-[#171717] p-6 md:p-8 lg:p-10">
          <h2 className="font-montaga text-2xl leading-snug text-white md:text-3xl lg:text-4xl">
            Promoting
            <br />
            Innovation
          </h2>

          <p className="font-montserrat text-xs leading-relaxed text-white/80 md:text-sm">
            Fundamentally two things: a contracted health care provider network
            and a payment platform. The contracted network takes advantage of new
            federal laws and regulations intended to remove the veil of secrecy
            around negotiated payment rates. The payment platform is like the
            Rosetta Stone of transactions with the network. The platform is the
            key to deciphering and simplifying the complex codes and standards
            relating to health care payments. It is the central hub for
            empowering a wide range of organizations to build capabilities that
            can be offered to employers and individuals who.
          </p>

          <JoinUsCtaFull />
        </div>
      </div>
    </section>
  );
}
