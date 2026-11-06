import { cookies } from "next/headers";

export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";

/**
 * The theme the person picked with the toggle, or undefined if they never
 * have. With no saved theme, <html> gets no class and the CSS follows the
 * device's light/dark setting.
 */
export async function getSavedTheme(): Promise<Theme | undefined> {
    const value = (await cookies()).get(THEME_COOKIE)?.value;
    return value === "light" || value === "dark" ? value : undefined;
}
