import { useState } from "react";

type Props = {
  name: string;
  imageUrl?: string | null;
  size?: number;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => (p[0] ?? "").toUpperCase()).join("");
}

export function Avatar({ name, imageUrl, size = 56 }: Props) {
  const [broken, setBroken] = useState(false);

  if (!imageUrl || broken) {
    return (
      <div
        className="avatar"
        style={{ width: size, height: size }}
        aria-label={name}
        title={name}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      width={size}
      height={size}
      className="avatar__img"
      onError={() => setBroken(true)}
    />
  );
}