import React from "react";
import { format } from "date-fns";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { CalendarBlank } from "@phosphor-icons/react";

/**
 * DatePicker — shadcn calendar (date only). Auto-closes on selection.
 * value/onChange use "YYYY-MM-DD" string.
 */
export default function DatePicker({ value, onChange, placeholder = "Pick a date", className = "", ...rest }) {
  const [open, setOpen] = React.useState(false);
  const dateObj = value ? new Date(`${value}T00:00:00`) : undefined;
  const pad = (n) => String(n).padStart(2, "0");
  const setDate = (d) => {
    if (!d) return;
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`justify-start font-normal ${className}`}
          data-testid={rest["data-testid"]}
        >
          <CalendarBlank size={16} className="mr-2" />
          {dateObj ? format(dateObj, "PP") : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={dateObj} onSelect={setDate} initialFocus />
      </PopoverContent>
    </Popover>
  );
}
