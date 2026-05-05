"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

const OUTPUT_SIZE_PX = 512;
const OUTPUT_MIME = "image/jpeg";
const OUTPUT_QUALITY = 0.92;

type Props = {
  /** Source image URL — typically a `URL.createObjectURL(file)` blob URL. */
  imageUrl: string;
  /** Original file name; used to derive the cropped output file name. */
  originalFileName?: string;
  /** Called with the cropped square image as a `File` (JPEG, 512x512). */
  onCrop: (file: File) => void;
  /** Called when the user dismisses the cropper without saving. */
  onCancel: () => void;
};

function buildInitialCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop(
      { unit: "%", width: 80 },
      1,
      width,
      height,
    ),
    width,
    height,
  );
}

async function cropToFile(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  fileNameStem: string,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE_PX;
  canvas.height = OUTPUT_SIZE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sx = pixelCrop.x * scaleX;
  const sy = pixelCrop.y * scaleY;
  const sWidth = pixelCrop.width * scaleX;
  const sHeight = pixelCrop.height * scaleY;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    sx,
    sy,
    sWidth,
    sHeight,
    0,
    0,
    OUTPUT_SIZE_PX,
    OUTPUT_SIZE_PX,
  );

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      OUTPUT_MIME,
      OUTPUT_QUALITY,
    );
  });

  return new File([blob], `${fileNameStem}.jpg`, {
    type: OUTPUT_MIME,
    lastModified: Date.now(),
  });
}

/**
 * Modal cropper for the doctor profile photo. Constrains to a 1:1 square so
 * the cropped image renders consistently on the public doctor cards / listing.
 * Output is a 512x512 JPEG at quality 0.92.
 */
export function DoctorPhotoCropper({
  imageUrl,
  originalFileName,
  onCrop,
  onCancel,
}: Props) {
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const onImageLoaded = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const initial = buildInitialCrop(img.width, img.height);
      setCrop(initial);
    },
    [],
  );

  async function handleSave() {
    if (!imageRef.current || !completedCrop) {
      setError("Please select a crop area first.");
      return;
    }
    if (completedCrop.width < 8 || completedCrop.height < 8) {
      setError("Crop area is too small. Please drag a larger square.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const stem = (originalFileName ?? "doctor-photo")
        .replace(/\.[^./\\]+$/, "")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .toLowerCase()
        .slice(0, 64) || "doctor-photo";
      const file = await cropToFile(imageRef.current, completedCrop, stem);
      onCrop(file);
    } catch (err) {
      console.error("[DoctorPhotoCropper] crop failed:", err);
      setError("Could not save the crop. Please try a different image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doctor-photo-cropper-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/50"
        aria-label="Close cropper"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        className="relative z-1 w-full max-w-lg rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="doctor-photo-cropper-title"
          className="font-montaga text-xl font-semibold text-[#111111]"
        >
          Crop your profile photo
        </h2>
        <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">
          Drag the square to fit your face. The image will be saved as a
          512×512 JPEG.
        </p>

        <div className="mt-4 flex items-center justify-center bg-[#fafafa] p-2">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            keepSelection
            minWidth={32}
            minHeight={32}
            circularCrop={false}
          >
            {/* The browser's native <img> is required by react-image-crop. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Photo to crop"
              onLoad={onImageLoaded}
              style={{ maxHeight: "60vh", maxWidth: "100%" }}
            />
          </ReactCrop>
        </div>

        {error ? (
          <p className="mt-3 font-montserrat text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            className="cursor-pointer rounded-xl border border-[#e5e5e5] bg-white px-4 py-2.5 font-montserrat text-sm font-medium text-[#333333] transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-xl bg-[#2555F3] px-4 py-2.5 font-montserrat text-sm font-medium text-white transition-colors hover:bg-[#1d44c6] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleSave()}
            disabled={busy || !completedCrop}
          >
            {busy ? "Saving..." : "Use this photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
