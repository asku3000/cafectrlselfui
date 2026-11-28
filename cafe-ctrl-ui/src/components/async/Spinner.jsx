import React from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

/** The one spinner used everywhere (buttons, page loaders). Hidden from screen readers; use a label next to it. */
export default function Spinner({ size = 16, className = "" }) {
  return (
    <span aria-hidden="true" data-testid="spinner" className={cn("inline-flex shrink-0", className)}>
      <CircleNotch size={size} weight="bold" className="animate-spin" />
    </span>
  );
}
