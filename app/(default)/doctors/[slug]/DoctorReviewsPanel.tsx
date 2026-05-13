"use client";

import { useCallback, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { RatingStars } from "@/components/reviews/RatingStars";

export type DoctorReviewItem = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  patientFirstName: string;
};

type DoctorReviewsPanelProps = {
  doctorId: string;
  initialItems: DoctorReviewItem[];
  initialHasMore: boolean;
  initialPage: number;
  averageRating: number;
  reviewCount: number;
};

function formatReviewDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function reviewCountLabel(count: number) {
  return `${count} ${count === 1 ? "review" : "reviews"}`;
}

export function DoctorReviewsPanel({
  doctorId,
  initialItems,
  initialHasMore,
  initialPage,
  averageRating,
  reviewCount,
}: DoctorReviewsPanelProps) {
  const [reviews, setReviews] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "5",
        });
        const response = await fetch(
          `/api/doctors/${encodeURIComponent(doctorId)}/reviews?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          setError("Failed to load more reviews.");
          return;
        }
        const data = (await response.json()) as {
          items?: DoctorReviewItem[];
          hasMore?: boolean;
          page?: number;
        };
        const nextItems = Array.isArray(data.items) ? data.items : [];
        setReviews((current) => [...current, ...nextItems]);
        setHasMore(Boolean(data.hasMore));
        setPage(typeof data.page === "number" ? data.page : nextPage);
      } catch {
        setError("Failed to load more reviews.");
      } finally {
        setLoading(false);
      }
    },
    [doctorId],
  );

  const [sentryRef, { rootRef }] = useInfiniteScroll({
    loading,
    hasNextPage: hasMore,
    onLoadMore: () => void loadReviews(page + 1),
    disabled: Boolean(error),
    rootMargin: "0px 0px 200px 0px",
  });

  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm md:p-6 lg:h-[calc(100vh-8rem)] lg:max-h-[800px]">
      <div className="flex flex-col gap-3 border-b border-[#ededed] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-montaga text-2xl font-semibold text-[#111111]">
            Patient reviews
          </h2>
          <p className="mt-1 font-montserrat text-sm text-[#5e5e5e]">
            Feedback from completed appointments.
          </p>
        </div>
        <div className="rounded-xl bg-[#fafafa] px-4 py-3 text-left sm:text-right">
          <div className="flex items-center gap-2 sm:justify-end">
            <span className="font-montaga text-3xl text-[#111111]">
              {reviewCount > 0 ? averageRating.toFixed(1) : "0.0"}
            </span>
            <RatingStars rating={averageRating} starClassName="h-5 w-5" />
          </div>
          <p className="mt-1 font-montserrat text-xs font-medium uppercase tracking-wide text-[#777777]">
            {reviewCountLabel(reviewCount)}
          </p>
        </div>
      </div>

      <div
        ref={rootRef}
        className="mt-5 lg:h-[calc(100%-7.5rem)] lg:max-h-[740px] lg:overflow-y-auto lg:pr-2"
      >
        {reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
            <p className="font-montserrat text-sm text-[#5e5e5e]">
              No reviews yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-xl border border-[#ededed] bg-white p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-montserrat text-sm font-semibold text-[#333333]">
                      {review.patientFirstName}
                    </p>
                    <p className="mt-1 font-montserrat text-xs text-[#777777]">
                      {formatReviewDate(review.createdAt)}
                    </p>
                  </div>
                  <RatingStars rating={review.rating} showValue />
                </div>
                <p className="mt-3 whitespace-pre-wrap wrap-break-word font-montserrat text-sm leading-relaxed text-[#333333]">
                  {review.comment}
                </p>
              </article>
            ))}
            {(hasMore || loading) && (
              <div
                ref={sentryRef}
                className="py-3 text-center font-montserrat text-sm text-[#5E5E5E]"
              >
                {loading ? "Loading..." : "Scroll for more"}
              </div>
            )}
            {error ? (
              <p className="py-3 text-center font-montserrat text-sm text-red-600">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
