/**
 * Conservation de la photo pendant l'aller-retour vers la connexion ou Stripe.
 *
 * Le tunnel est désormais : compte → choix du prank → photo → PAIEMENT →
 * génération. L'utilisateur quitte donc la page après avoir choisi sa photo, et
 * il faut la retrouver au retour. Sinon il doit tout recommencer juste après
 * avoir payé — le pire moment possible pour lui infliger une friction.
 *
 * Choix : `sessionStorage`, côté navigateur uniquement.
 *
 * On aurait pu la déposer sur le serveur avant paiement. C'est délibérément
 * écarté : ça reviendrait à stocker les photos de personnes qui n'ont jamais
 * payé, donc à conserver des visages sans contrepartie ni base légale claire.
 * Ici, la photo ne quitte l'appareil qu'au moment de la génération, une fois le
 * crédit acquis.
 *
 * `sessionStorage` se vide à la fermeture de l'onglet, ce qui borne
 * naturellement la durée de conservation.
 */

const KEY = 'fx_pending_photo';

/** Au-delà, on renonce plutôt que de faire échouer l'écriture du quota navigateur. */
const MAX_STORED_BYTES = 3_500_000;

export interface PendingPhoto {
  templateId: string;
  /** Data URL complète (`data:image/jpeg;base64,…`). */
  dataUrl: string;
  /** Saisies des templates à texte incrusté. */
  overlayInputs: Record<number, string>;
  savedAt: number;
}

/** Conserve la photo avant de quitter la page. Renvoie `false` si impossible. */
export function savePendingPhoto(photo: Omit<PendingPhoto, 'savedAt'>): boolean {
  try {
    if (photo.dataUrl.length > MAX_STORED_BYTES) return false;
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...photo, savedAt: Date.now() } satisfies PendingPhoto),
    );
    return true;
  } catch {
    // Quota dépassé ou stockage refusé (navigation privée stricte).
    return false;
  }
}

/**
 * Récupère la photo si elle correspond au prank demandé.
 * Un décalage de template signifierait que l'utilisateur a changé d'avis :
 * mieux vaut lui redemander une photo que d'en appliquer une au mauvais prank.
 */
export function loadPendingPhoto(templateId: string): PendingPhoto | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingPhoto;
    if (parsed.templateId !== templateId) return null;

    // Garde-fou : une photo vieille d'une heure vient d'une session oubliée.
    if (Date.now() - parsed.savedAt > 60 * 60 * 1000) {
      clearPendingPhoto();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPhoto(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Rien à faire : le stockage est déjà inaccessible.
  }
}

/** Convertit un `File` en data URL, pour le stockage. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture impossible'));
    reader.readAsDataURL(file);
  });
}

/** Reconstruit un `File` depuis une data URL conservée. */
export function dataUrlToFile(dataUrl: string, filename = 'photo.jpg'): File {
  const [header, payload] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
