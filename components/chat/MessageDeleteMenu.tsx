"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
const MESSAGE_DELETE_FOR_EVERYONE_MS = 15 * 60 * 1000;

type MessageDeleteMenuProps = {
  anchorX: number;
  anchorY: number;
  messageCreatedAt: string;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
  onClose: () => void;
};

export function MessageDeleteMenu({
  anchorX,
  anchorY,
  messageCreatedAt,
  onDeleteForEveryone,
  onDeleteForMe,
  onClose,
}: MessageDeleteMenuProps) {
  const canDeleteEveryone =
    Date.now() - new Date(messageCreatedAt).getTime() <= MESSAGE_DELETE_FOR_EVERYONE_MS;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const menu = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 min-w-[200px] overflow-hidden rounded-xl border border-[#e5e5e5] bg-white py-1 shadow-lg"
        style={{
          left: Math.min(anchorX, window.innerWidth - 220),
          top: Math.min(anchorY, window.innerHeight - 120),
        }}
        role="menu"
      >
        {canDeleteEveryone && (
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left font-montserrat text-sm text-[#b42318] hover:bg-[#fff1f1]"
            onClick={() => {
              onDeleteForEveryone();
              onClose();
            }}
          >
            Delete for Everyone
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2.5 text-left font-montserrat text-sm text-[#333333] hover:bg-[#f5f5f5]"
          onClick={() => {
            onDeleteForMe();
            onClose();
          }}
        >
          Delete for Me
        </button>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}
