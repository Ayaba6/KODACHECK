import { useState } from 'react';
import { Check, Copy, KeyRound, UserCheck } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Alert, Button, Modal } from './ui';

export interface CreatedAccount {
  full_name: string;
  badge_number: string;
  password: string;
  roleLabel: string;
}

function CopyRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.warning('Copie impossible', 'Sélectionnez et copiez la valeur manuellement.');
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <span className="text-slate-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="select-all truncate font-mono text-base font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
      <Button size="sm" variant="outline" onClick={copy} icon={copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}>
        {copied ? 'Copié' : 'Copier'}
      </Button>
    </div>
  );
}

/** Affiche une seule fois les identifiants d'un compte nouvellement créé. */
export function AccountCreatedModal({ account, onClose }: { account: CreatedAccount | null; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(account)}
      onClose={onClose}
      size="sm"
      icon={<UserCheck className="h-5 w-5 text-emerald-500" />}
      title="Compte créé"
      description={account ? `${account.roleLabel} · ${account.full_name}` : undefined}
      footer={<Button onClick={onClose}>J'ai transmis les identifiants</Button>}
    >
      {account && (
        <div className="space-y-3">
          <CopyRow label="Matricule (identifiant de connexion)" value={account.badge_number} icon={<UserCheck className="h-5 w-5" />} />
          <CopyRow label="Mot de passe temporaire" value={account.password} icon={<KeyRound className="h-5 w-5" />} />
          <Alert variant="warning">Ces identifiants ne seront plus affichés. Transmettez-les à l'intéressé en main propre.</Alert>
        </div>
      )}
    </Modal>
  );
}
