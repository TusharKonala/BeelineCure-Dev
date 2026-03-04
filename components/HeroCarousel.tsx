"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

export function HeroCarousel() {
  return (
    <Carousel opts={{ loop: false }} className="w-full">
      <CarouselContent className="ml-0">
        {/* Slide 1 */}
        <CarouselItem className="relative h-[50vh] min-h-[360px] pl-0 md:h-[70vh] lg:h-[80vh]">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
          >
            <source src="/slide1.mp4" type="video/mp4" />
          </video>

          <div className="absolute inset-0 bg-black/40" />

          <div className="relative z-10 flex h-full mx-auto max-w-7xl flex-col justify-center gap-3 px-6 md:gap-6 md:px-16 lg:px-24">
            <h1 className="text-2xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
              Where
              <br />
              Cooperati<span className="font-bold">ON</span>
              <br />
              Meets
              <br />
              Innovati<span className="font-bold">ON</span>
            </h1>

            <p className="max-w-md text-xs font-normal leading-relaxed text-white/90 md:text-sm">
              America&apos;s first health network cooperative. It is a
              collaborative and member-owned organization that aims to
              revolutionize healthcare delivery.
            </p>

            <Button className="flex w-fit cursor-pointer items-center gap-2 rounded-full border border-black bg-[#2555F3] px-4 py-1.5 text-xs text-white hover:bg-[#1e44c7] md:px-5 md:py-2 md:text-sm">
              <span>Become a Charter Member</span>
              <ArrowRight className="size-3.5 md:size-4" />
            </Button>

            <div className="flex items-center gap-3">
              <CarouselPrevious className="static translate-y-0 border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/25 hover:text-white" />
              <CarouselNext className="static translate-y-0 border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/25 hover:text-white" />
            </div>
          </div>
        </CarouselItem>

        {/* Slide 2 – video only */}
        <CarouselItem className="relative h-[50vh] min-h-[360px] pl-0 md:h-[70vh] lg:h-[80vh]">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
          >
            <source src="/slide2.mp4" type="video/mp4" />
          </video>

          <div className="relative z-10 flex h-full mx-auto max-w-7xl items-center px-6 md:px-16 lg:px-24">
            <div className="flex items-center gap-3">
              <CarouselPrevious className="static translate-y-0 border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/25 hover:text-white" />
              <CarouselNext className="static translate-y-0 border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/25 hover:text-white" />
            </div>
          </div>
        </CarouselItem>
      </CarouselContent>
    </Carousel>
  );
}
