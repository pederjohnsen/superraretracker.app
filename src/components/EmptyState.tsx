import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  trackedOnly: boolean;
  inStockOnly: boolean;
  /** Search or platform is also narrowing the list. */
  hasOtherFilters: boolean;
  hasTracked: boolean;
  onClear: () => void;
};

/** "“In stock only”", or "“In stock only” or “Tracked only”". */
function switchNames(names: string[]): string {
  return names.map((name) => `“${name}”`).join(" or ");
}

/** Replaces the grid when the filters leave nothing, and says how to get results back. */
export function EmptyState({ trackedOnly, inStockOnly, hasOtherFilters, hasTracked, onClear }: EmptyStateProps) {
  const switchesOn = [inStockOnly && "In stock only", trackedOnly && "Tracked only"].filter((name) => name !== false);
  let title = "No releases match";
  let body = "Try a different search or platform.";

  if (trackedOnly && !hasTracked) {
    title = "You're not tracking anything yet";
    body = "Tap Track on a release to get alerts for it.";
  } else if (switchesOn.length > 0 && hasOtherFilters) {
    body = `Try a different search or platform, or turn off ${switchNames(switchesOn)}.`;
  } else if (inStockOnly && trackedOnly) {
    body = `None of the releases you track are in stock right now. Turn off ${switchNames(switchesOn)} to see them all.`;
  } else if (inStockOnly) {
    title = "Nothing's in stock right now";
    body = "Turn off “In stock only” to see sold-out releases and ones not on sale yet.";
  } else if (trackedOnly) {
    body = "None of the releases you track are in the list. Turn off “Tracked only” to see them all.";
  } else if (!hasOtherFilters) {
    title = "No releases yet";
    body = "New Super Rare Games releases will show up here.";
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <p className="m-0 max-w-sm text-sm text-muted-foreground">{body}</p>
      {(switchesOn.length > 0 || hasOtherFilters) && (
        <Button variant="outline" className="mt-1 px-4" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
