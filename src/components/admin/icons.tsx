import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const LockIcon = (p: P) => (<svg {...base(p)}><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
export const PlusIcon = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const SearchIcon = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></svg>);
export const CheckIcon = (p: P) => (<svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const ChevronRight = (p: P) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>);
export const ArrowLeft = (p: P) => (<svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const ArrowRight = (p: P) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const TrashIcon = (p: P) => (<svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>);
export const RefreshIcon = (p: P) => (<svg {...base(p)}><path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5L20 15M20 20v-5h-5" /></svg>);
export const ExternalIcon = (p: P) => (<svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const GlobeIcon = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg>);
export const PhoneIcon = (p: P) => (<svg {...base(p)}><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></svg>);
export const ImageIcon = (p: P) => (<svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" /></svg>);
export const DownloadIcon = (p: P) => (<svg {...base(p)}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>);
export const SpinnerIcon = (p: P) => (<svg {...base(p)} className={`animate-spin ${p.className ?? ""}`}><path d="M12 3a9 9 0 1 0 9 9" /></svg>);
export const StarIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? "currentColor" : "none"}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" /></svg>
);
export const LogoGlyph = ({ size = 28, ...p }: P & { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden {...p}>
    <rect width="32" height="32" rx="7.2" fill="var(--tint)" />
    <path d="M16 7v12M10.5 14.5 16 20l5.5-5.5M9 24h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
