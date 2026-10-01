/** The text fades out under the top edge of the chat instead of being cut off. */
export function TopFade() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-7 bg-gradient-to-b from-background from-0% via-background/98 via-10% to-transparent"
    />
  );
}
