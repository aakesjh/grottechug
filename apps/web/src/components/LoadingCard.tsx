type LoadingCardProps = {
  title: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
  card?: boolean;
  skeletonPattern?: Array<"lg" | "md" | "sm">;
};

const DEFAULT_SKELETON_PATTERN: Array<"lg" | "md" | "sm"> = ["lg", "md", "md", "sm"];

export function LoadingCard({
  title,
  subtitle,
  className,
  compact = false,
  card = true,
  skeletonPattern = DEFAULT_SKELETON_PATTERN,
}: LoadingCardProps) {
  const rootClass = [
    card ? "card" : "",
    "loading-card",
    compact ? "loading-card--compact" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <div className="loading-card__spinner" aria-hidden="true" />
      <div className="loading-card__title">{title}</div>
      {subtitle && <div className="loading-card__subtitle">{subtitle}</div>}
      <div className="loading-card__skeletons" aria-hidden="true">
        {skeletonPattern.map((size, index) => (
          <div
            key={`${size}-${index}`}
            className={`loading-card__skeleton loading-card__skeleton--${size}`}
          />
        ))}
      </div>
    </div>
  );
}
