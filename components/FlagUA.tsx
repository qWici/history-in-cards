/** Прапор України як SVG: емодзі 🇺🇦 на Windows рендериться літерами «UA». */
export function FlagUA({
  width = 28,
  className = "",
}: {
  width?: number;
  className?: string;
}) {
  const height = Math.round((width / 3) * 2);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 30 20"
      className={className}
      role="img"
      aria-label="Прапор України"
    >
      <rect width="30" height="20" rx="3" fill="#005BBB" />
      <path d="M0 10h30v7a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3v-7Z" fill="#FFD500" />
    </svg>
  );
}
