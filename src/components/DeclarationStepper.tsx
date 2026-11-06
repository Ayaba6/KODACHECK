import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

const STEPS = ['Déclaration', 'Paiement', 'Confirmation'];

/** Étapes de la déclaration citoyenne (0 = formulaire, 1 = paiement, 2 = confirmation). */
export function DeclarationStepper({ index }: { index: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              i < index && 'bg-emerald-600 text-white',
              i === index && 'bg-brand-600 text-white',
              i > index && 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
            )}
          >
            {i < index ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn('hidden text-sm sm:block', i === index ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>
            {label}
          </span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />}
        </li>
      ))}
    </ol>
  );
}
