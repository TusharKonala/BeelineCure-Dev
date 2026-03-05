"use client";

import Image from "next/image";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const benefits = [
  {
    number: 1,
    heading: "Enhanced Patient Care",
    bullets: [
      "The health network prioritizes patient-centered care...",
      "Employers can offer their employees access to a healthcare system...",
    ],
  },
  {
    number: 2,
    heading: "Cost Savings",
    bullets: [
      "Physicians and employers can benefit from cost-efficient healthcare...",
      "Employers can reduce their healthcare spending by participating in a network...",
    ],
  },
  {
    number: 3,
    heading: "Increased Accessibility",
    bullets: [
      "Physicians and employers can extend their reach to underserved populations...",
      "The health network breaks down geographical barriers, ensuring healthcare...",
    ],
  },
  {
    number: 4,
    heading: "Collaboration Opportunities",
    bullets: [
      "Physicians can collaborate with peers and specialists easily within the cooperative...",
      "Employers can join a community of like-minded organizations...",
    ],
  },
  {
    number: 5,
    heading: "Data-Driven Insights",
    bullets: [
      "Physicians gain access to a wealth of health data and analytics tools...",
      "Employers can utilize data insights to design wellness programs...",
    ],
  },
];

const columnHeaders = [
  "Physicians & Providers",
  "Employers / Plan Administrators",
  "Support Partners",
];

function GradientPill() {
  return (
    <span
      className="mt-1.5 inline-block h-2 w-4 shrink-0 rounded-full"
      style={{
        background:
          "linear-gradient(90deg, #6366F1 0%, #A855F7 49%, #EC4899 100%)",
      }}
    />
  );
}

export function BenefitsSection() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 80% 65% at 40% 100%, rgba(99,102,241,0.25) 0%, transparent 70%),
          radial-gradient(ellipse 60% 55% at 55% 90%, rgba(168,85,247,0.2) 0%, transparent 60%),
          radial-gradient(ellipse 40% 45% at 70% 85%, rgba(236,72,153,0.15) 0%, transparent 50%),
          #000000
        `,
      }}
    >
      <div className="relative mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-16">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center md:mb-12">
          <h2 className="font-montaga text-2xl leading-snug text-white md:text-3xl lg:text-4xl">
            Benefits of Our
            <br />
            Services
          </h2>
          <p className="font-montserrat text-xs text-white/60 md:text-sm">
            We are a network of motivated individuals.
          </p>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:block">
          {/* Column Headers row — aligned with first number badge */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-4">
            <div />
            {columnHeaders.map((header) => (
              <div
                key={header}
                className="mb-4 rounded-lg bg-[#272727] px-3 py-2.5 text-center"
              >
                <span className="font-montserrat whitespace-nowrap text-xs font-semibold text-white">
                  {header}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {benefits.map((benefit, idx) => (
            <div
              key={benefit.number}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-4 border-t border-white/10 py-5 ${
                idx === benefits.length - 1 ? "border-b" : ""
              }`}
            >
              {/* Col 1: Feature content */}
              <div className="flex flex-col gap-2">
                <div className="flex size-7 items-center justify-center rounded-md bg-white text-sm font-semibold text-[#2555F3]">
                  {benefit.number}
                </div>
                <h3 className="font-montaga text-base text-white md:text-lg">
                  {benefit.heading}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {benefit.bullets.map((bullet, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <GradientPill />
                      <p className="font-montserrat text-xs leading-relaxed text-white/60">
                        {bullet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cols 2-4: Tick icons */}
              {[0, 1, 2].map((col) => (
                <div key={col} className="flex items-center justify-center">
                  <Image
                    src="/tick-icon.svg"
                    alt="Included"
                    width={22}
                    height={22}
                    className="size-5 object-contain"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile Layout */}
        <div className="flex flex-col gap-0 md:hidden">
          {benefits.map((benefit, idx) => (
            <div
              key={benefit.number}
              className={`flex flex-col gap-3 border-t border-white/10 py-4 ${
                idx === benefits.length - 1 ? "border-b" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-7 items-center justify-center rounded-md bg-white text-sm font-semibold text-[#2555F3]">
                  {benefit.number}
                </div>
                <h3 className="font-montaga text-base text-white">
                  {benefit.heading}
                </h3>
              </div>

              <div className="flex flex-col gap-1.5">
                {benefit.bullets.map((bullet, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <GradientPill />
                    <p className="font-montserrat text-xs leading-relaxed text-white/60">
                      {bullet}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                {columnHeaders.map((header) => (
                  <div
                    key={header}
                    className="flex items-center gap-1.5 rounded-full bg-[#272727] px-2.5 py-1"
                  >
                    <Image
                      src="/tick-icon.svg"
                      alt="Included"
                      width={14}
                      height={14}
                      className="size-3 object-contain"
                      unoptimized
                    />
                    <span className="font-montserrat text-[10px] text-white/50">
                      {header.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-8 flex items-center justify-center gap-4 md:mt-12">
          <Button
            variant="outline"
            className="flex cursor-pointer items-center gap-2 rounded-lg border-white/20 bg-transparent text-sm text-white hover:bg-white/10 hover:text-white"
          >
            <ChevronDown className="size-4" />
            <span>Show More</span>
          </Button>

          <Button className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#2555F3] px-5 py-2 text-sm text-white hover:bg-[#1e44c7]">
            <Download className="size-4" />
            <span>Download</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
