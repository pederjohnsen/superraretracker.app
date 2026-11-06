"use client";

import { useId, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PLATFORM_LABEL } from "@/lib/platform";
import { isPlatformFilter, isSortOrder, SORT_OPTIONS, type PlatformFilter, type SortOrder } from "@/lib/release-list";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  search: string;
  onSearchChange: (search: string) => void;
  /** The platforms that have releases, in display order ("ALL" is added here). */
  platforms: Exclude<PlatformFilter, "ALL">[];
  platform: PlatformFilter;
  onPlatformChange: (platform: PlatformFilter) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  trackedOnly: boolean;
  onTrackedOnlyChange: (trackedOnly: boolean) => void;
  /** Releases shown with the current filters, for the sheet's button. */
  resultCount: number;
  onClearFilters: () => void;
};

/**
 * Search and filters, pinned to the top while the list scrolls. From 640px the
 * filters sit inline; on phones they move into a bottom sheet, with each active
 * filter shown as a removable chip under the bar.
 */
export function FilterBar(props: FilterBarProps) {
  const { search, onSearchChange, platform, onPlatformChange, trackedOnly, onTrackedOnlyChange, resultCount, onClearFilters } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  const id = useId();

  // Sort isn't a filter, so it never gets a chip or counts as active.
  const chips = [
    platform !== "ALL" && { label: PLATFORM_LABEL[platform], remove: () => onPlatformChange("ALL") },
    trackedOnly && { label: "Tracked only", remove: () => onTrackedOnlyChange(false) },
  ].filter((chip) => chip !== false);

  return (
    <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-4 flex flex-col gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_200px]">
          <label htmlFor={`${id}-search`} className="sr-only">
            Search releases
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${id}-search`}
            type="search"
            autoComplete="off"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title or number"
            className="pl-8 text-base sm:text-sm"
          />
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="sm:hidden">
              <SlidersHorizontal aria-hidden />
              Filters
              {chips.length > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {chips.length}
                  <span className="sr-only"> active</span>
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[85vh] gap-5 overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-foreground"
          >
            <div aria-hidden className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-secondary" />
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-lg font-semibold">Filters</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close filters">
                  <X aria-hidden className="size-5" />
                </Button>
              </SheetClose>
            </div>
            <SheetDescription className="sr-only">Narrow down and sort the release list.</SheetDescription>

            <div className="flex flex-col gap-2">
              <span id={`${id}-sheet-platform`} className="text-sm font-medium">
                Platform
              </span>
              <PlatformToggle {...props} labelledBy={`${id}-sheet-platform`} fullWidth />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-sheet-sort`} className="text-sm font-medium">
                Sort by
              </label>
              <SortSelect {...props} id={`${id}-sheet-sort`} className="w-full" />
            </div>
            <TrackedOnlySwitch {...props} id={`${id}-sheet-tracked`} className="w-full justify-between px-0 text-base hover:bg-transparent" />

            <SheetFooter className="flex-row gap-2 border-t p-0 pt-4">
              <Button variant="ghost" className="px-4" onClick={onClearFilters}>
                Clear all
              </Button>
              <SheetClose asChild>
                <Button className="flex-1 px-4">
                  Show {resultCount} {resultCount === 1 ? "release" : "releases"}
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <div className="hidden sm:contents">
          <PlatformToggle {...props} label="Platform" />
          <label htmlFor={`${id}-sort`} className="sr-only">
            Sort releases
          </label>
          <SortSelect {...props} id={`${id}-sort`} />
          <TrackedOnlySwitch {...props} id={`${id}-tracked`} />
        </div>
      </div>

      {chips.length > 0 && (
        <ul aria-label="Active filters" className="m-0 flex list-none flex-wrap gap-1.5 p-0 sm:hidden">
          {chips.map((chip) => (
            <li key={chip.label}>
              <button
                type="button"
                onClick={chip.remove}
                aria-label={`Remove filter: ${chip.label}`}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-input bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-accent"
              >
                {chip.label}
                <X aria-hidden className="size-3.5" strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlatformToggle({
  platforms,
  platform,
  onPlatformChange,
  label,
  labelledBy,
  fullWidth,
}: FilterBarProps & { label?: string; labelledBy?: string; fullWidth?: boolean }) {
  const options: PlatformFilter[] = ["ALL", ...platforms];
  return (
    <ToggleGroup
      type="single"
      spacing={0}
      value={platform}
      // Radix sends "" when the pressed item is pressed again; keep one selected.
      onValueChange={(value) => value && isPlatformFilter(value) && onPlatformChange(value)}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn(
        "h-11 rounded-md border border-input p-0.5 sm:h-9",
        fullWidth && "grid w-full",
      )}
      style={fullWidth ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="h-full min-w-0 rounded-sm! px-2.5 text-muted-foreground hover:text-foreground data-[state=on]:text-foreground sm:h-full"
        >
          {option === "ALL" ? "All" : PLATFORM_LABEL[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function SortSelect({ sort, onSortChange, id, className }: FilterBarProps & { id: string; className?: string }) {
  return (
    <NativeSelect
      id={id}
      className={className}
      value={sort}
      onChange={(event) => isSortOrder(event.target.value) && onSortChange(event.target.value)}
    >
      {SORT_OPTIONS.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function TrackedOnlySwitch({
  trackedOnly,
  onTrackedOnlyChange,
  id,
  className,
}: FilterBarProps & { id: string; className?: string }) {
  // The whole row is the target: label and switch together.
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-accent sm:h-9",
        className,
      )}
    >
      <Switch id={id} checked={trackedOnly} onCheckedChange={onTrackedOnlyChange} className="order-last sm:order-first" />
      Tracked only
    </label>
  );
}
