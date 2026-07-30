import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { hasRedis, serverEnv } from '@/lib/env';

/**
 * Limitation de débit sur la route de génération.
 *
 * Sans Upstash configuré, on retombe sur un compteur en mémoire : suffisant en
 * développement, inopérant en production serverless (chaque instance a son
 * propre compteur). Le README le signale.
 */

let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (!hasRedis()) return null;
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({
        url: serverEnv.upstashUrl as string,
        token: serverEnv.upstashToken as string,
      }),
      // Généreux volontairement : la vraie limite est le crédit, pas le débit.
      // Ceci ne sert qu'à absorber un script qui tenterait d'épuiser le quota
      // Gemini ou de faire exploser la facture.
      limiter: Ratelimit.slidingWindow(12, '5 m'),
      prefix: 'fauxto:generate',
      analytics: false,
    });
  }
  return limiter;
}

/** Fenêtre glissante en mémoire, repli de développement. */
const memoryWindows = new Map<string, number[]>();
const MEMORY_LIMIT = 12;
const MEMORY_WINDOW_MS = 5 * 60 * 1000;

function memoryCheck(key: string): { success: boolean; remaining: number } {
  const now = Date.now();
  const hits = (memoryWindows.get(key) ?? []).filter((t) => now - t < MEMORY_WINDOW_MS);

  if (hits.length >= MEMORY_LIMIT) {
    memoryWindows.set(key, hits);
    return { success: false, remaining: 0 };
  }

  hits.push(now);
  memoryWindows.set(key, hits);

  // Purge occasionnelle pour ne pas faire grossir la Map indéfiniment.
  if (memoryWindows.size > 5000) {
    for (const [k, timestamps] of memoryWindows) {
      if (timestamps.every((t) => now - t >= MEMORY_WINDOW_MS)) memoryWindows.delete(k);
    }
  }

  return { success: true, remaining: MEMORY_LIMIT - hits.length };
}

export async function checkRateLimit(
  key: string,
): Promise<{ success: boolean; remaining: number }> {
  const upstash = getLimiter();
  if (!upstash) return memoryCheck(key);

  try {
    const { success, remaining } = await upstash.limit(key);
    return { success, remaining };
  } catch (cause) {
    console.error('[rate-limit] Upstash injoignable, on laisse passer :', cause);
    // Fail-open ici, à l'inverse de la modération : une panne Redis ne doit pas
    // couper le produit. Le crédit reste la limite réelle.
    return { success: true, remaining: 0 };
  }
}
