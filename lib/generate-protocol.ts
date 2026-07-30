/**
 * Protocole d'événements de la route de génération.
 *
 * Pourquoi un flux NDJSON plutôt qu'un job + polling :
 *
 * Le cahier des charges exige une barre de progression RÉELLE, pas un spinner
 * ni un compteur déguisé. La progression doit donc refléter l'avancement effectif
 * du pipeline serveur. Trois options existaient :
 *
 *   1. Job en base + polling  → deux fois plus de requêtes, et sur Vercel une
 *      fonction serverless est gelée après sa réponse : impossible de continuer
 *      le travail en arrière-plan sans file d'attente dédiée.
 *   2. Progression écrite dans Redis, lue en parallèle → marche, mais impose
 *      Upstash comme dépendance dure d'un parcours qui doit fonctionner sans.
 *   3. Flux NDJSON sur la requête POST elle-même → une seule requête, aucune
 *      infrastructure supplémentaire, et chaque événement correspond à une
 *      étape réellement franchie côté serveur.
 *
 * On prend la 3. La ligne en base (`generations`) est quand même créée et mise
 * à jour, pour la purge à 24 h et la traçabilité — mais elle ne sert pas à
 * transporter la progression.
 */

export type GenerationStage = 'reception' | 'moderation' | 'generation' | 'marquage';

/** Progression associée à chaque étape. Ce sont des jalons atteints, pas une interpolation. */
export const STAGE_PROGRESS: Record<GenerationStage, number> = {
  reception: 8,
  moderation: 28,
  generation: 72,
  marquage: 94,
};

/** Messages affichés pendant l'attente, un par étape. */
export const STAGE_MESSAGES_FR: Record<GenerationStage, string> = {
  reception: 'On récupère ta photo…',
  moderation: 'Petite vérification obligatoire…',
  generation: 'L’IA se met au travail…',
  marquage: 'On ajoute la mention légale…',
};

export type GenerateEvent =
  | { type: 'stage'; stage: GenerationStage; progress: number }
  | {
      type: 'done';
      /** Image finale encodée en base64 (data sans préfixe). */
      image: string;
      mimeType: string;
      width: number;
      height: number;
      generationId: string;
      /** Vrai si le filigrane commercial est présent (palier gratuit). */
      watermarked: boolean;
      /** Crédits restants, `null` pour une session anonyme. */
      creditsLeft: number | null;
      /** Vrai si la génération gratuite vient d'être consommée. */
      freeUsed: boolean;
    }
  | {
      type: 'error';
      code: GenerateErrorCode;
      messageFr: string;
      /** Vrai si un crédit avait été réservé puis rendu. */
      refunded: boolean;
    };

export type GenerateErrorCode =
  | 'no_credits'
  | 'moderation_refused'
  | 'invalid_input'
  | 'rate_limited'
  | 'engine_failed'
  | 'timeout'
  | 'server_error';

/**
 * Au-delà, le client abandonne et affiche l'échec.
 *
 * Doit rester STRICTEMENT SUPÉRIEUR au délai d'abandon côté fournisseur
 * (45 s dans `lib/image-engine/gemini.ts`) : si le client coupe le premier,
 * le serveur n'a pas le temps de rembourser le crédit ni de marquer la ligne
 * en échec, et l'utilisateur est débité pour rien.
 *
 * Mesures du 30/07/2026 : médiane 21,4 s, pire cas 23,8 s. L'ancienne valeur
 * de 25 s coupait donc régulièrement des générations qui allaient aboutir.
 */
export const CLIENT_TIMEOUT_MS = 50_000;

/** Encode un événement en une ligne NDJSON. */
export function encodeEvent(event: GenerateEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Découpe un flux de texte en événements. Conserve la fraction de ligne
 * incomplète entre deux appels — un chunk réseau ne s'arrête pas sur un `\n`.
 */
export function createEventParser(): (chunk: string) => GenerateEvent[] {
  let buffer = '';

  return (chunk: string): GenerateEvent[] => {
    buffer += chunk;
    const lines = buffer.split('\n');
    // La dernière entrée est soit vide, soit une ligne partielle : on la garde.
    buffer = lines.pop() ?? '';

    const events: GenerateEvent[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed) as GenerateEvent);
      } catch {
        // Ligne corrompue : on l'ignore plutôt que de casser tout le flux.
      }
    }
    return events;
  };
}
