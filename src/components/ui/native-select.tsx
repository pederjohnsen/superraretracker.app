import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"

// Design system: the phone's own picker, at h-11 on touch and h-9 from 640px.
// "tracked" is the alert-level look (primary border, primary/15 fill).
type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  variant?: "default" | "tracked"
}

function NativeSelect({
  className,
  variant = "default",
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
      data-variant={variant}
    >
      <select
        data-slot="native-select"
        data-variant={variant}
        className="h-11 w-full min-w-0 cursor-pointer appearance-none truncate rounded-md border border-input bg-background py-1 pr-9 pl-3 text-base text-foreground transition-colors select-none disabled:pointer-events-none disabled:cursor-not-allowed data-[variant=tracked]:border-primary data-[variant=tracked]:bg-primary/15 data-[variant=tracked]:font-medium sm:h-9 sm:text-sm"
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground select-none group-data-[variant=tracked]/native-select:text-foreground"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
