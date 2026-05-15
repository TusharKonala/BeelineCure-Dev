import { z } from "zod";

export const jobTypeValues = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const;

export const jobTypeSchema = z.enum(jobTypeValues);

export const createJobPostingSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(10000),
  type: jobTypeSchema,
  isRemote: z.boolean().default(false),
  salaryRange: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateJobPostingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  type: jobTypeSchema.optional(),
  isRemote: z.boolean().optional(),
  salaryRange: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});

const resumeUrlSchema = z
  .string()
  .url("Resume link must be a valid URL")
  .refine((url) => url.startsWith("https://"), {
    message: "Resume link must use HTTPS",
  });

export const jobApplicationSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.email("Invalid email address"),
  phone: z
    .string()
    .min(8, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number"),
  coverNote: z.string().max(2000).optional().nullable(),
  resumeUrl: resumeUrlSchema,
});

export function formatJobTypeLabel(type: (typeof jobTypeValues)[number]) {
  switch (type) {
    case "FULL_TIME":
      return "Full-time";
    case "PART_TIME":
      return "Part-time";
    case "CONTRACT":
      return "Contract";
    default:
      return type;
  }
}
