"use client"

import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker"

import { cn } from "@/lib/utils"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar p-3 [--cell-size:--spacing(8)]",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          "size-(--cell-size) inline-flex items-center justify-center rounded-md p-0 select-none",
          "text-vt-dim/60 hover:text-vt hover:bg-vt/10 transition-colors",
          "aria-disabled:opacity-30 aria-disabled:pointer-events-none",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          "size-(--cell-size) inline-flex items-center justify-center rounded-md p-0 select-none",
          "text-vt-dim/60 hover:text-vt hover:bg-vt/10 transition-colors",
          "aria-disabled:opacity-30 aria-disabled:pointer-events-none",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          "select-none font-medium text-sm text-slate-200",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-vt-dim/40 rounded-md flex-1 font-normal text-[0.8rem] select-none",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-1", defaultClassNames.week),
        day: cn(
          "relative w-full h-full p-0 text-center group/day aspect-square select-none",
          defaultClassNames.day
        ),
        today: cn(
          "rounded-md",
          defaultClassNames.today
        ),
        outside: cn(
          "text-slate-600 aria-selected:text-slate-500",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-slate-700 opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }
          return (
            <ChevronRightIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const isSelected = modifiers.selected
  const isToday = modifiers.today
  const isOutside = modifiers.outside

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected={isSelected}
      className={cn(
        "flex aspect-square size-auto w-full min-w-(--cell-size) items-center justify-center",
        "rounded-md text-sm font-normal leading-none transition-colors",
        "outline-none",
        // Default state
        "text-slate-300 hover:bg-vt/15 hover:text-vt",
        // Selected
        isSelected && "bg-vt text-white hover:bg-vt-hover hover:text-white",
        // Today (not selected)
        isToday && !isSelected && "ring-1 ring-vt/30 text-vt",
        // Outside days
        isOutside && !isSelected && "text-slate-600 hover:text-slate-400 hover:bg-vt/5",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
