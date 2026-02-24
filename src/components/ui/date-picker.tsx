'use client';

import { useState } from 'react';
import { format, parse } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface DatePickerProps {
  /** ISO date string: "2024-01-15" */
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
}

/** Converts "2024-01-15" → Date object */
function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  return parse(iso, 'yyyy-MM-dd', new Date());
}

/** Converts Date → "2024-01-15" */
function dateToIso(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-6 w-full flex items-center justify-between text-left
            bg-transparent text-[13px] sm:text-sm text-slate-200
            border-none p-0 outline-none
            hover:text-vt transition-colors ${className ?? ''}`}
        >
          <span className={value ? 'text-slate-200' : 'text-slate-500'}>
            {selected ? format(selected, 'dd.MM.yyyy') : 'Pick date'}
          </span>
          <CalendarDays className="size-3.5 text-vt-line shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-vt-line/60 bg-vt-bg2 shadow-[0_8px_40px_-8px_var(--vt-glow)]"
        align="start"
        sideOffset={8}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(dateToIso(date));
              setOpen(false);
            }
          }}
          defaultMonth={selected}
          className="bg-transparent"
        />
      </PopoverContent>
    </Popover>
  );
}
