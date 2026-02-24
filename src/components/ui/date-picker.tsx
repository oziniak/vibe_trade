'use client';

import { useState } from 'react';
import {
  format,
  parse,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
  getDay,
  setYear,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerProps {
  /** ISO date string: "2024-01-15" */
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  return parse(iso, 'yyyy-MM-dd', new Date());
}

function dateToIso(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i); // 2017–2026

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(
    () => isoToDate(value) ?? new Date()
  );

  const selected = isoToDate(value);

  const handleSelect = (date: Date) => {
    onChange(dateToIso(date));
    setOpen(false);
    setShowYearPicker(false);
  };

  const handleYearSelect = (year: number) => {
    setViewMonth(setYear(viewMonth, year));
    setShowYearPicker(false);
  };

  const handleToday = () => {
    const today = new Date();
    setViewMonth(today);
    handleSelect(today);
  };

  // Build day grid
  const monthStart = startOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(viewMonth) });
  const startPad = getDay(monthStart); // 0 = Sunday
  const currentYear = new Date().getFullYear();

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setShowYearPicker(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-6 w-full flex items-center justify-between text-left
            bg-transparent text-[13px] sm:text-sm
            border-none p-0 outline-none
            hover:text-vt transition-colors ${className ?? ''}`}
        >
          <span className={value ? 'text-slate-200' : 'text-slate-500'}>
            {selected ? format(selected, 'dd.MM.yyyy') : 'Pick date'}
          </span>
          <CalendarDays className="size-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[252px] p-0 border-vt-line/60 bg-vt-bg2 shadow-[0_8px_40px_-8px_var(--vt-glow)]
          flex flex-col"
        style={{ height: 338 }}
        align="start"
        sideOffset={8}
      >
        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-vt-line/20">
          <button
            type="button"
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            disabled={showYearPicker}
            className="size-7 flex items-center justify-center rounded-md
              text-slate-500 hover:text-vt hover:bg-vt/10 transition-colors
              disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="flex items-center gap-1 text-sm font-medium text-slate-200
              hover:text-vt transition-colors px-2 py-1 rounded-md hover:bg-vt/10"
          >
            {format(viewMonth, 'MMMM yyyy')}
            <ChevronDown
              className={`size-3.5 text-slate-500 transition-transform duration-200 ${
                showYearPicker ? 'rotate-180 text-vt' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            disabled={showYearPicker}
            className="size-7 flex items-center justify-center rounded-md
              text-slate-500 hover:text-vt hover:bg-vt/10 transition-colors
              disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {showYearPicker ? (
          /* ── Year Grid ─────────────────────────────── */
          <div className="flex-1 grid grid-cols-4 gap-1 p-3">
            {YEARS.map((year) => {
              const isSelectedYear = viewMonth.getFullYear() === year;
              const isCurrentYear = currentYear === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleYearSelect(year)}
                  className={`py-1.5 rounded-md text-sm font-medium transition-colors aspect-square items-center ${
                    isSelectedYear
                      ? 'bg-vt text-white'
                      : isCurrentYear
                      ? 'text-vt ring-1 ring-vt/30 hover:bg-vt/15'
                      : 'text-slate-300 hover:bg-vt/10 hover:text-vt'
                  }`}
                >
                  {year}
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Day Grid ──────────────────────────────── */
          <div className="flex flex-col flex-1">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 px-3 pt-2">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="h-8 flex items-center justify-center
                    text-[0.72rem] text-slate-600 font-normal select-none"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 px-3 pb-2">
              {Array.from({ length: startPad }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map((day) => {
                const sel = selected ? isSameDay(day, selected) : false;
                const tod = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelect(day)}
                    className={`aspect-square flex items-center justify-center
                      rounded-md text-sm transition-colors ${
                        sel
                          ? 'bg-vt text-white hover:bg-vt-hover'
                          : tod
                          ? 'text-vt ring-1 ring-vt/30 hover:bg-vt/15'
                          : 'text-slate-300 hover:bg-vt/15 hover:text-vt'
                      }`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {/* Today button */}
            <div className="mt-auto px-3 pb-3 pt-1 border-t border-vt-line/20">
              <button
                type="button"
                onClick={handleToday}
                className="w-full py-1.5 rounded-md text-xs font-medium
                  text-vt-dim/80 hover:text-vt hover:bg-vt/10
                  border border-vt-line/30 hover:border-vt/40
                  transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
