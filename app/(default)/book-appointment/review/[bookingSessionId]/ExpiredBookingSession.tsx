import Link from "next/link";

export function ExpiredBookingSession({ doctorId }: { doctorId: string }) {
  return (
    <>
      <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
        Booking session expired
      </h1>
      <p className="mt-3 font-montserrat text-sm text-[#5E5E5E] md:text-base">
        For your security, each checkout session is only valid for 10 minutes.
        This one has expired, so you will need to choose your slot again and
        start a new booking.
      </p>
      <Link
        href={`/book-appointment/${doctorId}`}
        className="mt-6 inline-block font-montserrat text-sm font-medium text-[#2555F3] underline underline-offset-2 hover:text-[#1a45d9]"
      >
        Book again
      </Link>
    </>
  );
}
