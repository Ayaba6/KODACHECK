import { cn } from '../../lib/utils';

/** Logo KODACHECK (reprend le « O » coché du logo officiel). */
export function Logo({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: { text: 'text-base', mark: 'h-7 w-7' },
    md: { text: 'text-lg', mark: 'h-8 w-8' },
    lg: { text: 'text-3xl', mark: 'h-12 w-12' },
  };
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={sizes[size].mark} />
      <span className={cn('font-extrabold leading-none tracking-tight', sizes[size].text)}>
        <span className="text-brand-950 dark:text-white">KODA</span>
        <span className="text-brand-600 dark:text-brand-400">CHECK</span>
      </span>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('shrink-0', className)} aria-hidden>
      <rect width="40" height="40" rx="10" className="fill-brand-950 dark:fill-brand-600" />
      <circle cx="20" cy="20" r="10.5" fill="none" stroke="white" strokeWidth="4" />
      <path d="M14.5 20.5l4 4 9-10" fill="none" stroke="#34c759" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
