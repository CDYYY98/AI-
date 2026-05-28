import { cn } from "@/lib/utils";

interface DesktopBrandMarkProps {
  className?: string;
}

export default function DesktopBrandMark({ className }: DesktopBrandMarkProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-16 w-16 drop-shadow-[0_18px_40px_rgba(120,60,20,0.28)]", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="turingBrandGradient" x1="14" y1="12" x2="82" y2="84" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F97316" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="80" height="80" rx="24" fill="url(#turingBrandGradient)" />
      {/* Book */}
      <path d="M28 28 L48 32 L48 72 L28 68 Z" fill="#F5F5F5" />
      <path d="M48 32 L68 28 L68 68 L48 72 Z" fill="#E5E5E5" />
      <path d="M48 32 L48 72" stroke="#9CA3AF" strokeWidth="1.5" />
      {/* Pen */}
      <rect x="44" y="18" width="8" height="30" rx="2" fill="#374151" transform="rotate(-35 44 18)" />
      <polygon points="62,36 68,20 74,26 68,42" fill="#F97316" />
    </svg>
  );
}
