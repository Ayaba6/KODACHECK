import { useState } from 'react';
import { ArrowLeft, ArrowRight, BellRing, CreditCard, FileCheck2, Lock, MapPin, Radio, Smartphone } from 'lucide-react';
import { Button, Card } from '../components/ui';
import PublicDeclarerPage from './PublicDeclarerPage';

const STEPS = [
  { icon: FileCheck2, title: 'Décrivez votre engin', text: 'Plaque ou numéro de châssis, marque, couleur et coordonnées du propriétaire.' },
  { icon: CreditCard, title: 'Réglez les frais', text: '2 000 FCFA par Mobile Money pour le traitement et la mise en ligne.' },
  { icon: Radio, title: 'Alerte immédiate', text: "Le signalement s'affiche en temps réel sur les terminaux des patrouilles." },
];

const FEATURES = [
  { icon: MapPin, tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10', title: 'Position GPS', text: 'Votre position est jointe à la déclaration pour orienter les recherches.' },
  { icon: Smartphone, tone: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10', title: 'Depuis votre téléphone', text: 'Aucun déplacement nécessaire pour lancer l\'alerte, 24 h/24.' },
  { icon: Lock, tone: 'text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-500/10', title: 'Données protégées', text: 'Vos informations ne sont accessibles qu\'aux forces de l\'ordre habilitées.' },
];

export default function PublicLandingPage() {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setShowForm(false)} className="mb-4 -ml-2">
          Retour
        </Button>
        <PublicDeclarerPage onDone={() => setShowForm(false)} />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white dark:border-slate-900 dark:from-brand-950 dark:to-slate-950">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
            <BellRing className="h-3.5 w-3.5" /> Service d'urgence en ligne
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            Votre moto ou votre véhicule a été volé ?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
            Déclarez-le en quelques minutes. Votre signalement est transmis immédiatement aux commissariats et aux patrouilles
            du réseau national.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="danger" onClick={() => setShowForm(true)} className="w-full sm:w-auto">
              Déclarer un vol
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Frais de traitement : 2 000 FCFA · Mobile Money</p>
        </div>
      </section>

      {/* Étapes */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-xl font-bold text-slate-900 dark:text-white">Comment ça marche</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                  <step.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${f.tone}`}>
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{f.text}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Merci de fournir des informations exactes : elles sont transmises telles quelles aux forces de l'ordre.
        </p>
      </section>
    </div>
  );
}
