import type { AspectRatio } from '@/lib/image-engine/types';

/**
 * Palier de modèle demandé par un template.
 *
 * On ne met JAMAIS d'identifiant de modèle concret ici : ce fichier est importé
 * par des composants client, et le produit n'a pas à connaître le fournisseur.
 * La traduction palier -> identifiant vit dans `lib/image-engine/`.
 */
export type ModelTier = 'flash' | 'pro';

/**
 * Texte incrusté côté serveur avec sharp, jamais généré par le modèle.
 * Le rendu de texte par un modèle d'image est peu fiable, et on veut
 * contrôler la typo, la langue et l'orthographe — sans compter que ça permet
 * de personnaliser (le prénom de la victime sur le chèque).
 */
export interface TextOverlaySlot {
  /** Position relative dans l'image, en fraction de largeur/hauteur (0-1). */
  x: number;
  y: number;
  /** Largeur maximale de la zone de texte, en fraction de la largeur. */
  maxWidth: number;
  /** Taille de police en fraction de la hauteur de l'image. */
  fontScale: number;
  color: string;
  align: 'left' | 'center' | 'right';
  /** Valeur par défaut si l'utilisateur ne personnalise rien. */
  defaultText: string;
  /** Si défini, l'utilisateur peut saisir cette valeur (ex : prénom). */
  userInputLabelFr?: string;
  /** Gabarit où `{input}` est remplacé par la saisie utilisateur. */
  template?: string;
  uppercase?: boolean;
}

export interface PrankTemplate {
  id: string;
  /** Utilisé pour l'URL SEO /prank/[slug]. */
  slug: string;
  nameFr: string;
  descriptionFr: string;
  /** Accroche courte pour la carte du sélecteur. */
  taglineFr: string;
  /** Prompt d'édition en anglais — les modèles y réagissent mieux. */
  prompt: string;
  aspectRatio: AspectRatio;
  model: ModelTier;
  thumbnailBefore: string;
  thumbnailAfter: string;
  /** Emoji utilisé comme repère visuel dans l'interface. */
  emoji: string;
  textOverlays?: TextOverlaySlot[];
}

export const TEMPLATES: readonly PrankTemplate[] = [
  {
    id: 'voiture-rayee',
    slug: 'voiture-rayee',
    nameFr: 'La voiture rayée',
    taglineFr: 'Sa caisse, mais en moins bien',
    descriptionFr:
      "Ajoute une belle rayure et un pare-chocs cabossé sur la voiture de ton pote. Le classique qui déclenche un appel en moins de deux minutes.",
    prompt:
      'Show this exact car after a serious side collision. ALL of the following must be clearly visible: a deep gouge running along the full length of the side panels, cutting through the paint down to bare grey metal and primer; the front wing and the door panel crumpled and buckled inward so the panel gaps no longer line up; the front bumper corner cracked and pulled away from the body; scattered paint flakes and scuff marks around the impact zone. The damage must be obvious at a glance from ten metres away, not a light scuff or a surface scratch. Keep the same car, same colour, same position, same angle, same background, same lighting and shadows. No people, no other vehicles, no blood. Photorealistic amateur smartphone photo taken in natural daylight.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/voiture-rayee-avant.jpg',
    thumbnailAfter: '/samples/voiture-rayee-apres.jpg',
    emoji: '🚗',
  },
  {
    id: 'coupe-ratee',
    slug: 'coupe-de-cheveux-ratee',
    nameFr: 'Coupe de cheveux ratée',
    taglineFr: 'Le coiffeur a glissé',
    descriptionFr:
      "Transforme n'importe quelle coupe en catastrophe capillaire au bol. Le visage et le décor ne bougent pas : c'est ça qui rend le truc crédible.",
    prompt:
      'Change only the hairstyle of the person to a comically bad, uneven bowl haircut. Preserve the face, expression, clothing and background exactly. Photorealistic.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/coupe-ratee-avant.jpg',
    thumbnailAfter: '/samples/coupe-ratee-apres.jpg',
    emoji: '💇',
  },
  {
    id: 'dans-40-ans',
    slug: 'dans-40-ans',
    nameFr: 'Dans 40 ans',
    taglineFr: 'Un aperçu du futur',
    descriptionFr:
      'Vieillis ton pote de quarante ans : cheveux gris, rides, peau marquée. Même pose, même décor, juste quatre décennies de plus.',
    prompt:
      'Age the person in this photo by 40 years realistically: grey hair, natural wrinkles, aged skin texture. Keep the same pose, clothing and background. Photorealistic portrait.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/dans-40-ans-avant.jpg',
    thumbnailAfter: '/samples/dans-40-ans-apres.jpg',
    emoji: '👴',
  },
  {
    id: 'bodybuilder',
    slug: 'bodybuilder',
    nameFr: 'Bodybuilder',
    taglineFr: 'Six mois de salle en une seconde',
    descriptionFr:
      "Colle une musculature de compétition sur le corps de ton pote, en gardant son visage intact. L'écart entre les deux fait tout le sel.",
    prompt:
      "Transform the person's body into an extremely muscular bodybuilder physique, comically exaggerated. Keep the face and background unchanged. Photorealistic.",
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/bodybuilder-avant.jpg',
    thumbnailAfter: '/samples/bodybuilder-apres.jpg',
    emoji: '💪',
  },
  {
    id: 'gagnant-loto',
    slug: 'gagnant-du-loto',
    nameFr: 'Gagnant du loto',
    taglineFr: 'Le chèque géant',
    descriptionFr:
      "Met un chèque géant entre les mains de ton pote. Tu choisis le prénom écrit dessus : c'est ce détail qui rend le canular imparable.",
    prompt:
      "Place a giant oversized novelty cheque in the person's hands, held in front of them. The cheque is blank white with no text. Photorealistic, keep face and background.",
    aspectRatio: '4:5',
    model: 'pro',
    thumbnailBefore: '/samples/gagnant-loto-avant.jpg',
    thumbnailAfter: '/samples/gagnant-loto-apres.jpg',
    emoji: '🎰',
    textOverlays: [
      {
        x: 0.5,
        y: 0.52,
        maxWidth: 0.6,
        fontScale: 0.038,
        color: '#1a1a1a',
        align: 'center',
        defaultText: 'À L’ORDRE DE : TOI',
        userInputLabelFr: 'Le prénom sur le chèque',
        template: 'À L’ORDRE DE : {input}',
        uppercase: true,
      },
      {
        x: 0.5,
        y: 0.6,
        maxWidth: 0.5,
        fontScale: 0.055,
        color: '#0f5132',
        align: 'center',
        defaultText: '1 000 000 €',
      },
    ],
  },
  {
    id: 'tatouage-rate',
    slug: 'tatouage-rate',
    nameFr: 'Le tatouage raté',
    taglineFr: 'Encre définitive, regret immédiat',
    descriptionFr:
      "Ajoute un tatouage franchement mal dessiné sur l'avant-bras. Assez réaliste pour y croire, assez moche pour paniquer.",
    prompt:
      "Add a large, badly drawn amateur tattoo on the person's forearm. Photorealistic tattoo ink on skin. Keep everything else identical.",
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/tatouage-rate-avant.jpg',
    thumbnailAfter: '/samples/tatouage-rate-apres.jpg',
    emoji: '🖊️',
  },
  {
    id: 'lion-salon',
    slug: 'un-lion-dans-le-salon',
    nameFr: 'Un lion dans le salon',
    taglineFr: 'Nouveau colocataire',
    descriptionFr:
      "Installe un lion posé tranquillement au fond de la pièce, à la bonne échelle et avec la bonne lumière. Personne ne regarde le canapé après ça.",
    prompt:
      'Add a large realistic lion sitting calmly in the background of this indoor scene, correctly scaled and lit to match the room. Photorealistic.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/lion-salon-avant.jpg',
    thumbnailAfter: '/samples/lion-salon-apres.jpg',
    emoji: '🦁',
  },
  {
    id: 'dubai',
    slug: 'teleporte-a-dubai',
    nameFr: 'Téléporté à Dubaï',
    taglineFr: 'Parti sans rien dire',
    descriptionFr:
      "Remplace le décor par un balcon de gratte-ciel à Dubaï au coucher du soleil, en gardant la personne parfaitement intacte. Idéal pour un « désolé, j'ai pris l'avion ce matin ».",
    prompt:
      'Replace only the background with the view from a high-rise apartment balcony over the Dubai skyline at sunset, glass balustrade in the foreground, tall towers and warm golden light. Keep the person perfectly intact with matched warm lighting and edge blending. Photorealistic.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/dubai-avant.jpg',
    thumbnailAfter: '/samples/dubai-apres.jpg',
    emoji: '🌇',
  },
  {
    id: 'une-magazine',
    slug: 'la-une-du-magazine',
    nameFr: 'La une du magazine',
    taglineFr: 'En couverture, rien que ça',
    descriptionFr:
      'Transforme la photo en couverture de magazine glacé. Tu écris le titre toi-même : la typo est propre, pas générée à l’arrache par un modèle.',
    // « no brand names, no logos » est indispensable : sans cette consigne, le
    // modèle remplit spontanément la couverture avec une marque de presse
    // réelle. Une fausse couverture d'un titre existant sur un service payant,
    // c'est une contrefaçon de marque — et les éditeurs de presse défendent la
    // leur. Les zones de texte doivent rester vides : c'est `sharp` qui écrit.
    prompt:
      'Turn this photo into a glossy fashion magazine cover layout, with realistic paper texture and cover framing. Leave all text areas completely blank and empty. No brand names, no logos, no magazine titles, no words anywhere in the image.',
    aspectRatio: '4:5',
    model: 'pro',
    thumbnailBefore: '/samples/une-magazine-avant.jpg',
    thumbnailAfter: '/samples/une-magazine-apres.jpg',
    emoji: '📰',
    textOverlays: [
      {
        x: 0.5,
        y: 0.08,
        maxWidth: 0.8,
        fontScale: 0.1,
        color: '#ffffff',
        align: 'center',
        // Nom de fantaisie, JAMAIS un titre de presse existant. Le texte par
        // défaut est ce que produisent la plupart des utilisateurs (ils ne
        // personnalisent pas), donc c'est lui qui déterminerait l'exposition du
        // service à une contrefaçon de marque.
        defaultText: 'FAUXTO',
        userInputLabelFr: 'Le nom du magazine',
        template: '{input}',
        uppercase: true,
      },
      {
        x: 0.5,
        y: 0.82,
        maxWidth: 0.75,
        fontScale: 0.042,
        color: '#ffffff',
        align: 'center',
        defaultText: 'LA PERSONNALITÉ DE L’ANNÉE',
        userInputLabelFr: 'Le titre de couverture',
        template: '{input}',
        uppercase: true,
      },
    ],
  },
  {
    id: 'deguisement',
    slug: 'le-deguisement-surprise',
    nameFr: 'Le déguisement surprise',
    taglineFr: 'Costume intégral, visage visible',
    descriptionFr:
      "Habille ton pote d'une mascotte absurde en gardant son visage parfaitement reconnaissable. Aucun doute possible sur l'identité de la victime.",
    // Le prompt d'origine du cahier des charges (« Dress the person in an
    // absurd full-body mascot costume… ») s'est fait REFUSER par le filtre de
    // sécurité du fournisseur lors du test réel — faux positif, probablement
    // déclenché par « dress the person » + « full-body ». Cette reformulation
    // décrit le costume plutôt que l'action d'habiller quelqu'un, et passe.
    // À revérifier si tu changes de fournisseur.
    prompt:
      "Replace the person's clothing with a giant fluffy cartoon animal mascot suit, like a sports team mascot. The oversized costume head is removed so their own face stays fully visible and unchanged. Bright colours, plush fabric texture, photorealistic, keep the same background.",
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/deguisement-avant.jpg',
    thumbnailAfter: '/samples/deguisement-apres.jpg',
    emoji: '🎭',
  },
] as const;

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));
const BY_SLUG = new Map(TEMPLATES.map((t) => [t.slug, t]));

export function getTemplateById(id: string): PrankTemplate | undefined {
  return BY_ID.get(id);
}

export function getTemplateBySlug(slug: string): PrankTemplate | undefined {
  return BY_SLUG.get(slug);
}

export function isTemplateId(id: string): boolean {
  return BY_ID.has(id);
}
