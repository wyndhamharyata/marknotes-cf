// Self-check for the pane map and the draft comparison: npm run check:editor.
import assert from "node:assert/strict";
import { mapScroll } from "../src/lib/editor/pane-map.ts";
import { editedSince } from "../src/lib/editor/draft-diff.ts";

const body = { top: 500, max: 2500 };
const prose = { top: 600, max: 1800 };

for (const x of [0, 250, 500, 900, 1750, 3000]) {
  assert.ok(
    Math.abs(mapScroll(mapScroll(x, body, prose), prose, body) - x) < 0.001,
    `round trip at ${x}`
  );
}

assert.equal(mapScroll(0, body, prose), 0);
assert.equal(mapScroll(3000, body, prose), prose.top + prose.max);
assert.equal(mapScroll(0, prose, body), 0);
assert.equal(mapScroll(2400, prose, body), body.top + body.max);

const empty = { top: 0, max: 0 };
assert.equal(mapScroll(0, empty, body), 0);
assert.equal(mapScroll(-1, empty, body), 0);
assert.equal(mapScroll(1, empty, body), body.top);

const short = { top: 600, max: -200 };
assert.equal(mapScroll(600, short, body), body.top);
assert.equal(mapScroll(900, short, body), body.top);
assert.ok(Number.isFinite(mapScroll(1200, body, short)));

const initial = {
  title: "T",
  description: "D",
  body: "B",
  inlineAssets: [],
  updatedAt: 0,
};
assert.equal(editedSince(initial, initial), false);
assert.equal(editedSince({ ...initial, updatedAt: 99 }, initial), false);
assert.equal(editedSince({ ...initial, title: "T2" }, initial), true);
assert.equal(editedSince({ ...initial, body: "B2" }, initial), true);
assert.equal(editedSince({ ...initial, rating: 0 }, initial), false);
assert.equal(editedSince({ ...initial, rating: 4 }, initial), true);
assert.equal(editedSince({ ...initial, heroPath: "./a.webp" }, initial), true);
assert.equal(
  editedSince(
    { ...initial, inlineAssets: [{ id: "img_1", r2Key: "k" }] },
    { ...initial, inlineAssets: [{ id: "img_1", r2Key: "k" }] }
  ),
  false
);

console.log("editor checks passed");
