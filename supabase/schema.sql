CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contributors table
CREATE TABLE public.contributors (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  sumsub_status TEXT DEFAULT 'pending' CHECK (sumsub_status IN ('pending', 'green', 'red', 'retry')),
  sumsub_applicant_id TEXT,
  instagram_username TEXT,
  instagram_token TEXT,
  paypal_email TEXT,
  photo_count INTEGER DEFAULT 0,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  consent_version TEXT,
  consent_details JSONB,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  opted_out BOOLEAN DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,
  display_name TEXT,
  deletion_requested_at TIMESTAMPTZ,
  deletion_scheduled_for TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uploaded/imported photos tracking
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID REFERENCES public.contributors(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('instagram', 'manual')),
  file_path TEXT NOT NULL,
  original_url TEXT,
  file_size BIGINT,
  bucket TEXT NOT NULL,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'active', 'pending_review', 'flagged', 'removed')),
  display_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  removal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID REFERENCES public.contributors(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Earnings
CREATE TABLE public.earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID REFERENCES public.contributors(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'held')),
  description TEXT,
  paid_at TIMESTAMPTZ,
  payout_batch_id TEXT,
  payout_item_id TEXT,
  payout_failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout batches (PayPal batch payout tracking)
CREATE TABLE public.payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_batch_id TEXT NOT NULL UNIQUE,
  paypal_batch_id TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','processing','success','partial_success','failed','cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  succeeded_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  initiated_by UUID NOT NULL REFERENCES public.admin_users(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Notification preferences
CREATE TABLE public.notification_preferences (
  contributor_id UUID PRIMARY KEY REFERENCES public.contributors(id) ON DELETE CASCADE,
  email_earnings BOOLEAN DEFAULT TRUE,
  email_photo_status BOOLEAN DEFAULT TRUE,
  email_platform_updates BOOLEAN DEFAULT TRUE,
  email_security_alerts BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.contributors FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.contributors FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.contributors FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own uploads"
  ON public.uploads FOR SELECT USING (auth.uid() = contributor_id);
CREATE POLICY "Users can insert own uploads"
  ON public.uploads FOR INSERT WITH CHECK (auth.uid() = contributor_id);
CREATE POLICY "Users can update own uploads"
  ON public.uploads FOR UPDATE USING (auth.uid() = contributor_id);

CREATE POLICY "Users can view own activity"
  ON public.activity_log FOR SELECT USING (auth.uid() = contributor_id);
CREATE POLICY "Users can insert own activity"
  ON public.activity_log FOR INSERT WITH CHECK (auth.uid() = contributor_id);

CREATE POLICY "Users can view own earnings"
  ON public.earnings FOR SELECT USING (auth.uid() = contributor_id);

CREATE POLICY "Admins can view payout batches"
  ON public.payout_batches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "Users can view own preferences"
  ON public.notification_preferences FOR SELECT USING (auth.uid() = contributor_id);
CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE USING (auth.uid() = contributor_id);
CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = contributor_id);

-- =============================================
-- Marketplace / Bounty Board tables
-- =============================================

-- Admin users (role-based access)
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'reviewer' CHECK (role IN ('reviewer', 'admin', 'super_admin')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Bounty requests (core bounty posting)
CREATE TABLE public.bounty_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.admin_users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  model_context TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_review','published','paused','fulfilled','closed','cancelled'
  )),
  scenario_tags TEXT[] DEFAULT '{}',
  setting_tags TEXT[] DEFAULT '{}',
  category TEXT NOT NULL CHECK (category IN (
    'portrait','full_body','lifestyle','fashion','fitness',
    'artistic','professional','casual','themed','other'
  )),
  target_hair_colors TEXT[],
  target_eye_colors TEXT[],
  target_skin_tones TEXT[],
  target_body_types TEXT[],
  target_age_range_min INTEGER,
  target_age_range_max INTEGER,
  target_genders TEXT[],
  target_ethnicities TEXT[],
  pay_type TEXT NOT NULL CHECK (pay_type IN ('per_image','per_set')),
  pay_amount_cents INTEGER NOT NULL,
  set_size INTEGER,
  speed_bonus_cents INTEGER DEFAULT 0,
  speed_bonus_deadline TIMESTAMPTZ,
  quality_bonus_cents INTEGER DEFAULT 0,
  budget_total_cents INTEGER NOT NULL,
  budget_spent_cents INTEGER DEFAULT 0,
  quantity_needed INTEGER NOT NULL,
  quantity_fulfilled INTEGER DEFAULT 0,
  min_resolution_width INTEGER DEFAULT 1024,
  min_resolution_height INTEGER DEFAULT 1024,
  accepted_formats TEXT[] DEFAULT ARRAY['image/jpeg','image/png'],
  max_file_size_bytes BIGINT DEFAULT 20971520,
  quality_guidelines TEXT,
  estimated_effort TEXT,
  visibility TEXT NOT NULL DEFAULT 'open' CHECK (visibility IN ('open','targeted','invite_only')),
  deadline TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.admin_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bounty submissions (contributor submissions)
CREATE TABLE public.bounty_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.bounty_requests(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES public.contributors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','in_review','accepted','revision_requested','rejected','withdrawn'
  )),
  reviewed_by UUID REFERENCES public.admin_users(id),
  reviewed_at TIMESTAMPTZ,
  review_feedback TEXT,
  revision_count INTEGER DEFAULT 0,
  earned_amount_cents INTEGER DEFAULT 0,
  bonus_amount_cents INTEGER DEFAULT 0,
  earning_id UUID REFERENCES public.earnings(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  UNIQUE(request_id, contributor_id)
);

-- Submission images (individual photos in a submission)
CREATE TABLE public.submission_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.bounty_submissions(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES public.contributors(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  bucket TEXT NOT NULL,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  caption TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bounty bookmarks (saved requests)
CREATE TABLE public.bounty_bookmarks (
  contributor_id UUID NOT NULL REFERENCES public.contributors(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.bounty_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contributor_id, request_id)
);

-- Contributor attributes (opt-in matching profile, Phase 3)
CREATE TABLE public.contributor_attributes (
  contributor_id UUID PRIMARY KEY REFERENCES public.contributors(id) ON DELETE CASCADE,
  hair_color TEXT,
  eye_color TEXT,
  skin_tone TEXT,
  body_type TEXT,
  age_range TEXT CHECK (age_range IS NULL OR age_range IN ('18-24','25-34','35-44','45-54','55+')),
  gender TEXT,
  ethnicity TEXT,
  self_description TEXT,
  share_hair_color BOOLEAN DEFAULT FALSE,
  share_eye_color BOOLEAN DEFAULT FALSE,
  share_skin_tone BOOLEAN DEFAULT FALSE,
  share_body_type BOOLEAN DEFAULT FALSE,
  share_age_range BOOLEAN DEFAULT FALSE,
  share_gender BOOLEAN DEFAULT FALSE,
  share_ethnicity BOOLEAN DEFAULT FALSE,
  blocked_categories TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bounty invitations (Phase 3)
CREATE TABLE public.bounty_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.bounty_requests(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES public.contributors(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.admin_users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','viewed','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, contributor_id)
);

-- Bounty reports (Phase 3)
CREATE TABLE public.bounty_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.bounty_requests(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.contributors(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('uncomfortable','discriminatory','inappropriate','misleading','other')),
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  reviewed_by UUID REFERENCES public.admin_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add bounty notification preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_bounty_matches BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_bounty_updates BOOLEAN DEFAULT TRUE;

-- RLS for marketplace tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributor_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_reports ENABLE ROW LEVEL SECURITY;

-- Admin users RLS
CREATE POLICY "Admins can view all admins"
  ON public.admin_users FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Super admins can insert admins"
  ON public.admin_users FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role = 'super_admin'));

-- Bounty requests RLS
CREATE POLICY "Contributors can view published requests"
  ON public.bounty_requests FOR SELECT TO authenticated
  USING (status = 'published' OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
CREATE POLICY "Admins can insert requests"
  ON public.bounty_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can update requests"
  ON public.bounty_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Bounty submissions RLS
CREATE POLICY "Contributors can view own submissions"
  ON public.bounty_submissions FOR SELECT TO authenticated
  USING (contributor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
CREATE POLICY "Contributors can insert own submissions"
  ON public.bounty_submissions FOR INSERT TO authenticated
  WITH CHECK (contributor_id = auth.uid());
CREATE POLICY "Contributors can update own submissions"
  ON public.bounty_submissions FOR UPDATE TO authenticated
  USING (contributor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Submission images RLS
CREATE POLICY "Contributors can view own submission images"
  ON public.submission_images FOR SELECT TO authenticated
  USING (contributor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
CREATE POLICY "Contributors can insert own submission images"
  ON public.submission_images FOR INSERT TO authenticated
  WITH CHECK (contributor_id = auth.uid());

-- Bounty bookmarks RLS
CREATE POLICY "Contributors can view own bookmarks"
  ON public.bounty_bookmarks FOR SELECT TO authenticated
  USING (contributor_id = auth.uid());
CREATE POLICY "Contributors can insert own bookmarks"
  ON public.bounty_bookmarks FOR INSERT TO authenticated
  WITH CHECK (contributor_id = auth.uid());
CREATE POLICY "Contributors can delete own bookmarks"
  ON public.bounty_bookmarks FOR DELETE TO authenticated
  USING (contributor_id = auth.uid());

-- Contributor attributes RLS
CREATE POLICY "Contributors can view own attributes"
  ON public.contributor_attributes FOR SELECT TO authenticated
  USING (contributor_id = auth.uid());
CREATE POLICY "Contributors can insert own attributes"
  ON public.contributor_attributes FOR INSERT TO authenticated
  WITH CHECK (contributor_id = auth.uid());
CREATE POLICY "Contributors can update own attributes"
  ON public.contributor_attributes FOR UPDATE TO authenticated
  USING (contributor_id = auth.uid());

-- Bounty invitations RLS
CREATE POLICY "Contributors can view own invitations"
  ON public.bounty_invitations FOR SELECT TO authenticated
  USING (contributor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
CREATE POLICY "Admins can insert invitations"
  ON public.bounty_invitations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
CREATE POLICY "Contributors can update own invitations"
  ON public.bounty_invitations FOR UPDATE TO authenticated
  USING (contributor_id = auth.uid());

-- Bounty reports RLS
CREATE POLICY "Contributors can insert reports"
  ON public.bounty_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Contributors can view own reports"
  ON public.bounty_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
CREATE POLICY "Admins can update reports"
  ON public.bounty_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Performance indexes
CREATE INDEX idx_bounty_requests_status ON public.bounty_requests(status);
CREATE INDEX idx_bounty_requests_published_at ON public.bounty_requests(published_at DESC);
CREATE INDEX idx_bounty_submissions_request_id ON public.bounty_submissions(request_id);
CREATE INDEX idx_bounty_submissions_contributor_id ON public.bounty_submissions(contributor_id);
CREATE INDEX idx_submission_images_submission_id ON public.submission_images(submission_id);
CREATE INDEX idx_bounty_bookmarks_contributor_id ON public.bounty_bookmarks(contributor_id);
CREATE INDEX idx_payout_batches_status ON public.payout_batches(status);
CREATE INDEX idx_earnings_payout_batch_id ON public.earnings(payout_batch_id);

-- =============================================
-- Guided Capture System tables
-- =============================================

-- ALTER contributors for capture system
ALTER TABLE public.contributors
  ADD COLUMN IF NOT EXISTS face_embedding_anchor JSONB,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS capture_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS current_onboarding_step INTEGER DEFAULT 1;

-- Capture sessions (tracks guided capture sessions)
CREATE TABLE public.capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID NOT NULL REFERENCES public.contributors(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'onboarding' CHECK (session_type IN ('onboarding', 'supplemental')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  device_info JSONB,
  images_captured INTEGER DEFAULT 0,
  images_required INTEGER DEFAULT 9,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contributor images (richly-labeled capture photos)
CREATE TABLE public.contributor_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID NOT NULL REFERENCES public.contributors(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  capture_step TEXT NOT NULL CHECK (capture_step IN (
    'face_front', 'face_left', 'face_right', 'face_up', 'face_down',
    'expression_smile', 'expression_neutral', 'expression_serious',
    'upper_body', 'full_body'
  )),
  pose TEXT,
  angle TEXT,
  expression TEXT,
  file_path TEXT NOT NULL,
  bucket TEXT NOT NULL,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  quality_score NUMERIC(4,2),
  sharpness_score NUMERIC(4,2),
  brightness_score NUMERIC(4,2),
  identity_match_score NUMERIC(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contributor consents (immutable granular consent records)
CREATE TABLE public.contributor_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID NOT NULL REFERENCES public.contributors(id) ON DELETE CASCADE,
  consent_version TEXT NOT NULL,
  -- Core consents
  consent_age BOOLEAN NOT NULL,
  consent_ai_training BOOLEAN NOT NULL,
  consent_likeness BOOLEAN NOT NULL,
  consent_revocation BOOLEAN NOT NULL,
  consent_privacy BOOLEAN NOT NULL,
  -- Granular usage categories
  allow_commercial BOOLEAN DEFAULT TRUE,
  allow_editorial BOOLEAN DEFAULT TRUE,
  allow_entertainment BOOLEAN DEFAULT TRUE,
  allow_e_learning BOOLEAN DEFAULT TRUE,
  -- Restrictions
  geo_restrictions TEXT[] DEFAULT ARRAY['global'],
  content_exclusions TEXT[] DEFAULT '{}',
  -- Audit
  consent_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for capture tables
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributor_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributor_consents ENABLE ROW LEVEL SECURITY;

-- Capture sessions RLS
CREATE POLICY "Users can view own sessions"
  ON public.capture_sessions FOR SELECT TO authenticated
  USING (contributor_id = auth.uid());
CREATE POLICY "Users can insert own sessions"
  ON public.capture_sessions FOR INSERT TO authenticated
  WITH CHECK (contributor_id = auth.uid());
CREATE POLICY "Users can update own sessions"
  ON public.capture_sessions FOR UPDATE TO authenticated
  USING (contributor_id = auth.uid());

-- Contributor images RLS
CREATE POLICY "Users can view own images"
  ON public.contributor_images FOR SELECT TO authenticated
  USING (contributor_id = auth.uid());
CREATE POLICY "Users can insert own images"
  ON public.contributor_images FOR INSERT TO authenticated
  WITH CHECK (contributor_id = auth.uid());

-- Contributor consents RLS
CREATE POLICY "Users can view own consents"
  ON public.contributor_consents FOR SELECT TO authenticated
  USING (contributor_id = auth.uid());
CREATE POLICY "Users can insert own consents"
  ON public.contributor_consents FOR INSERT TO authenticated
  WITH CHECK (contributor_id = auth.uid());

-- Performance indexes for capture tables
CREATE INDEX idx_capture_sessions_contributor ON public.capture_sessions(contributor_id);
CREATE INDEX idx_contributor_images_session ON public.contributor_images(session_id);
CREATE INDEX idx_contributor_images_contributor ON public.contributor_images(contributor_id);
CREATE INDEX idx_contributor_consents_contributor ON public.contributor_consents(contributor_id);

-- Storage buckets (create in Supabase dashboard):
-- CREATE BUCKET sfw-uploads (private)
-- CREATE BUCKET bounty-submissions (private)
-- CREATE BUCKET capture-uploads (private) — for guided capture photos
-- NOTE: nsfw-uploads bucket exists as legacy but is no longer used

-- Storage RLS policies (run in Supabase Dashboard SQL Editor)
-- These must be run via the Dashboard because storage.objects is owned by supabase_storage_admin

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder (sfw)"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sfw-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to read their own files
CREATE POLICY "Users can read own files (sfw)"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sfw-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Bounty submissions storage
CREATE POLICY "Users can upload to own bounty folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bounty-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own bounty files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bounty-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Capture uploads storage
CREATE POLICY "Users can upload to own capture folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'capture-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own capture files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'capture-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
