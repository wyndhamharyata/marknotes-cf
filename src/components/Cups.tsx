export default function Cups({ score }: { score: number }) {
  return (
    <>
      <span class="cups" role="img" aria-label={`${score} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} class={score >= n ? "f" : score >= n - 0.5 ? "h" : undefined} />
        ))}
      </span>
      <b class="score">{score.toFixed(1)}</b>
    </>
  );
}
