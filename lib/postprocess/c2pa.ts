import 'server-only';
import { serverEnv } from '@/lib/env';

/**
 * Métadonnées de provenance C2PA — deuxième couche du marquage exigé par
 * l'article 50 de l'AI Act.
 *
 * Deux choses importantes, documentées ici parce qu'elles ont des conséquences
 * juridiques :
 *
 * 1. Une signature C2PA n'a de valeur probante que si le certificat est émis
 *    par une autorité reconnue. Sans `C2PA_CERT_PEM`, on signe avec le
 *    certificat de test livré par `c2pa-node` : le manifeste est structurellement
 *    valide et lisible par les outils de vérification, mais marqué comme non
 *    approuvé. C'est suffisant en développement, PAS en production.
 *
 * 2. Si la signature échoue, on ne bloque pas l'utilisateur — mais on ne fait
 *    pas semblant non plus : l'appelant reçoit `applied: false` et l'écrit dans
 *    la table `generations`. SynthID, apposé par le modèle lui-même, reste en
 *    place : l'image n'est donc jamais livrée totalement sans marquage.
 */

/**
 * Code IPTC standard désignant un média produit par un modèle génératif.
 * C'est la valeur que les outils de vérification (Content Credentials,
 * vérificateurs de presse) recherchent pour signaler un contenu IA.
 */
const IPTC_TRAINED_ALGORITHMIC_MEDIA =
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';

const CLAIM_GENERATOR = 'Fauxto/1.0.0 c2pa-node';

export interface C2paInput {
  image: Buffer;
  mimeType: string;
  /** Modèle ayant produit l'image, écrit tel quel dans le manifeste. */
  modelId: string;
  provider: string;
  templateNameFr: string;
}

export interface C2paResult {
  image: Buffer;
  /** Faux si la signature a échoué : à journaliser, jamais à ignorer. */
  applied: boolean;
  /** `production` si un vrai certificat a servi, `test` sinon. */
  signerKind: 'production' | 'test' | 'none';
  error?: string;
}

type LocalSignerLike = {
  type: 'local';
  certificate: Buffer;
  privateKey: Buffer;
  algorithm?: string;
};

async function resolveSigner(): Promise<{
  signer: LocalSignerLike;
  kind: 'production' | 'test';
}> {
  const certPem = serverEnv.c2paCertPem;
  const keyPem = serverEnv.c2paKeyPem;

  if (certPem && keyPem) {
    const { SigningAlgorithm } = await import('c2pa-node');
    return {
      signer: {
        type: 'local',
        certificate: Buffer.from(certPem, 'utf8'),
        privateKey: Buffer.from(keyPem, 'utf8'),
        algorithm: SigningAlgorithm.ES256,
      },
      kind: 'production',
    };
  }

  const { createTestSigner } = await import('c2pa-node');
  const signer = await createTestSigner();
  return { signer: signer as LocalSignerLike, kind: 'test' };
}

let warnedAboutTestSigner = false;

/**
 * Injecte le manifeste de provenance dans l'image et renvoie le fichier signé.
 * N'échoue jamais bruyamment : renvoie l'image d'origine avec `applied: false`.
 */
export async function embedC2paManifest(input: C2paInput): Promise<C2paResult> {
  try {
    // Import dynamique : `c2pa-node` est un module natif, on évite de le
    // charger au démarrage des routes qui ne signent rien.
    const { createC2pa, ManifestBuilder } = await import('c2pa-node');
    const { signer, kind } = await resolveSigner();

    if (kind === 'test' && !warnedAboutTestSigner) {
      warnedAboutTestSigner = true;
      console.warn(
        '[c2pa] Aucun certificat de production (C2PA_CERT_PEM). ' +
          'Les images sont signées avec le certificat de test : valide structurellement, ' +
          'mais NON approuvé par les vérificateurs. À corriger avant la mise en production.',
      );
    }

    const c2pa = createC2pa({ signer: signer as never, thumbnail: false });

    const manifest = new ManifestBuilder({
      claim_generator: CLAIM_GENERATOR,
      format: input.mimeType,
      title: `Fauxto — ${input.templateNameFr}`,
      assertions: [
        {
          label: 'c2pa.actions',
          data: {
            actions: [
              {
                action: 'c2pa.created',
                softwareAgent: `${input.provider}/${input.modelId}`,
                digitalSourceType: IPTC_TRAINED_ALGORITHMIC_MEDIA,
                when: new Date().toISOString(),
              },
            ],
          },
        },
        {
          // Assertion lisible par un humain qui ouvrirait les métadonnées.
          label: 'stds.schema-org.CreativeWork',
          data: {
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            creditText: 'Image générée par IA — Fauxto',
            abstract:
              "Photo modifiée par un modèle d'intelligence artificielle générative " +
              'dans un but de divertissement. Ne représente pas un fait réel.',
          },
        },
      ],
    });

    const { signedAsset } = await c2pa.sign({
      asset: { buffer: input.image, mimeType: input.mimeType },
      manifest,
    });

    return { image: signedAsset.buffer, applied: true, signerKind: kind };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    console.error('[c2pa] Signature impossible :', error);
    return { image: input.image, applied: false, signerKind: 'none', error };
  }
}
