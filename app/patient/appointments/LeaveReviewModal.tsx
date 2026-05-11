"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

type SubmittedReview = {
  id: string;
  rating: number;
};

type LeaveReviewModalProps = {
  appointmentId: string;
  doctorName: string;
  onClose: () => void;
  onSubmitted: (review: SubmittedReview) => void;
};

export function LeaveReviewModal({
  appointmentId,
  doctorName,
  onClose,
  onSubmitted,
}: LeaveReviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, submitting]);

  async function submitReview() {
    if (submitting) return;
    const trimmedComment = comment.trim();
    if (rating < 1 || rating > 5) {
      setError("Choose a star rating.");
      return;
    }
    if (!trimmedComment) {
      setError("Add a short comment about your consultation.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/patient/appointments/${encodeURIComponent(appointmentId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, comment: trimmedComment }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        review?: SubmittedReview;
      };
      if (!response.ok || !data.review) {
        setError(
          data.error ?? "Could not submit your review. Please try again.",
        );
        return;
      }
      onSubmitted(data.review);
    } catch {
      setError("Could not submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-review-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label="Close dialog"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div
        className="relative z-1 w-full max-w-md rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="leave-review-title"
          className="font-montaga text-xl font-semibold text-[#333333]"
        >
          Leave a review
        </h2>
        <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
          Share your experience with {doctorName}.
        </p>

        <div className="mt-6">
          <p className="font-montserrat text-sm font-medium text-[#333333]">
            Rating
          </p>
          <div
            className="mt-2 flex gap-1"
            role="radiogroup"
            aria-label="Rating"
          >
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              const selected = value <= rating;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                  className="cursor-pointer rounded-md p-1 text-[#d4d4d4] outline-none transition-colors focus:ring-2 focus:ring-[#2555F3]/30"
                  onClick={() => {
                    setRating(value);
                    setError(null);
                  }}
                >
                  <Star
                    className={`h-7 w-7 ${
                      selected ? "fill-[#f59e0b] text-[#f59e0b]" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <label
            htmlFor="review-comment"
            className="font-montserrat text-sm font-medium text-[#333333]"
          >
            Comment
          </label>
          <textarea
            id="review-comment"
            value={comment}
            maxLength={1000}
            rows={5}
            onChange={(event) => {
              setComment(event.target.value);
              setError(null);
            }}
            placeholder="Tell others what went well..."
            className="mt-2 w-full resize-none rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] shadow-sm outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
          />
          <p className="mt-1 text-right font-montserrat text-xs text-[#777777]">
            {comment.length}/1000
          </p>
        </div>

        {error ? (
          <p className="mt-4 font-montserrat text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer rounded-xl font-montserrat"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer rounded-xl font-montserrat"
            disabled={submitting}
            onClick={() => void submitReview()}
          >
            {submitting ? "Submitting..." : "Submit review"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
