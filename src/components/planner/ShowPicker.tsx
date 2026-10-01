import { CheckIcon } from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { ShowSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";

interface Props {
  shows: ShowSummary[];
  selected: number[];
  onToggle: (id: number) => void;
}

export function ShowPicker({ shows, selected, onToggle }: Props) {
  return (
    <Command className="h-auto rounded-lg border">
      <CommandInput placeholder="Search shows or venues…" />
      <CommandList className="max-h-[28rem]">
        <CommandEmpty>No shows playing during these dates.</CommandEmpty>
        {shows.map((show) => {
          const isSelected = selected.includes(show.id);
          return (
            <CommandItem
              key={show.id}
              value={`${show.id}`}
              keywords={[show.title, show.venue ?? ""]}
              onSelect={() => onToggle(show.id)}
              className="gap-3"
            >
              <div
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                  isSelected && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {isSelected && <CheckIcon className="size-3" />}
              </div>
              {show.imageUrl ? (
                <img src={show.imageUrl} alt="" loading="lazy" className="h-8 w-16 shrink-0 rounded object-cover" />
              ) : (
                <div className="h-8 w-16 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{show.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {show.venue} · {show.performanceCount} perf.
                </div>
              </div>
            </CommandItem>
          );
        })}
      </CommandList>
    </Command>
  );
}
