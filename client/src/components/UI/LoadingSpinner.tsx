interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  color?: string;
}

const SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

/**
 * LoadingSpinner - Accessible loading indicator with optional label.
 */
export default function LoadingSpinner({
  size = "md",
  label = "Yükleniyor",
  color = "border-emerald-500",
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="flex flex-col items-center gap-2"
    >
      <div
        className={`animate-spin rounded-full ${SIZES[size]} ${color} border-t-transparent`}
      />
      {label && size !== "sm" && (
        <span className="text-xs text-gray-400">{label}…</span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
