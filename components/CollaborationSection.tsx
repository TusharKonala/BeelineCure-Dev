import Image from "next/image";
import { Button } from "@/components/ui/button";

function JoinUsCta() {
  return (
    <Button className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-black bg-[#2555F3] px-3 py-1.5 text-sm text-white hover:bg-[#1e44c7] md:gap-2 md:px-5 md:py-2 md:text-base">
      <Image
        src="/fi-sr-megaphone.svg"
        alt="Join Clinivo"
        width={32}
        height={32}
        className="size-3 shrink-0 object-contain md:size-4"
        unoptimized
      />
      <span>Join Us</span>
    </Button>
  );
}

export function CollaborationSection() {
  return (
    <section className="w-full bg-[#ACACAC]/10 py-4 md:py-6 lg:py-8">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-0">
        {/* Row 1 – Column 1: Text */}
        <div className="flex flex-col justify-center gap-3 px-6 md:px-12 lg:px-20">
          <h2 className="font-montaga text-2xl leading-snug text-[#333333] md:text-3xl lg:text-4xl">
            Leveraging
            <br />
            Transparency
          </h2>

          <p className="font-montserrat text-xs leading-relaxed text-[#5E5E5E] md:text-sm">
            Making health care decisions without transparency is like trying to
            navigate a ship in dense fog. Without clear visibility, it&apos;s
            challenging to make informed choices, and there&apos;s a higher risk
            of making a wrong turn or running aground. For employers, the lack of
            control over data and the inability to know the underlying cost of
            services is like assembling a puzzle with missing pieces.
          </p>

          <JoinUsCta />
        </div>

        {/* Row 1 – Column 2: Image flush right */}
        <div className="flex items-end justify-end">
          <Image
            src="/discussion.svg"
            alt="Discussion illustration"
            width={400}
            height={320}
            className="h-auto w-full object-contain"
          />
        </div>

        {/* Row 2 – Column 1: Image flush left */}
        <div className="flex items-start justify-start">
          <Image
            src="/office-conversation.svg"
            alt="Office conversation illustration"
            width={400}
            height={320}
            className="h-auto w-full object-contain"
          />
        </div>

        {/* Row 2 – Column 2: Text */}
        <div className="flex flex-col justify-center gap-3 px-6 md:px-12 lg:px-20">
          <h2 className="font-montaga text-2xl leading-snug text-[#333333] md:text-3xl lg:text-4xl">
            Fostering Collaboration
          </h2>

          <p className="font-montserrat text-xs leading-relaxed text-[#5E5E5E] md:text-sm">
            Decentralized platform built to promote peer-to-peer connections.
            Local healthcare providers and local employers can use the platform
            to create innovative programs to serve specific diseases or for
            population-based programs. The platform can supplement or replace
            existing networks used in benefit plans. And all participants in the
            ecosystem – employers/payers, providers, technology partners and
            consumers have access to the data assets needed to help build those
            programs.
          </p>

          <JoinUsCta />
        </div>
      </div>
    </section>
  );
}
