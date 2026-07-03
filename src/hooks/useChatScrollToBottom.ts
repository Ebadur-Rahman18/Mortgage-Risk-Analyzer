import { useState, useCallback, useEffect, useRef } from "react";

const SCROLL_AT_BOTTOM_THRESHOLD_PX = 20;

/**
 * Run after the next paint so that scrollHeight reflects newly rendered content.
 */
function runAfterRender(fn: () => void): () => void {
  let raf1 = 0;
  let raf2 = 0;
  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      fn();
    });
  });
  return () => {
    if (raf1) cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
  };
}

function runAfterRenderTwice(fn: () => void): () => void {
  let cancel2: (() => void) | null = null;
  const cancel1 = runAfterRender(() => {
    cancel2 = runAfterRender(fn);
  });
  return () => {
    cancel1();
    cancel2?.();
  };
}

/**
 * ChatGPT-style scroll behavior for chat UIs.
 * - Tracks whether the user is at the bottom of the conversation (within threshold).
 * - Only shows "scroll to bottom" arrow when user has scrolled up.
 * - Auto-scrolls to bottom when new messages arrive only if user was already at bottom.
 * - Uses deferred scroll after render so the view reaches the true bottom (fixes cut-off).
 */
export function useChatScrollToBottom(messageCount: number, isLoading: boolean) {
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    // Prefer scrolling a sentinel into view; this is more reliable when content height changes
    // after render (markdown layout, fonts, images, typing indicator, etc.).
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }

    const root = scrollRootRef.current;
    if (!root) return;
    const viewport = root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, []);

  /** Call after state updates (e.g. new message or loading) so scroll runs after DOM has rendered. */
  const scrollToBottomAfterRender = useCallback(() => {
    // Schedule after the DOM updates so scrollHeight/sentinel position is correct.
    // Double scheduling helps when layout shifts across multiple frames.
    runAfterRenderTwice(scrollToBottom);
    window.setTimeout(scrollToBottom, 0);
  }, [scrollToBottom]);

  // Attach scroll listener to viewport; re-run when content might have changed (messageCount, isLoading)
  // so we re-query viewport and re-check position after messages render.
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const viewport = root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (!viewport) return;

    const handleScroll = () => {
      const atBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= SCROLL_AT_BOTTOM_THRESHOLD_PX;
      setIsAtBottom(atBottom);
    };

    handleScroll();
    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [messageCount, isLoading]);

  // When user is at bottom and new content arrives, auto-scroll after render so we hit true bottom.
  useEffect(() => {
    if (!isAtBottom) return;
    const cancel = runAfterRenderTwice(scrollToBottom);
    const t = window.setTimeout(scrollToBottom, 0);
    return () => {
      cancel();
      window.clearTimeout(t);
    };
  }, [messageCount, isLoading, isAtBottom, scrollToBottom]);

  return { scrollRootRef, bottomRef, isAtBottom, scrollToBottom, scrollToBottomAfterRender };
}
