export const jobPostingSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  isRemote: true,
  salaryRange: true,
  salaryCurrency: true,
  isActive: true,
  createdAt: true,
} as const;

export type JobPostingRecord = {
  id: string;
  title: string;
  description: string;
  type: string;
  isRemote: boolean;
  salaryRange: string | null;
  salaryCurrency: string | null;
  isActive: boolean;
  createdAt: Date;
};

export function mapJobPosting(p: JobPostingRecord) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
  };
}
