import { useTheme, type ThemeName } from "../theme/useTheme";

const THEMES: Array<{ id: ThemeName; label: string }> = [
  { id: "grotta", label: "Grotteglød" },
  { id: "skifer", label: "Kjellerlys" },
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
    const activeTheme = THEMES.find(({ id }) => id === theme) ?? THEMES[0];
    const nextTheme = THEMES.find(({ id }) => id !== theme) ?? THEMES[1];

    return (
      <button
        type="button"
        className={classes}
        onClick={() => setTheme(nextTheme.id)}
        role="switch"
        aria-checked={theme === "skifer"}
        aria-label={`Bytt fargetema. Aktivt tema er ${activeTheme.label}.`}
        title={`Tema: ${activeTheme.label}`}
      >
        <span className="themeToggle__track" aria-hidden="true">
          <span className="themeToggle__miniSwatch themeToggle__miniSwatch--grotta" />
          <span className="themeToggle__miniSwatch themeToggle__miniSwatch--skifer" />
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
