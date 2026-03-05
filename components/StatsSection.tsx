import Image from "next/image";

const stats = [
  {
    icon: "/fi-sr-doctor.svg",
    main: "1000+",
    span: "Physicians & Providers",
  },
  {
    icon: "/employers.svg",
    main: "150+",
    span: "Employers / Plan Administrators",
  },
  {
    icon: "/hospital.svg",
    main: "100+",
    span: "Hospitals",
  },
  {
    icon: "/partners.svg",
    main: "20+",
    span: "Support Partners",
  },
];

export function StatsSection() {
  return (
    <section className="w-full bg-[#FAFAFA] py-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-1 gap-8 rounded-2xl bg-white px-6 py-8 sm:grid-cols-2 sm:gap-8 sm:px-10 sm:py-10 lg:grid-cols-4 lg:px-14 lg:py-12">
          {stats.map((item) => (
            <div
              key={item.span}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#F7F7F7] md:size-10">
                <Image
                  src={item.icon}
                  alt={item.span}
                  width={20}
                  height={20}
                  className="size-4 object-contain md:size-5"
                  unoptimized
                />
              </div>
              <span className="font-montaga text-2xl text-[#333333] md:text-3xl">
                {item.main}
              </span>
              <span className="font-montserrat text-xs leading-snug text-[#5E5E5E] md:text-sm">
                {item.span}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
