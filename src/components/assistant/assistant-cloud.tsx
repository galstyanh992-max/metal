"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { ProjectAssistant } from "./project-assistant";
import { cn } from "@/lib/utils";

/**
 * AssistantCloud — floating chat bubble in the bottom-right corner.
 * Always visible across the app. Opens a chat panel on click.
 */
export function AssistantCloud() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating panel */}
      <div
        className={cn(
          "fixed bottom-16 right-3 z-40 w-[calc(100vw-1.5rem)] max-w-md h-[calc(100dvh-7rem)] max-h-[600px] sm:bottom-20 sm:right-4 sm:w-[calc(100vw-2rem)] sm:h-[70vh]",
          "transition-all duration-200 origin-bottom-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <div className="w-full h-full shadow-2xl rounded-2xl overflow-hidden border border-hairline">
          <ProjectAssistant className="h-full min-h-0 rounded-none border-0" />
        </div>
      </div>

      {/* Floating bubble button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Փակել օգնականը" : "Բացել օգնականը"}
        className={cn(
          "fixed bottom-3 right-3 z-40 size-12 rounded-full shadow-lg flex items-center justify-center sm:bottom-4 sm:right-4 sm:size-14",
          "bg-primary text-primary-foreground hover:bg-primary/90 transition-all",
          "hover:scale-105 active:scale-95"
        )}
      >
        {open ? <X className="size-5 sm:size-6" /> : <Bot className="size-5 sm:size-6" />}
      </button>
    </>
  );
}
