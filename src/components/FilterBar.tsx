"use client";

import { useId, useState, type CSSProperties } from "react";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import type { ReleaseType } from "../../zenstack/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isReleaseType, PLATFORM_LABEL, PLATFORM_ORDER } from "@/lib/platform";
import { isSortOrder, SORT_OPTIONS, type SortOrder } from "@/lib/release-list";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  search: string;
  onSearchChange: (search: string) => void;
  /** The platforms that have releases, in display order. */
  platforms: ReleaseType[];
  /** The platforms picked; empty shows every platform. */
  selectedPlatforms: ReleaseType[];
  onSelectedPlatformsChange: (platforms: ReleaseType[]) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  inStockOnly: boolean;
  onInStockOnlyChange: (inStockOnly: boolean) => void;
  trackedOnly: boolean;
  onTrackedOnlyChange: (trackedOnly: boolean) => void;
  /** Releases shown with the current filters, for the sheet's button. */
  resultCount: number;
  onClearFilters: () => void;
};

/**
 * Search and filters, pinned to the top while the list scrolls. From 640px,
 * search and sort sit on the first row and the filters on a second: platform
 * toggles (pick any; none shows all) and the In stock only and Tracked only
 * switches. On phones the filters move into a bottom sheet, with each active
 * filter shown as a removable chip under the bar.
 */
export function FilterBar(props: FilterBarProps) {
  const {
    search,
    onSearchChange,
    selectedPlatforms,
    onSelectedPlatformsChange,
    inStockOnly,
    onInStockOnlyChange,
    trackedOnly,
    onTrackedOnlyChange,
    resultCount,
    onClearFilters,
  } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  const id = useId();

  // Sort isn't a filter, so it never gets a chip or counts as active.
  const chips = [
    // One chip per picked platform, each removable on its own.
    ...selectedPlatforms.map((platform) => ({
      label: PLATFORM_LABEL[platform],
      remove: () => onSelectedPlatformsChange(selectedPlatforms.filter((picked) => picked !== platform)),
    })),
    ...(inStockOnly ? [{ label: "In stock", remove: () => onInStockOnlyChange(false) }] : []),
    ...(trackedOnly ? [{ label: "Tracked only", remove: () => onTrackedOnlyChange(false) }] : []),
  ];

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
              <div className="flex items-baseline justify-between gap-2">
                <span id={`${id}-sheet-platforms`} className="text-sm font-medium">
                  Platforms
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedPlatforms.length === 0 ? "All platforms" : `${selectedPlatforms.length} picked`}
                </span>
              </div>
              <PlatformToggles {...props} labelledBy={`${id}-sheet-platforms`} inSheet />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-sheet-sort`} className="text-sm font-medium">
                Sort by
              </label>
              <SortSelect {...props} id={`${id}-sheet-sort`} className="w-full" />
            </div>
            <div className="flex flex-col">
              <FilterSwitch
                id={`${id}-sheet-in-stock`}
                label="In stock only"
                checked={inStockOnly}
                onCheckedChange={onInStockOnlyChange}
                inSheet
              />
              <FilterSwitch
                id={`${id}-sheet-tracked`}
                label="Tracked only"
                checked={trackedOnly}
                onCheckedChange={onTrackedOnlyChange}
                inSheet
              />
            </div>

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

        <div className="hidden sm:block">
          <label htmlFor={`${id}-sort`} className="sr-only">
            Sort releases
          </label>
          <SortSelect {...props} id={`${id}-sort`} />
        </div>
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
        <div className="flex flex-wrap items-center gap-1.5">
          <span id={`${id}-platforms`} className="mr-0.5 text-sm text-muted-foreground">
            Platforms
          </span>
          <PlatformToggles {...props} labelledBy={`${id}-platforms`} />
        </div>
        <div className="flex items-center gap-1">
          <FilterSwitch id={`${id}-in-stock`} label="In stock only" checked={inStockOnly} onCheckedChange={onInStockOnlyChange} />
          <FilterSwitch id={`${id}-tracked`} label="Tracked only" checked={trackedOnly} onCheckedChange={onTrackedOnlyChange} />
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

/**
 * Pick any combination of platforms; picking none shows them all, so there's
 * no "All" button. Pills in the bar, a grid of buttons in the sheet.
 */
function PlatformToggles({
  platforms,
  selectedPlatforms,
  onSelectedPlatformsChange,
  labelledBy,
  inSheet,
}: FilterBarProps & { labelledBy: string; inSheet?: boolean }) {
  // Two per row for four, otherwise one row in the sheet.
  const columns = platforms.length === 4 ? 2 : Math.min(platforms.length, 3);
  return (
    <ToggleGroup
      type="multiple"
      spacing={2}
      value={selectedPlatforms}
      // Keep the store's order, whatever order they were tapped in.
      onValueChange={(values) => onSelectedPlatformsChange(PLATFORM_ORDER.filter((type) => values.filter(isReleaseType).includes(type)))}
      aria-labelledby={labelledBy}
      className={cn(inSheet ? "grid w-full" : "flex-wrap")}
      // ToggleGroup sets its gap through --gap in `style`, and any style passed in
      // replaces it (even undefined), so always pass --gap here too.
      style={{ "--gap": 2, ...(inSheet && { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }) } as CSSProperties}
    >
      {platforms.map((platform) => (
        <ToggleGroupItem
          key={platform}
          value={platform}
          className={cn(
            "gap-1 border border-input bg-transparent px-3 text-muted-foreground hover:bg-accent hover:text-foreground",
            "data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-foreground data-[state=on]:hover:bg-primary/25",
            inSheet ? "h-11 min-w-0 rounded-md!" : "rounded-full!",
          )}
        >
          {selectedPlatforms.includes(platform) && <Check aria-hidden className="size-3.5" strokeWidth={2.4} />}
          {PLATFORM_LABEL[platform]}
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

/** A labelled switch where the whole row is the target. In the sheet, the switch sits on the right. */
function FilterSwitch({
  id,
  label,
  checked,
  onCheckedChange,
  inSheet,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  inSheet?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex h-11 cursor-pointer items-center gap-2 rounded-md text-sm font-medium sm:h-9",
        inSheet ? "w-full justify-between px-0 text-base" : "px-2 hover:bg-accent",
      )}
    >
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className={inSheet ? "order-last" : undefined} />
      {label}
    </label>
  );
}
