import Image from "next/image";

const features = [
  {
    icon: "/fi-sr-diamond.svg",
    heading: "Building",
    description:
      "A peer-to-peer cooperative network linking providers and purchasers of health care services.",
  },
  {
    icon: "/fi-sr-lock.svg",
    heading: "Fostering",
    description: "Innovation, transparency, efficiency and trust.",
  },
  {
    icon: "/fi-sr-tree-christmas.svg",
    heading: "Like",
    description:
      "Redwoods sharing roots, we gain strength from our connectedness.",
  },
];

export function FeaturesSection() {
  return (
    <section className="flex w-full flex-col items-center bg-[#fafafa] px-4 py-6 md:px-8 md:py-8 lg:py-10">
      {/* Item 1 – Feature Panel */}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 rounded-xl bg-white px-5 py-4 sm:flex-row sm:gap-6 sm:px-10 sm:py-8 lg:px-14">
        {features.map((feature) => (
          <div
            key={feature.heading}
            className="flex flex-1 flex-col items-start gap-1.5 sm:gap-3"
          >
            <div className="flex size-6 items-center justify-center rounded bg-[#f7f7f7] p-1 sm:size-7 sm:p-1.5">
              <Image
                src={feature.icon}
                alt={feature.heading}
                width={16}
                height={16}
                className="size-3 object-contain sm:size-3.5"
                unoptimized
              />
            </div>

            <h3 className="font-montaga text-xl text-[#333333] md:text-2xl lg:text-3xl">
              {feature.heading}
            </h3>

            <p className="font-montserrat text-xs leading-relaxed text-[#333333] md:text-sm">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Item 2 – Text Block */}
      <div className="mt-6 flex max-w-3xl flex-col items-center gap-2 text-center md:mt-8">
        <h2 className="font-montaga text-xl leading-snug text-[#333333] text-shadow-soft md:text-2xl lg:text-3xl">
          Transforming Healthcare with Transparency and Innovation
        </h2>

        <p className="font-montserrat max-w-2xl text-xs leading-relaxed text-[#5E5E5E] text-shadow-soft md:text-sm">
          This cooperative is intended to foster collaboration, efficiency, and
          a patient-centered approach to healthcare services, and distinguishes
          itself as a novel and pioneering initiative in the American healthcare
          landscape.
        </p>
      </div>
    </section>
  );
}
