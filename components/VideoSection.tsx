import Image from "next/image";
import { Button } from "@/components/ui/button";

export function VideoSection() {
  return (
    <section className="relative w-full overflow-visible bg-black h-[520px] sm:h-[550px] md:h-[38rem] lg:h-[805px]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(99,102,241,0.14) 0%, rgba(168,85,247,0.12) 49%, rgba(236,72,153,0.14) 100%)",
        }}
      />

      <div className="relative mx-auto h-full w-full max-w-[18.125rem] px-4 sm:max-w-sm sm:px-6 md:max-w-6xl md:px-8 lg:px-8">
        <div className="absolute inset-x-0 -bottom-8 md:-bottom-18 lg:-bottom-16 flex w-full flex-col items-center text-center">
          <h2 className="font-montaga text-xl text-white sm:text-2xl md:text-3xl lg:text-4xl">
            Embracing Changing World
          </h2>

          <p className="mt-3 max-w-2xl font-montserrat text-sm text-white/90 sm:mt-4 md:text-base">
            Natural synthesis of ideas already changing our lives. We looked at
            blockchain projects to inform our views on decentralization and
            community building. We compared those ideas to the long history of
            Cooperatives and integrated the best of both approaches. We
            evaluated advanced cryptography techniques that have application to
            the verification and security challenges in health care. We continue
            to embrace A.I.
          </p>

          <Button className="mt-4 rounded-full bg-[#2555F3] px-5 py-2.5 text-sm text-white hover:bg-[#1e44c7] sm:mt-6 sm:px-6 md:text-base">
            Join Us
          </Button>

          <div className="mt-6 w-full max-w-full sm:mt-8 md:max-w-3xl lg:max-w-4xl">
            <div className="relative aspect-video overflow-hidden rounded-xl shadow-2xl sm:rounded-2xl md:rounded-3xl">
              <Image
                src="/thumbnailCropped.png"
                alt="Video thumbnail"
                fill
                className="object-cover"
                unoptimized
              />

              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src="/yt-play-icon.svg"
                  alt="Play video"
                  width={80}
                  height={80}
                  className="size-14 drop-shadow-lg md:size-20"
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
