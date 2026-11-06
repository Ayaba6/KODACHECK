import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Loader2, RefreshCw, Share2, XCircle } from 'lucide-react';
import { getErrorMessage } from '../lib/utils';
import { getPaymentStatus, readSummary, whatsappShareUrl, type PaymentStatusResult } from '../lib/citizenDeclaration';
import { DeclarationStepper } from '../components/DeclarationStepper';
import { Alert, Button, Card } from '../components/ui';

const POLL_MS = 3000;
const POLL_LIMIT_MS = 3 * 60 * 1000;

type View = 'checking' | 'success' | 'failed' | 'waiting' | 'error';

const FAILED = new Set(['FAILED', 'EXPIRED', 'INSUFFICIENT_BALANCE', 'OTP_ERROR', 'OTP_EXPIRED', 'USER_IS_BLOCKED', 'NOT_ALLOWED']);

/**
 * Retour de la page de paiement CinetPay : on interroge KodaCheck (qui revérifie auprès de CinetPay)
 * jusqu'à un statut définitif. Le résultat affiché vient toujours du serveur, jamais de l'URL.
 */
export default function PaymentReturnPage({ paymentRef, onDone, onRetry }: { paymentRef: string; onDone: () => void; onRetry: () => void }) {
  const [view, setView] = useState<View>('checking');
  const [result, setResult] = useState<PaymentStatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const summary = readSummary(paymentRef);

  const check = useCallback(async (): Promise<boolean> => {
    try {
      const res = await getPaymentStatus(paymentRef);
      setResult(res);
      if (res.status === 'SUCCESS') {
        setView('success');
        return true;
      }
      if (FAILED.has(res.status)) {
        setView('failed');
        return true;
      }
      setView(Date.now() - startedAt.current > POLL_LIMIT_MS ? 'waiting' : 'checking');
      return Date.now() - startedAt.current > POLL_LIMIT_MS;
    } catch (err) {
      setError(getErrorMessage(err));
      setView('error');
      return true;
    }
  }, [paymentRef]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const done = await check();
      if (!cancelled && !done) timer = setTimeout(loop, POLL_MS);
    };
    void loop();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [check]);

  const reportNumber = result?.report_number ?? summary?.reportNumber ?? null;

  return (
    <Card className="p-5 sm:p-8">
      <DeclarationStepper index={view === 'success' ? 3 : 1} />

      {view === 'checking' && (
        <div className="space-y-4 py-8 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Confirmation du paiement…</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Si vous n'avez pas encore validé le paiement sur votre téléphone, faites-le maintenant.
            </p>
          </div>
        </div>
      )}

      {view === 'success' && (
        <div className="space-y-5 py-4 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <CheckCircle2 className="h-9 w-9" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paiement confirmé</h1>
            {reportNumber && (
              <p className="mt-3 inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                N° de dossier : <span className="font-mono font-bold">{reportNumber}</span>
              </p>
            )}
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Votre déclaration est transmise aux patrouilles et au commissariat choisi. Présentez-vous au commissariat
              avec ce numéro pour finaliser votre plainte.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            {summary && (
              <Button
                variant="success"
                icon={<Share2 className="h-4 w-4" />}
                onClick={() => window.open(whatsappShareUrl({ ...summary, reportNumber }), '_blank', 'noopener')}
              >
                Partager l'avis sur WhatsApp
              </Button>
            )}
            <Button variant="outline" onClick={onDone}>
              Terminer
            </Button>
          </div>
        </div>
      )}

      {view === 'failed' && (
        <div className="space-y-5 py-4 text-center">
          <XCircle className="mx-auto h-14 w-14 text-red-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Paiement non abouti</h1>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
              {result?.status === 'INSUFFICIENT_BALANCE'
                ? 'Le solde du compte Mobile Money est insuffisant.'
                : 'Le paiement a été refusé, annulé ou a expiré. Aucun montant n’a été prélevé.'}{' '}
              Votre déclaration n'a pas été transmise.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={onRetry}>Recommencer la déclaration</Button>
            <Button variant="outline" onClick={onDone}>
              Retour à l'accueil
            </Button>
          </div>
        </div>
      )}

      {view === 'waiting' && (
        <div className="space-y-5 py-4 text-center">
          <Clock className="mx-auto h-14 w-14 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Paiement toujours en attente</h1>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Nous n'avons pas encore reçu la confirmation de l'opérateur. Si vous avez validé le paiement, elle arrivera
              sous peu : votre déclaration sera alors transmise automatiquement. Sans paiement, elle expire sous 24 h.
            </p>
            <p className="mt-2 text-xs text-slate-500">Référence : <span className="font-mono">{paymentRef}</span></p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => {
                startedAt.current = Date.now();
                setView('checking');
                void check();
              }}
            >
              Vérifier à nouveau
            </Button>
            <Button variant="outline" onClick={onDone}>
              Retour à l'accueil
            </Button>
          </div>
        </div>
      )}

      {view === 'error' && (
        <div className="space-y-4">
          <Alert variant="error" title="Vérification impossible">
            {error} Votre référence de paiement : <span className="font-mono">{paymentRef}</span>
          </Alert>
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => {
              setView('checking');
              void check();
            }}
          >
            Réessayer
          </Button>
        </div>
      )}
    </Card>
  );
}
