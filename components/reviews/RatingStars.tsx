import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type RatingStarsProps = {
  rating: number;
  showValue?: boolean;
  className?: string;
  starClassName?: string;
};

export function RatingStars({
  rating,
  showValue = false,
  className,
  starClassName,
}: RatingStarsProps) {
  const roundedRating = Math.round(rating);
  const label = `${rating.toFixed(1)} out of 5 stars`;

  return (
    <div className={cn("flex items-center gap-1", className)} aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => {
        const isFilled = index < roundedRating;
        return (
          <Star
            key={index}
            className={cn(
              "h-4 w-4",
              isFilled ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[#d4d4d4]",
              starClassName,
            )}
            aria-hidden="true"
          />
        );
      })}
      {showValue ? (
        <span className="ml-1 font-montserrat text-xs text-[#5e5e5e]">
          {rating.toFixed(1)}/5
        </span>
      ) : null}
    </div>
  );
}
