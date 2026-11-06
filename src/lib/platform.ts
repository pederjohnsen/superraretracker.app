import type { ReleaseType } from "../../zenstack/models";

// The platform badge and filter labels, from the release's `type`.
export const PLATFORM_LABEL: Record<ReleaseType, string> = {
  SWITCH: "Switch",
  SWITCH2: "Switch 2",
  PS4: "PS4",
  PS5: "PS5",
  XBOX: "Xbox",
};

// Filter order. Only platforms that have releases are offered.
export const PLATFORM_ORDER: ReleaseType[] = ["SWITCH", "SWITCH2", "PS5", "PS4", "XBOX"];

export function isReleaseType(value: string): value is ReleaseType {
  return value in PLATFORM_LABEL;
}
