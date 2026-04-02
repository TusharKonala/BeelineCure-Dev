import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientAppointmentsLoading() {
  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col items-start gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
              <div className="min-w-0 md:flex-1">
                <Skeleton className="h-8 w-40 bg-[#e5e5e5] md:h-9" />
                <Skeleton className="mt-1 h-4 w-48 max-w-full bg-[#e5e5e5] md:hidden" />
              </div>
              <Skeleton className="hidden h-10 w-36 shrink-0 rounded-xl bg-[#e5e5e5] md:block" />
            </div>
            <Skeleton className="h-4 w-72 max-w-full bg-[#e5e5e5]" />
          </div>

          <div className="mt-6 sm:hidden">
            <Skeleton className="h-10 w-full rounded-xl bg-[#e5e5e5]" />
          </div>

          <div className="mt-6 hidden flex-row gap-3 sm:flex">
            <Skeleton className="h-10 w-32 rounded-xl bg-[#e5e5e5]" />
            <Skeleton className="h-10 w-32 rounded-xl bg-[#e5e5e5]" />
            <Skeleton className="h-10 w-32 rounded-xl bg-[#e5e5e5]" />
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8 sm:gap-y-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
              <Skeleton className="h-4 w-20 bg-[#e5e5e5]" />
              <Skeleton className="h-10 w-full rounded-xl bg-[#e5e5e5]" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
              <Skeleton className="h-4 w-16 bg-[#e5e5e5]" />
              <Skeleton className="h-10 w-full rounded-xl bg-[#e5e5e5]" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Skeleton className="h-6 w-48 bg-[#e5e5e5]" />
                    <Skeleton className="mt-2 h-4 w-40 bg-[#e5e5e5]" />
                    <div className="mt-3 flex flex-col gap-1 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
                      <Skeleton className="h-4 w-56 bg-[#e5e5e5]" />
                      <Skeleton className="h-4 w-44 bg-[#e5e5e5]" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full bg-[#e5e5e5]" />
                    <Skeleton className="h-6 w-20 rounded-full bg-[#e5e5e5]" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-xl bg-[#e5e5e5]" />
                  <Skeleton className="h-8 w-20 rounded-xl bg-[#e5e5e5]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
