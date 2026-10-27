import { minidenticon } from "minidenticons";
import { AUTHOR_ALIAS, AUTHOR_AVATAR } from "../../../../lib/comments/author";

interface AvatarProps {
  seed: string;
  size?: number;
}

export default function Avatar({ seed, size = 40 }: AvatarProps) {
  const src =
    seed === AUTHOR_ALIAS
      ? AUTHOR_AVATAR
      : `data:image/svg+xml;utf8,${encodeURIComponent(minidenticon(seed, 95, 45))}`;
  return (
    <div class="avatar" style={{ width: size, height: size }}>
      <div class="mask mask-squircle bg-base-300 ring-base-content/40 ring-1">
        <img src={src} alt={seed} width={size} height={size} />
      </div>
    </div>
  );
}
