import { compactPlate } from './plateUtils';

interface Vote {
  key: string;
  plate: string;
  confidence: number;
  at: number;
}

/**
 * Vote sur les lectures successives de la caméra. Une lecture isolée peut être fausse
 * (« 03 » lu « 08 », lettre perdue…) ; la bonne lecture, elle, revient d'une image à l'autre.
 * Une plaque est retenue quand elle a au moins `needed` voix récentes et plus que toute autre.
 */
export class PlateVote {
  private votes: Vote[] = [];

  constructor(
    private readonly windowMs = 4000,
    private readonly needed = 2,
    /** Une lecture très nette est acceptée seule si aucune autre lecture ne la contredit. */
    private readonly instantConfidence = 90,
  ) {}

  /** Ajoute une lecture ; renvoie la plaque retenue, ou null s'il faut continuer. */
  add(plate: string, confidence: number, now = Date.now()): string | null {
    this.votes = this.votes.filter((v) => now - v.at < this.windowMs);
    this.votes.push({ key: compactPlate(plate), plate, confidence, at: now });

    const counts = new Map<string, Vote[]>();
    for (const v of this.votes) counts.set(v.key, [...(counts.get(v.key) ?? []), v]);
    const ranked = [...counts.values()].sort((a, b) => b.length - a.length);
    const [top, second] = ranked;

    if (top.length >= this.needed && top.length > (second?.length ?? 0)) {
      return top[top.length - 1].plate;
    }
    if (ranked.length === 1 && confidence >= this.instantConfidence) return plate;
    return null;
  }

  /** Lecture en tête pour l'affichage (« Lecture : … »). */
  leader(): string | null {
    const counts = new Map<string, Vote[]>();
    for (const v of this.votes) counts.set(v.key, [...(counts.get(v.key) ?? []), v]);
    const top = [...counts.values()].sort((a, b) => b.length - a.length)[0];
    return top ? top[top.length - 1].plate : null;
  }

  reset() {
    this.votes = [];
  }
}
