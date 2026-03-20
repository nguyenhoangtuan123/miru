export type ImageAsset = {
  url?: string | null;
  name?: string | null;
  source?: string | null;
};

export type TherapistPublicProfile = {
  therapist_id: string;
  display_name: string;
  full_name?: string | null;
  headline?: string | null;
  bio?: string | null;
  specializations: string[];
  specialties?: string[];
  avatar_image?: ImageAsset | null;
  avatar_url?: string | null;
  accepting_new_clients: boolean;
  contact_requests_enabled?: boolean;
  service_mode: 'free' | 'paid' | 'both' | string;
  starting_price_vnd?: number | null;
  starting_price?: number | null;
  currency?: string;
  pricing_unit: 'session' | 'package' | 'custom' | string;
  pricing_note?: string | null;
  public_workflow_steps: string[];
  can_receive_contact_requests: boolean;
  is_verified: boolean;
  contact_request_count: number;
  pair_conversion_count: number;
  profile_view_count: number;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_zalo_url?: string | null;
  contact_facebook_url?: string | null;
  contact_website_url?: string | null;
  location?: string | null;
  languages?: string[];
  status?: string | null;
  updated_at?: string | null;
};

export type PublicTherapist = TherapistPublicProfile;

export type PublicArticleAuthor = {
  therapist_id?: string | null;
  display_name?: string | null;
  headline?: string | null;
  avatar_image?: ImageAsset | null;
  specializations?: string[];
  is_verified?: boolean;
  profile_url?: string | null;
};

export type PublicArticle = {
  id: string | number;
  therapist_id?: string | null;
  therapist_name?: string | null;
  title: string;
  slug: string;
  topic_tags?: string[];
  excerpt?: string | null;
  cover_image_url?: string | null;
  content_markdown?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  status?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  therapist?: PublicArticleAuthor | null;
};

export type TherapistArticle = PublicArticle;

export type ArticleSummary = PublicArticle & {
  author_name?: string | null;
  author_therapist_id?: string | null;
  tags?: string[];
  reading_time_minutes?: number | null;
};

export type ArticleDetail = ArticleSummary & {
  canonical_url?: string | null;
};

export type ArticleListResponse = {
  success: boolean;
  count?: number;
  articles: PublicArticle[];
};

export type ArticleDetailResponse = {
  success: boolean;
  article: PublicArticle | null;
};

export type PublicRecommendationResponse<TItem> = {
  success: boolean;
  reason_tags: string[];
  items: TItem[];
};

export type TherapistListResponse = {
  success: boolean;
  therapists: PublicTherapist[];
};

export type TherapistDetailResponse = {
  success: boolean;
  profile: PublicTherapist;
};
