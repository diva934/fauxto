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
  /**
   * Présent uniquement sur le prank libre : l'utilisateur écrit lui-même la
   * consigne envoyée au modèle.
   *
   * Sa seule présence change la nature du template — `prompt` n'est alors
   * qu'un repli, et la consigne réelle passe par `composeFreePrompt` APRÈS
   * être passée par `moderatePrompt`. Un texte utilisateur ne va jamais
   * directement au modèle d'image.
   */
  freePrompt?: {
    labelFr: string;
    placeholderFr: string;
    /** Doit rester aligné sur `MAX_PROMPT_LENGTH` de la modération. */
    maxLength: number;
  };
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
    id: 'voiture-reve',
    slug: 'voiture-de-reve',
    nameFr: 'La voiture de rêve',
    taglineFr: 'Sa caisse devient une Lamborghini',
    descriptionFr:
      'Remplace sa voiture par une Lamborghini Aventador SVJ, garée exactement au même endroit. Même place, même angle, même ombre — seule la voiture change. Marche d’autant mieux qu’il connaît sa propre bagnole par cœur.',
    // Le modèle connaît les modèles de voitures par leur nom : aucune banque
    // d'images n'est nécessaire. Ce qui demande de l'insistance, ce n'est pas
    // la Lamborghini, c'est de NE PAS bouger la caméra. Sans les contraintes de
    // position, le modèle recadre, déplace le sujet et change l'arrière-plan —
    // et le prank tombe, parce que ce qui rend l'image crédible c'est justement
    // que le décor soit reconnaissable.
    prompt:
      'Swap the vehicle in this photo for a matte olive-green Lamborghini Aventador SVJ, with its distinctive tall rear wing, exposed engine louvres and angular carbon bodywork. CRITICAL: the new car sits in the identical spot, seen from the identical camera angle, with its wheels touching the ground at the same points as the original car. Its shadow falls in the same direction with the same softness. Do not move the camera, do not change the framing, do not alter the background, the kerb, the road markings, the houses or the sky. The result must look like the same photo taken on a day when a different car was parked there. Photorealistic amateur smartphone photo, natural daylight.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/voiture-reve-avant.jpg',
    thumbnailAfter: '/samples/voiture-reve-apres.jpg',
    emoji: '🏎️',
  },
  {
    id: 'coupe-ratee',
    slug: 'coupe-de-cheveux-ratee',
    nameFr: 'Coupe de cheveux ratée',
    taglineFr: 'Le coiffeur a glissé',
    descriptionFr:
      "Transforme n'importe quelle coupe en catastrophe capillaire au bol. Le visage et le décor ne bougent pas : c'est ça qui rend le truc crédible.",
    prompt:
      'Give the person a genuinely botched home haircut. ALL of the following must be visible: clearly uneven lengths between the left and right sides; a crooked fringe cut too short and not level; at least one bald patch or gouge where the clippers went too deep; ragged, unblended edges around the ears and the neckline. It must read as an accident, not as a deliberate style — a neat bowl cut is wrong. Keep the face, expression, skin, clothing and background exactly as they are. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/coupe-ratee-avant.jpg',
    thumbnailAfter: '/samples/coupe-ratee-apres.jpg',
    emoji: '💇',
  },
  {
    id: 'telephone-casse',
    slug: 'telephone-casse',
    nameFr: 'Le téléphone cassé',
    taglineFr: 'Son écran ne s’en remettra pas',
    descriptionFr:
      'Fracasse l’écran de son téléphone. Le classique absolu : tout le monde a déjà vécu la seconde de panique en voyant son écran en miettes.',
    prompt:
      'Show the phone in this photo with a badly shattered screen. ALL of the following must be visible: a dense spiderweb of cracks radiating from one corner, several small glass splinters chipped away and missing along an edge, and thin bright glitch lines across the display. The damage must be obvious at a glance, not a hairline crack. Keep the phone in the exact same position and angle, and keep everything else in the photo identical — same surroundings, same lighting, same shadows. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/telephone-casse-avant.jpg',
    thumbnailAfter: '/samples/telephone-casse-apres.jpg',
    emoji: '📱',
  },
  {
    id: 'pneu-creve',
    slug: 'pneu-creve',
    nameFr: 'Le pneu crevé',
    taglineFr: 'Il va rentrer à pied',
    descriptionFr:
      'Dégonfle complètement un pneu de sa voiture. Moins violent que la rayure, mais tout aussi énervant — et beaucoup plus crédible sur un parking.',
    prompt:
      'The front tyre of this car has BURST. ALL of the following must be visible: the rubber is torn wide open with ragged black strips peeling away from the rim, chunks of shredded tread hanging loose and lying on the tarmac beside the wheel, and the bare metal rim exposed through the hole where the rubber has gone. What is left of the tyre is collapsed flat against the road. A round, intact tyre is WRONG. Keep the same car, same colour, same parking spot, same camera angle, same background, same lighting and shadows. No people, no other vehicles. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/pneu-creve-avant.jpg',
    thumbnailAfter: '/samples/pneu-creve-apres.jpg',
    emoji: '🛞',
  },
  {
    id: 'tele-cassee',
    slug: 'television-cassee',
    nameFr: 'La télé cassée',
    taglineFr: 'Fin de la soirée foot',
    descriptionFr:
      'Explose l’écran de sa télévision. La pièce ne bouge pas d’un millimètre — c’est ce qui rend la photo impossible à mettre en doute.',
    prompt:
      'Show the television in this room with a shattered screen. ALL of the following must be visible: a clear impact point with cracks radiating outward from it, large black bleeding patches of dead liquid crystal spreading from the cracks, and bright vertical lines across the rest of the panel. The television is switched off and dark apart from the damage. Keep the room strictly identical — same furniture, same walls, same camera angle, same lighting and shadows. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/tele-cassee-avant.jpg',
    thumbnailAfter: '/samples/tele-cassee-apres.jpg',
    emoji: '📺',
  },
  {
    id: 'chien-adopte',
    slug: 'chien-adopte',
    nameFr: 'Le chien adopté',
    taglineFr: 'Surprise, on a un chien',
    descriptionFr:
      'Installe un gros chien chez lui, comme s’il venait d’être adopté. Marche redoutablement bien envoyé à un conjoint ou à un colocataire.',
    prompt:
      'Add one large adult dog sitting calmly in the middle of this room, facing the camera. The dog must be at correct real-world scale for the room, with its paws firmly on the floor, casting a soft shadow in the same direction as the other shadows in the photo, and its fur lit by the same light as the rest of the scene. Keep the room strictly identical — same furniture, same walls, same camera angle, same lighting. No people. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/chien-adopte-avant.jpg',
    thumbnailAfter: '/samples/chien-adopte-apres.jpg',
    emoji: '🐶',
  },
  {
    id: 'crane-rase',
    slug: 'crane-rase',
    nameFr: 'Le crâne rasé',
    taglineFr: 'Plus un cheveu',
    descriptionFr:
      'Rase entièrement la tête de ton pote. Le visage et le décor restent identiques, et c’est précisément ce contraste qui fait douter.',
    prompt:
      'Shave the person\'s head completely bald, down to the skin. The scalp must be visibly paler than the face, with a faint tan line where the hairline used to be, and show realistic skin texture and a soft highlight from the ambient light. No stubble pattern, no hair left anywhere. Keep the face, expression, ears, eyebrows, skin tone, clothing, background, camera angle and lighting exactly as they are. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/crane-rase-avant.jpg',
    thumbnailAfter: '/samples/crane-rase-apres.jpg',
    emoji: '🪒',
  },
  {
    id: 'fuite-eau',
    slug: 'fuite-d-eau',
    nameFr: 'La fuite d’eau',
    taglineFr: 'Ça vient du plafond',
    descriptionFr:
      'Fais couler l’eau du plafond chez lui. Le genre de photo qui déclenche un appel immédiat, parce que personne ne plaisante avec un dégât des eaux.',
    prompt:
      'Show this room with a serious water leak coming from the ceiling. ALL of the following must be visible: a large dark damp stain spreading across the ceiling with a sagging bulge at its centre, water running down the wall in wet streaks, drips falling, and a wide puddle on the floor that reflects the room. Keep the room strictly identical — same furniture, same camera angle, same lighting and shadows. No people. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/fuite-eau-avant.jpg',
    thumbnailAfter: '/samples/fuite-eau-apres.jpg',
    emoji: '💧',
  },
  {
    id: 'bague-fiancailles',
    slug: 'bague-de-fiancailles',
    nameFr: 'La bague de fiançailles',
    taglineFr: 'Annonce-le sans le dire',
    descriptionFr:
      'Ajoute une bague de fiançailles à son doigt. Aucune violence, aucun dégât — juste une nouvelle que personne ne voit venir.',
    prompt:
      'Add a large diamond engagement ring on the ring finger of the person\'s left hand. The ring must sit correctly on the finger, follow its curve, and catch the same light as the skin around it, with a realistic sparkle on the stone. Keep the hand in the exact same position, and keep the face, expression, clothing, background, camera angle and lighting identical. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/bague-fiancailles-avant.jpg',
    thumbnailAfter: '/samples/bague-fiancailles-apres.jpg',
    emoji: '💍',
  },
  {
    id: 'peinture-renversee',
    slug: 'peinture-renversee',
    nameFr: 'La peinture renversée',
    taglineFr: 'Le pot est tombé',
    descriptionFr:
      'Renverse un gros pot de peinture par terre chez lui. Sur un parquet ou un tapis clair, l’effet est immédiat.',
    prompt:
      'Show a large metal paint tin knocked over on the floor of this room, lying on its side, with a wide pool of thick white paint spreading out from it across the floor. ALL of the following must be visible: the pool with a raised glossy edge, several splashes and droplets thrown further out, and paint soaking into whatever surface it has landed on. Keep the room strictly identical — same furniture, same walls, same camera angle, same lighting and shadows. No people. Photorealistic amateur smartphone photo.',
    aspectRatio: '4:5',
    model: 'flash',
    thumbnailBefore: '/samples/peinture-renversee-avant.jpg',
    thumbnailAfter: '/samples/peinture-renversee-apres.jpg',
    emoji: '🪣',
  },
  {
    id: 'personnalise',
    slug: 'personnalise',
    nameFr: 'Personnalisé',
    taglineFr: 'Ta photo, ton idée',
    descriptionFr:
      'Envoie une photo, écris ce que tu veux changer, et l’IA le fait. Les onze autres pranks sont calibrés ; celui-ci ne l’est pas — c’est le prix de la liberté.',
    // `prompt` n'est qu'un repli, jamais utilisé en pratique : la consigne
    // réelle vient de l'utilisateur et passe par `composeFreePrompt`. Il sert
    // de garde-fou si `freePrompt` venait à disparaître par erreur.
    prompt:
      'Make a subtle, harmless and photorealistic change to this photo. Keep the person, framing, background and lighting identical.',
    freePrompt: {
      labelFr: 'Que veux-tu changer ?',
      placeholderFr: 'ex : remplace ma voiture par une Ferrari rouge',
      // Aligné sur MAX_PROMPT_LENGTH dans lib/moderation/prompt.ts.
      maxLength: 300,
    },
    aspectRatio: '4:5',
    model: 'flash',
    // La vignette montre le PRINCIPE, pas un prank du catalogue : une pièce
    // ordinaire dont seule la fenêtre change de monde. Un exemple précis aurait
    // laissé croire que la case ne fait que ça, alors que le résultat dépend
    // entièrement de la demande. Les deux images sont des sorties réelles du
    // produit, enchaînées depuis la même photo — d'où la pièce strictement
    // identique d'une image à l'autre, qui est la signature du service.
    thumbnailBefore: '/samples/personnalise-cuisine-avant.jpg',
    thumbnailAfter: '/samples/personnalise-cuisine-apres.jpg',
    emoji: '✨',
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
