const PATHS = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  heart: <path d="M12 20s-7-4.6-9-9.2C1.800 7.200 4 4 7 4c2 0 3.400 1 5 3 1.600-2 3-3 5-3 3 0 5.200 3.200 4 6.800C19 15.400 12 20 12 20z" />,
  dumbbell: <path d="M2 9v6M5 6v12M19 6v12M22 9v6M5 12h14" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.700L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  chart: <path d="M3 3v18h18M7 15l4-4 3 3 6-7" />,
  toolbox: <><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8V5h6v3M3 13h18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100" /></>,
  play: <path d="M7 4l13 8-13 8z" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  close: <path d="M5 5l14 14M19 5L5 19" />,
  check: <path d="M4 12l5 5L20 6" />,
  up: <path d="M12 20V5M5 12l7-7 7 7" />,
  down: <path d="M12 4v15M5 12l7 7 7-7" />,
  left: <path d="M20 12H5M12 5l-7 7 7 7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
