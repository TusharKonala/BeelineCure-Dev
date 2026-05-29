"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

type DeleteConversationDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  mode?: "delete" | "archive";
};

export function DeleteConversationDialog({
  open,
  onClose,
  onConfirm,
  mode = "delete",
}: DeleteConversationDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isArchive = mode === "archive";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, submitting]);

  if (!open || !mounted) return null;

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/40"
        aria-label="Close"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-conversation-title"
        className="relative z-10 w-full max-w-sm rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-lg"
      >
        <h2
          id="delete-conversation-title"
          className="font-montserrat text-base font-semibold text-[#333333]"
        >
          {isArchive ? "Archive conversation?" : "Delete conversation?"}
        </h2>
        <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
          {isArchive
            ? "This will move the conversation to your archived section. You can restore it anytime."
            : "This will remove the conversation from your chat list. The doctor will not be notified."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-[#e5e5e5] px-4 py-2 font-montserrat text-sm font-medium text-[#333333] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleConfirm()}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-montserrat text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              isArchive
                ? "bg-[#2555F3] hover:bg-[#1e44c7]"
                : "bg-[#b42318] hover:bg-[#912018]"
            }`}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {isArchive ? "Archive" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
