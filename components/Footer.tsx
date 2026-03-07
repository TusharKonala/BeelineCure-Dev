import Image from "next/image";
import Link from "next/link";

type FooterProps = {
  extraTopPadding?: boolean;
};

export function Footer({ extraTopPadding = false }: FooterProps) {
  return (
    <footer
      className={`bg-white ${
        extraTopPadding ? "pt-16 sm:pt-20 md:pt-28 lg:pt-32" : "pt-0"
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 pt-6 pb-4 text-center md:pt-8 md:pb-6">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center">
          <Image
            src="/Logo.svg"
            alt="Clinivo logo"
            width={160}
            height={40}
            className="h-5 w-auto md:h-6"
          />
        </Link>

        {/* Description */}
        <p className="max-w-2xl text-sm leading-relaxed text-[#5E5E5E] md:text-base">
          We are a network of motivated individuals. Some of us have a long
          history of building health care organizations and some of us are
          coming into this work with a fresh eye unburdened by the past. Our
          founding effort is being supported by the Wiggins Foundation and
          individual donors. We are borrowing from the examples of Mozilla and
          many healthcare organizations who amplify their mission through
          creative structuring to attract the participation of entire
          industries.
        </p>

        {/* Icons + Divider Wrapper */}
        <div className="flex flex-col items-center gap-4 w-fit">
          {/* Gradient Divider */}
          <div
            className="h-[2px] w-full"
            style={{
              background:
                "linear-gradient(90deg, #6366F1 0%, #A855F7 49%, #EC4899 100%)",
            }}
          />

          {/* Social Icons */}
          <div className="flex items-center justify-center gap-6">
            {[
              { src: "/pinterest.svg", alt: "Pinterest" },
              { src: "/instagram.svg", alt: "Instagram" },
              { src: "/linkedin.svg", alt: "LinkedIn" },
              { src: "/twitter.svg", alt: "Twitter" },
              { src: "/facebook.svg", alt: "Facebook" },
            ].map((icon) => (
              <a
                key={icon.alt}
                href="#"
                aria-label={icon.alt}
                className="cursor-pointer transition-opacity hover:opacity-75"
              >
                <img src={icon.src} alt={icon.alt} className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom Legal Row */}
        <div className="mt-4 flex w-full flex-col items-center gap-2 border-t border-zinc-200 pt-4 text-sm text-[#5E5E5E] md:flex-row md:justify-between">
          <button type="button" className="cursor-pointer hover:text-black">
            Privacy Policy
          </button>

          <p className="text-center">© Dummy 2026. All Rights Reserved</p>

          <button type="button" className="cursor-pointer hover:text-black">
            Terms &amp; Conditions
          </button>
        </div>
      </div>
    </footer>
  );
}
