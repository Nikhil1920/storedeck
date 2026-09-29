function cx(...c: Array<string | undefined>) {
  return c.filter(Boolean).join(' ')
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <defs>
          <linearGradient id="sd-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b7bff" />
            <stop offset="1" stopColor="#5a3ccb" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#sd-g)" />
        <rect x="8" y="9" width="10" height="16" rx="2.5" fill="#fff" opacity="0.55" transform="rotate(-8 13 17)" />
        <rect x="14" y="7" width="10" height="17" rx="2.5" fill="#fff" />
      </svg>
      Storedeck
    </span>
  )
}
