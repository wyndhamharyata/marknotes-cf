import { minidenticon } from "minidenticons";
import { AUTHOR_ALIAS, AUTHOR_AVATAR } from "../../../../lib/comments/author";

// A visitor's identicon is a rubber stamp in ink; the author's is the GitHub photo, printed.
export default function Avatar({ seed }: { seed: string }) {
  if (seed === AUTHOR_ALIAS) {
    return (
      <span class="ident ph">
        <img src={AUTHOR_AVATAR} alt="" />
      </span>
    );
  }
  return (
    <span class="ident">
      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(minidenticon(seed, 0, 8))}`} alt="" />
    </span>
  );
}
