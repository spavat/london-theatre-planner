import { format, parseISO, startOfToday } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface TripRange {
  from: string; // YYYY-MM-DD
  to: string;
}

interface Props {
  value: TripRange | null;
  onChange: (range: TripRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const selected: DateRange | undefined = value ? { from: parseISO(value.from), to: parseISO(value.to) } : undefined;
  const label = value
    ? `${format(parseISO(value.from), "EEE d MMM")} – ${format(parseISO(value.to), "EEE d MMM yyyy")}`
    : "Pick your travel dates";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal">
          <CalendarIcon />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          weekStartsOn={1}
          defaultMonth={selected?.from}
          selected={selected}
          disabled={{ before: startOfToday() }}
          onSelect={(range) => {
            if (range?.from) {
              onChange({ from: format(range.from, "yyyy-MM-dd"), to: format(range.to ?? range.from, "yyyy-MM-dd") });
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
