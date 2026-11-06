import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  trackedOnly: boolean;
  /** Search or platform is also narrowing the list. */
  hasOtherFilters: boolean;
  hasTracked: boolean;
  onClear: () => void;
};

/** Replaces the grid when the filters leave nothing, and says how to get results back. */
export function EmptyState({ trackedOnly, hasOtherFilters, hasTracked, onClear }: EmptyStateProps) {
  let title = "No releases match";
  let body = "Try a different search or platform.";

  if (trackedOnly && !hasTracked) {
    title = "You're not tracking anything yet";
    body = "Tap Track on a release to get alerts for it.";
  } else if (trackedOnly && hasOtherFilters) {
    body = "Try a different search or platform, or turn off “Tracked only”.";
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
      {(trackedOnly || hasOtherFilters) && (
        <Button variant="outline" className="mt-1 px-4" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
