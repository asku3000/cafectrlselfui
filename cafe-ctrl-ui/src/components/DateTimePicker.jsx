import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { CalendarBlank, Clock } from "@phosphor-icons/react";

const PRESETS = [
  { label: "Now", min: 0 },
  { label: "-15m", min: 15 },
  { label: "-30m", min: 30 },
  { label: "-1h", min: 60 },
  { label: "-1.5h", min: 90 },
  { label: "-2h", min: 120 },
];

const pad = (n) => String(n).padStart(2, "0");
const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parts = (v) => (v || "").split("T");

export default function DateTimePicker({ value, onChange, ...rest }) {
  const dateStr = parts(value)[0] || "";
  const timeStr = parts(value)[1] || "";
  const [hh, mm] = (timeStr || "00:00").split(":");
  const dateObj = dateStr ? new Date(`${dateStr}T00:00:00`) : undefined;

  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const setPreset = (minBack) => {
    const d = new Date(Date.now() - minBack * 60000);
    onChange(toLocal(d));
  };

  const setDate = (d) => {
    if (!d) return;
    const next = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${timeStr || `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`}`;
    onChange(next);
    setDateOpen(false);
  };

  const setHour = (h) => onChange(`${dateStr || toLocal(new Date()).split("T")[0]}T${pad(h)}:${mm || "00"}`);
  const setMin = (m) => onChange(`${dateStr || toLocal(new Date()).split("T")[0]}T${hh || "00"}:${pad(m)}`);

  const tid = rest["data-testid"];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setPreset(p.min)}
            data-testid={tid ? `${tid}-preset-${p.label.replace(/[.\-+ ]/g, "_")}` : undefined}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex-1 min-w-[180px] justify-start font-normal" data-testid={tid ? `${tid}-date` : undefined}>
              <CalendarBlank size={16} className="mr-2" />
              {dateObj ? format(dateObj, "PP") : <span className="text-muted-foreground">Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateObj} onSelect={setDate} initialFocus />
          </PopoverContent>
        </Popover>

        <Popover open={timeOpen} onOpenChange={setTimeOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] justify-start font-normal font-mono" data-testid={tid ? `${tid}-time` : undefined}>
              <Clock size={16} className="mr-2" />
              {hh && mm ? `${hh}:${mm}` : <span className="text-muted-foreground">Time</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex gap-2">
              <ScrollPicker label="HH" max={24} value={Number(hh) || 0} onChange={setHour} testId={tid ? `${tid}-hh` : undefined} />
              <ScrollPicker label="MM" max={60} value={Number(mm) || 0} onChange={setMin} testId={tid ? `${tid}-mm` : undefined} />
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={() => setTimeOpen(false)} data-testid={tid ? `${tid}-time-done` : undefined}>Done</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function ScrollPicker({ label, max, value, onChange, testId }) {
  const ref = useRef(null);
  const items = [];
  for (let i = 0; i < max; i++) items.push(i);

  useEffect(() => {
    const el = ref.current?.querySelector(`[data-val="${value}"]`);
    if (el) el.scrollIntoView({ block: "center" });
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <div className="text-[0.6rem] uppercase font-bold tracking-widest text-muted-foreground mb-1">{label}</div>
      <div ref={ref} className="h-40 w-14 overflow-y-auto rounded-md border border-border" data-testid={testId}>
        {items.map((n) => (
          <button
            key={n}
            type="button"
            data-val={n}
            onClick={() => onChange(n)}
            className={`w-full px-2 py-1 text-sm font-mono ${n === value ? "bg-primary text-primary-foreground font-bold" : "hover:bg-secondary"}`}
          >
            {String(n).padStart(2, "0")}
          </button>
        ))}
      </div>
    </div>
  );
}
