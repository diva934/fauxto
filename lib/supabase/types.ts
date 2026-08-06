/**
 * Types de la base, écrits à la main plutôt que générés.
 *
 * Le schéma est petit et stable ; une génération automatique ajouterait une
 * étape de build pour peu de bénéfice. Si le schéma grossit, bascule sur
 * `supabase gen types typescript`.
 *
 * ⚠️ La forme de ce type doit satisfaire exactement `GenericSchema` de
 * postgrest-js, sinon TypeScript résout silencieusement toutes les tables en
 * `never` et tous les arguments de `rpc()` en `undefined` — sans erreur sur le
 * type lui-même, seulement à l'usage. Deux pièges en particulier :
 *   · chaque table doit porter `Relationships` (même vide) ;
 *   · les sections vides s'écrivent `{ [_ in never]: never }`, pas
 *     `Record<string, never>` (`never` ne satisfait pas `GenericView`) ;
 *   · les entités sont des ALIAS DE TYPE, jamais des `interface`. C'est le
 *     piège le plus coûteux : `GenericTable.Row` attend
 *     `Record<string, unknown>`, et TypeScript n'accorde de signature d'index
 *     implicite qu'aux alias de type. Une `interface` ici fait échouer la
 *     contrainte en silence, et tout le schéma se résout en `never` — sans
 *     erreur sur le type, seulement à l'usage.
 */

export type Profile = {
  id: string;
  credits: number;
  created_at: string;
};

export type AnonSession = {
  id: string;
  fingerprint: string;
  free_used: boolean;
  created_at: string;
};

export type GenerationStatus = 'pending' | 'done' | 'failed';

export type Generation = {
  id: string;
  user_id: string | null;
  anon_session_id: string | null;
  template_id: string;
  status: GenerationStatus;
  provider: string | null;
  model_id: string | null;
  output_path: string | null;
  watermarked: boolean;
  cost_cents: number | null;
  moderation_flag: string | null;
  error_message: string | null;
  c2pa_applied: boolean;
  c2pa_signer: string | null;
  created_at: string;
  purge_after: string;
};

export type CreditTransaction = {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  stripe_session_id: string | null;
  generation_id: string | null;
  created_at: string;
};

export type ReportReason =
  | 'minor'
  | 'sexual_content'
  | 'my_image'
  | 'harassment'
  | 'other';

export type Report = {
  id: string;
  reason: ReportReason;
  message: string;
  contact_email: string | null;
  generation_id: string | null;
  status: 'open' | 'reviewed' | 'actioned';
  created_at: string;
};

export type Partner = {
  id: string;
  /** `null` pour un code créé par l'exploitant, que personne ne consulte encore. */
  user_id: string | null;
  code: string;
  display_name: string | null;
  commission_rate: number;
  created_at: string;
};

export type PartnerClick = {
  id: string;
  partner_id: string;
  visitor_hash: string | null;
  created_at: string;
};

export type PartnerConversion = {
  id: string;
  partner_id: string;
  user_id: string | null;
  stripe_session_id: string;
  amount_cents: number;
  commission_cents: number;
  created_at: string;
};

/** Ligne unique renvoyée par `partner_stats`. Tous les compteurs sont agrégés. */
export type PartnerStats = {
  code: string;
  commission_rate: number;
  clicks: number;
  unique_visitors: number;
  conversions: number;
  revenue_cents: number;
  commission_cents: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      anon_sessions: {
        Row: AnonSession;
        Insert: Partial<AnonSession> & { fingerprint: string };
        Update: Partial<AnonSession>;
        Relationships: [];
      };
      generations: {
        Row: Generation;
        Insert: Partial<Generation> & { template_id: string; status: GenerationStatus };
        Update: Partial<Generation>;
        Relationships: [];
      };
      credit_transactions: {
        Row: CreditTransaction;
        Insert: Partial<CreditTransaction> & {
          user_id: string;
          delta: number;
          reason: string;
        };
        Update: Partial<CreditTransaction>;
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: Partial<Report> & { reason: ReportReason; message: string };
        Update: Partial<Report>;
        Relationships: [];
      };
      partners: {
        Row: Partner;
        Insert: Partial<Partner> & { code: string };
        Update: Partial<Partner>;
        Relationships: [];
      };
      partner_clicks: {
        Row: PartnerClick;
        Insert: Partial<PartnerClick> & { partner_id: string };
        Update: Partial<PartnerClick>;
        Relationships: [];
      };
      partner_conversions: {
        Row: PartnerConversion;
        Insert: Partial<PartnerConversion> & {
          partner_id: string;
          stripe_session_id: string;
          amount_cents: number;
          commission_cents: number;
        };
        Update: Partial<PartnerConversion>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      reserve_credit: { Args: { p_user_id: string }; Returns: boolean };
      confirm_credit: {
        Args: { p_user_id: string; p_generation_id: string; p_reason?: string };
        Returns: undefined;
      };
      refund_credit: {
        Args: { p_user_id: string; p_generation_id: string | null; p_reason?: string };
        Returns: undefined;
      };
      grant_credits: {
        Args: {
          p_user_id: string;
          p_delta: number;
          p_reason: string;
          p_stripe_session_id: string;
        };
        Returns: boolean;
      };
      claim_free_generation: {
        Args: { p_fingerprint: string };
        Returns: { session_id: string; granted: boolean }[];
      };
      release_free_generation: { Args: { p_session_id: string }; Returns: undefined };
      weekly_generation_count: { Args: Record<string, never>; Returns: number };
      expired_generation_paths: {
        Args: { p_limit?: number };
        Returns: { id: string; output_path: string }[];
      };
      mark_generations_purged: { Args: { p_ids: string[] }; Returns: number };
      create_partner: {
        Args: { p_user_id: string; p_code: string; p_display_name?: string | null };
        Returns: { partner_id: string | null; code: string | null; created: boolean }[];
      };
      record_partner_click: {
        Args: { p_code: string; p_visitor_hash: string | null };
        Returns: boolean;
      };
      record_partner_conversion: {
        Args: {
          p_code: string;
          p_user_id: string;
          p_stripe_session_id: string;
          p_amount_cents: number;
        };
        Returns: boolean;
      };
      partner_stats: { Args: { p_user_id: string }; Returns: PartnerStats[] };
      create_partner_code: {
        Args: { p_code: string; p_label: string; p_commission_rate?: number };
        Returns: { partner_id: string; code: string; created: boolean }[];
      };
      claim_partner_code: {
        Args: { p_code: string; p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Bucket Storage privé où atterrissent les images générées. */
export const GENERATIONS_BUCKET = 'generations';
