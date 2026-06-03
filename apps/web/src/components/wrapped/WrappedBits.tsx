export function RoundAvatar({
  name,
  imageUrl,
  size = 92,
  ring,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
  ring?: string;
}) {
  const style = {
    width: size,
    height: size,
    ...(ring ? { borderColor: ring, boxShadow: `0 0 22px ${ring}66` } : {}),
  };
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className="wrapped-avatar" style={style} />;
  }
  return (
    <span
      className="wrapped-avatar wrapped-avatar--fallback"
      style={{ ...style, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Avatar + name + value, used inside award/record story cards. */
export function PersonHighlight({
  name,
  imageUrl,
  ring,
}: {
  name: string;
  imageUrl?: string | null;
  ring?: string;
}) {
  return (
    <div className="wrapped-highlight">
      <RoundAvatar name={name} imageUrl={imageUrl} size={110} ring={ring} />
      <div className="wrapped-highlight__name">{name}</div>
    </div>
  );
}
