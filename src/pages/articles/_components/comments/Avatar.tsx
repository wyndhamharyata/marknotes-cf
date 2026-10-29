import { pseudoRandom } from "../../../../lib/comments/adorable";
import { AUTHOR_ALIAS, AUTHOR_AVATAR } from "../../../../lib/comments/author";

// The 25 body parts, as hashed asset URLs. Each comment shows three of them.
const PART_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(
  import.meta.glob("../../../../assets/adorable/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  })
)) {
  PART_URLS[path.split("/").pop()!] = url as string;
}

// A visitor's face is the Go site's adorable avatar; the author's is the GitHub photo, printed.
export default function Avatar({ seed }: { seed: string }) {
  if (seed === AUTHOR_ALIAS) {
    return (
      <span class="ident ph">
        <img src={AUTHOR_AVATAR} alt="" />
      </span>
    );
  }

  const { eyes, nose, mouth, background } = pseudoRandom(seed);

  return (
    <span class="ident" style={`background: rgb(${background.join(", ")})`}>
      <img src={PART_URLS[`eyes${eyes}.png`]} alt="" />
      <img src={PART_URLS[`nose${nose}.png`]} alt="" />
      <img src={PART_URLS[`mouth${mouth}.png`]} alt="" />
    </span>
  );
}
