"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MODAL_EXIT_DURATION_MS = 200;

/**
 * Coordinates modal mount/unmount with enter and exit CSS animations so both
 * internal close actions and external `isOpen=false` updates animate out smoothly.
 */
export function useModalAnimation(isOpen: boolean, onClose: () => void) {
  const [rendered, setRendered] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedBySelfRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      closedBySelfRef.current = false;
      setClosing(false);
      setRendered(true);
      return;
    }

    if (!rendered) return;

    if (closedBySelfRef.current) {
      closedBySelfRef.current = false;
      setRendered(false);
      setClosing(false);
      return;
    }

    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setRendered(false);
      setClosing(false);
      closeTimerRef.current = null;
    }, MODAL_EXIT_DURATION_MS);
  }, [isOpen, rendered]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    if (closeTimerRef.current) return;
    closedBySelfRef.current = true;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onCloseRef.current();
    }, MODAL_EXIT_DURATION_MS);
  }, []);

  return { rendered, closing, handleClose };
}
