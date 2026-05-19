import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  formatJobTypeLabel,
  formatSalaryDisplay,
  jobTypeValues,
} from "@/lib/careers-schemas";

type JobType = (typeof jobTypeValues)[number];

export type JobPostingSummaryData = {
  id: string;
  title: string;
  description: string;
  type: JobType;
  isRemote: boolean;
  salaryRange: string | null;
  salaryCurrency: string | null;
};

function jobTypeBadgeClass(type: JobType) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium";
  if (type === "FULL_TIME") return `${base} border-[#d7e4ff] bg-[#eef3ff] text-[#2555F3]`;
  if (type === "PART_TIME") return `${base} border-[#ffe7b8] bg-[#fff8eb] text-[#9a6700]`;
  return `${base} border-[#e5e5e5] bg-[#f5f5f5] text-[#5e5e5e]`;
}

export function CareersJobPostingSummary({
  posting,
  truncateDescription = false,
  showApplyButton = false,
}: {
  posting: JobPostingSummaryData;
  truncateDescription?: boolean;
  showApplyButton?: boolean;
}) {
  const salary = formatSalaryDisplay(posting.salaryRange, posting.salaryCurrency);

  return (
    <div className="flex h-full flex-col">
      <div>
        <h2 className="font-montserrat text-xl font-semibold text-[#333333]">
          {posting.title}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={jobTypeBadgeClass(posting.type)}>
            {formatJobTypeLabel(posting.type)}
          </span>
          {posting.isRemote ? (
            <span className="inline-flex items-center rounded-full border border-[#d7e4ff] bg-[#eef3ff] px-2.5 py-1 font-montserrat text-xs font-medium text-[#2555F3]">
              Remote
            </span>
          ) : null}
        </div>
        {salary ? (
          <p className="mt-3 font-montserrat text-sm font-medium text-[#333333]">
            {salary}
          </p>
        ) : null}
        <p
          className={`mt-4 font-montserrat text-sm leading-relaxed text-[#333333] ${
            truncateDescription ? "line-clamp-3" : "whitespace-pre-wrap"
          }`}
        >
          {posting.description}
        </p>
      </div>
      {showApplyButton ? (
        <Button
          asChild
          className="mt-6 w-auto shrink-0 self-start cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7]"
        >
          <Link href={`/careers/${posting.id}/apply`}>Apply</Link>
        </Button>
      ) : null}
    </div>
  );
}
