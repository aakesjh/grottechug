import { useTheme, type ThemeName } from "../theme/useTheme";

const THEMES: Array<{ id: ThemeName; label: string }> = [
  { id: "grotta", label: "Grotteglød" },
  { id: "skifer", label: "Kjellerlys" },
  { id: "lys", label: "Dagslys" },
];

type ThemeToggleProps = {
  className?: string;
  variant?: "default" | "compact";
};

export function ThemeToggle({
  className = "",
  variant = "default",
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const classes = ["themeToggle", `themeToggle--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  if (variant === "compact") {
    const activeIndex = THEMES.findIndex(({ id }) => id === theme);
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const activeTheme = THEMES[safeIndex];
    const nextTheme = THEMES[(safeIndex + 1) % THEMES.length];

    return (
      <button
        type="button"
        className={classes}
        onClick={() => setTheme(nextTheme.id)}
        aria-label={`Bytt fargetema. Aktivt tema er ${activeTheme.label}. Neste er ${nextTheme.label}.`}
        title={`Tema: ${activeTheme.label}`}
      >
        <span className="themeToggle__track" aria-hidden="true">
          <span className="themeToggle__miniSwatch themeToggle__miniSwatch--grotta" />
          <span className="themeToggle__miniSwatch themeToggle__miniSwatch--skifer" />
          <span className="themeToggle__miniSwatch themeToggle__miniSwatch--lys" />
        </span>
        <span className={`themeToggle__thumb themeToggle__thumb--${theme}`} aria-hidden="true" />
        <span className="themeToggle__sr">{activeTheme.label}</span>
      </button>
    );
  }

  return (
    <div className={classes} role="group" aria-label="Velg fargetema">
      {THEMES.map(({ id, label }) => {
        const isActive = theme === id;

        return (
          <button
            key={id}
            type="button"
            className={`themeToggle__option ${isActive ? "themeToggle__option--active" : ""}`}
            onClick={() => setTheme(id)}
            aria-pressed={isActive}
          >
            <span
              aria-hidden="true"
              className={`themeToggle__swatch themeToggle__swatch--${id}`}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
