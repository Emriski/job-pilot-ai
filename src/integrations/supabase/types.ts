export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      applications: {
        Row: {
          application_url: string | null;
          applied_at: string | null;
          company_name: string;
          created_at: string;
          follow_up_date: string | null;
          id: string;
          interview_at: string | null;
          job_id: string | null;
          job_title: string;
          last_followed_up_at: string | null;
          next_action: string | null;
          notes: string | null;
          status: string;
          strength_details: Json;
          strength_score: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_url?: string | null;
          applied_at?: string | null;
          company_name: string;
          created_at?: string;
          follow_up_date?: string | null;
          id?: string;
          interview_at?: string | null;
          job_id?: string | null;
          job_title: string;
          last_followed_up_at?: string | null;
          next_action?: string | null;
          notes?: string | null;
          status?: string;
          strength_details?: Json;
          strength_score?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          application_url?: string | null;
          applied_at?: string | null;
          company_name?: string;
          created_at?: string;
          follow_up_date?: string | null;
          id?: string;
          interview_at?: string | null;
          job_id?: string | null;
          job_title?: string;
          last_followed_up_at?: string | null;
          next_action?: string | null;
          notes?: string | null;
          status?: string;
          strength_details?: Json;
          strength_score?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      career_profiles: {
        Row: {
          countries: string[];
          created_at: string;
          employment_types: string[];
          id: string;
          is_default: boolean;
          min_salary: number | null;
          name: string;
          resume_id: string | null;
          salary_period: string;
          skills: string[];
          target_titles: string[];
          updated_at: string;
          user_id: string;
          work_modes: string[];
        };
        Insert: {
          countries?: string[];
          created_at?: string;
          employment_types?: string[];
          id?: string;
          is_default?: boolean;
          min_salary?: number | null;
          name: string;
          resume_id?: string | null;
          salary_period?: string;
          skills?: string[];
          target_titles?: string[];
          updated_at?: string;
          user_id: string;
          work_modes?: string[];
        };
        Update: {
          countries?: string[];
          created_at?: string;
          employment_types?: string[];
          id?: string;
          is_default?: boolean;
          min_salary?: number | null;
          name?: string;
          resume_id?: string | null;
          salary_period?: string;
          skills?: string[];
          target_titles?: string[];
          updated_at?: string;
          user_id?: string;
          work_modes?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "career_profiles_resume_id_fkey";
            columns: ["resume_id"];
            isOneToOne: false;
            referencedRelation: "resumes";
            referencedColumns: ["id"];
          },
        ];
      };
      community_comments: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          parent_id: string | null;
          post_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          parent_id?: string | null;
          post_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          parent_id?: string | null;
          post_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "community_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      community_posts: {
        Row: {
          body: string;
          category: string;
          comment_count: number;
          created_at: string;
          id: string;
          link_url: string | null;
          reaction_count: number;
          shared_job: Json | null;
          shared_job_id: string | null;
          status: string;
          title: string;
          unverified_opportunity: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          category: string;
          comment_count?: number;
          created_at?: string;
          id?: string;
          link_url?: string | null;
          reaction_count?: number;
          shared_job?: Json | null;
          shared_job_id?: string | null;
          status?: string;
          title: string;
          unverified_opportunity?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          category?: string;
          comment_count?: number;
          created_at?: string;
          id?: string;
          link_url?: string | null;
          reaction_count?: number;
          shared_job?: Json | null;
          shared_job_id?: string | null;
          status?: string;
          title?: string;
          unverified_opportunity?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_posts_shared_job_id_fkey";
            columns: ["shared_job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      community_reactions: {
        Row: {
          comment_id: string | null;
          created_at: string;
          id: string;
          kind: string;
          post_id: string | null;
          user_id: string;
        };
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          post_id?: string | null;
          user_id: string;
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          post_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_reactions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "community_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      community_reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: string;
          reporter_id: string;
          resolution: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          target_id: string;
          target_type: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: string;
          reporter_id: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          target_id: string;
          target_type: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: string;
          reporter_id?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string;
          user_a: string;
          user_b: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          application_id: string | null;
          changes: Json;
          content: string;
          created_at: string;
          doc_type: string;
          id: string;
          job_id: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          changes?: Json;
          content: string;
          created_at?: string;
          doc_type: string;
          id?: string;
          job_id?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          application_id?: string | null;
          changes?: Json;
          content?: string;
          created_at?: string;
          doc_type?: string;
          id?: string;
          job_id?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_alerts: {
        Row: {
          active: boolean;
          countries: string[];
          created_at: string;
          employment_types: string[];
          id: string;
          label: string;
          last_run_at: string | null;
          min_salary: number | null;
          query: string | null;
          remote_only: boolean;
          salary_period: string | null;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          countries?: string[];
          created_at?: string;
          employment_types?: string[];
          id?: string;
          label: string;
          last_run_at?: string | null;
          min_salary?: number | null;
          query?: string | null;
          remote_only?: boolean;
          salary_period?: string | null;
          user_id: string;
        };
        Update: {
          active?: boolean;
          countries?: string[];
          created_at?: string;
          employment_types?: string[];
          id?: string;
          label?: string;
          last_run_at?: string | null;
          min_salary?: number | null;
          query?: string | null;
          remote_only?: boolean;
          salary_period?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      job_matches: {
        Row: {
          breakdown: Json;
          created_at: string;
          gaps: Json;
          id: string;
          job_id: string;
          reasons: Json;
          score: number;
          user_id: string;
        };
        Insert: {
          breakdown?: Json;
          created_at?: string;
          gaps?: Json;
          id?: string;
          job_id: string;
          reasons?: Json;
          score: number;
          user_id: string;
        };
        Update: {
          breakdown?: Json;
          created_at?: string;
          gaps?: Json;
          id?: string;
          job_id?: string;
          reasons?: Json;
          score?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_source_runs: {
        Row: {
          error: string | null;
          fetched: number;
          finished_at: string | null;
          id: string;
          source_slug: string;
          started_at: string;
          upserted: number;
        };
        Insert: {
          error?: string | null;
          fetched?: number;
          finished_at?: string | null;
          id?: string;
          source_slug: string;
          started_at?: string;
          upserted?: number;
        };
        Update: {
          error?: string | null;
          fetched?: number;
          finished_at?: string | null;
          id?: string;
          source_slug?: string;
          started_at?: string;
          upserted?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_source_runs_source_slug_fkey";
            columns: ["source_slug"];
            isOneToOne: false;
            referencedRelation: "job_sources";
            referencedColumns: ["slug"];
          },
        ];
      };
      job_sources: {
        Row: {
          config: Json;
          enabled: boolean;
          job_count: number;
          last_error: string | null;
          last_sync_at: string | null;
          name: string;
          notes: string | null;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          enabled?: boolean;
          job_count?: number;
          last_error?: string | null;
          last_sync_at?: string | null;
          name: string;
          notes?: string | null;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          enabled?: boolean;
          job_count?: number;
          last_error?: string | null;
          last_sync_at?: string | null;
          name?: string;
          notes?: string | null;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          application_url: string;
          company_logo: string | null;
          company_name: string;
          company_url: string | null;
          country: string | null;
          created_at: string;
          dedupe_key: string;
          description: string | null;
          employment_type: string | null;
          experience_level: string | null;
          expired: boolean;
          id: string;
          last_synced_at: string;
          location: string | null;
          posted_at: string | null;
          remote: boolean;
          remote_type: string | null;
          requirements: string | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          salary_period: string | null;
          skills: string[];
          source: string;
          source_job_id: string;
          source_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          application_url: string;
          company_logo?: string | null;
          company_name: string;
          company_url?: string | null;
          country?: string | null;
          created_at?: string;
          dedupe_key: string;
          description?: string | null;
          employment_type?: string | null;
          experience_level?: string | null;
          expired?: boolean;
          id?: string;
          last_synced_at?: string;
          location?: string | null;
          posted_at?: string | null;
          remote?: boolean;
          remote_type?: string | null;
          requirements?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          salary_period?: string | null;
          skills?: string[];
          source: string;
          source_job_id: string;
          source_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          application_url?: string;
          company_logo?: string | null;
          company_name?: string;
          company_url?: string | null;
          country?: string | null;
          created_at?: string;
          dedupe_key?: string;
          description?: string | null;
          employment_type?: string | null;
          experience_level?: string | null;
          expired?: boolean;
          id?: string;
          last_synced_at?: string;
          location?: string | null;
          posted_at?: string | null;
          remote?: boolean;
          remote_type?: string | null;
          requirements?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          salary_period?: string | null;
          skills?: string[];
          source?: string;
          source_job_id?: string;
          source_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_actions: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          moderator_id: string;
          notes: string | null;
          target_id: string;
          target_type: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          moderator_id: string;
          notes?: string | null;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          moderator_id?: string;
          notes?: string | null;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      notification_settings: {
        Row: {
          comments: boolean;
          follows: boolean;
          job_alerts: boolean;
          mentions: boolean;
          moderation: boolean;
          reactions: boolean;
          replies: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          comments?: boolean;
          follows?: boolean;
          job_alerts?: boolean;
          mentions?: boolean;
          moderation?: boolean;
          reactions?: boolean;
          replies?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          comments?: boolean;
          follows?: boolean;
          job_alerts?: boolean;
          mentions?: boolean;
          moderation?: boolean;
          reactions?: boolean;
          replies?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          actor_id?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          actor_id?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          career_interests: string[];
          countries: string[];
          created_at: string;
          email: string | null;
          employment_types: string[];
          experience_level: string | null;
          full_name: string | null;
          headline: string | null;
          id: string;
          industries: string[];
          last_visit_at: string | null;
          location: string | null;
          min_salary: number | null;
          nickname: string | null;
          normalized_nickname: string | null;
          onboarded: boolean;
          previous_visit_at: string | null;
          public_profile: boolean;
          salary_currency: string;
          salary_period: string;
          show_location: boolean;
          skills: string[];
          target_titles: string[];
          updated_at: string;
          work_modes: string[];
        };
        Insert: {
          avatar_path?: string | null;
          career_interests?: string[];
          countries?: string[];
          created_at?: string;
          email?: string | null;
          employment_types?: string[];
          experience_level?: string | null;
          full_name?: string | null;
          headline?: string | null;
          id: string;
          industries?: string[];
          last_visit_at?: string | null;
          location?: string | null;
          min_salary?: number | null;
          nickname?: string | null;
          normalized_nickname?: string | null;
          onboarded?: boolean;
          previous_visit_at?: string | null;
          public_profile?: boolean;
          salary_currency?: string;
          salary_period?: string;
          show_location?: boolean;
          skills?: string[];
          target_titles?: string[];
          updated_at?: string;
          work_modes?: string[];
        };
        Update: {
          avatar_path?: string | null;
          career_interests?: string[];
          countries?: string[];
          created_at?: string;
          email?: string | null;
          employment_types?: string[];
          experience_level?: string | null;
          full_name?: string | null;
          headline?: string | null;
          id?: string;
          industries?: string[];
          last_visit_at?: string | null;
          location?: string | null;
          min_salary?: number | null;
          nickname?: string | null;
          normalized_nickname?: string | null;
          onboarded?: boolean;
          previous_visit_at?: string | null;
          public_profile?: boolean;
          salary_currency?: string;
          salary_period?: string;
          show_location?: boolean;
          skills?: string[];
          target_titles?: string[];
          updated_at?: string;
          work_modes?: string[];
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      resume_analyses: {
        Row: {
          ats: Json;
          category_scores: Json;
          created_at: string;
          id: string;
          improvements: Json;
          overall_score: number;
          resume_id: string;
          strengths: Json;
          summary: string | null;
          target_role: string;
          user_id: string;
          verdict: string | null;
          weaknesses: Json;
        };
        Insert: {
          ats?: Json;
          category_scores?: Json;
          created_at?: string;
          id?: string;
          improvements?: Json;
          overall_score: number;
          resume_id: string;
          strengths?: Json;
          summary?: string | null;
          target_role: string;
          user_id: string;
          verdict?: string | null;
          weaknesses?: Json;
        };
        Update: {
          ats?: Json;
          category_scores?: Json;
          created_at?: string;
          id?: string;
          improvements?: Json;
          overall_score?: number;
          resume_id?: string;
          strengths?: Json;
          summary?: string | null;
          target_role?: string;
          user_id?: string;
          verdict?: string | null;
          weaknesses?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "resume_analyses_resume_id_fkey";
            columns: ["resume_id"];
            isOneToOne: false;
            referencedRelation: "resumes";
            referencedColumns: ["id"];
          },
        ];
      };
      resumes: {
        Row: {
          created_at: string;
          error_message: string | null;
          file_path: string;
          id: string;
          is_active: boolean;
          is_master: boolean;
          label: string | null;
          mime_type: string | null;
          original_filename: string | null;
          parsed: Json | null;
          raw_text: string | null;
          size_bytes: number | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          file_path: string;
          id?: string;
          is_active?: boolean;
          is_master?: boolean;
          label?: string | null;
          mime_type?: string | null;
          original_filename?: string | null;
          parsed?: Json | null;
          raw_text?: string | null;
          size_bytes?: number | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          file_path?: string;
          id?: string;
          is_active?: boolean;
          is_master?: boolean;
          label?: string | null;
          mime_type?: string | null;
          original_filename?: string | null;
          parsed?: Json | null;
          raw_text?: string | null;
          size_bytes?: number | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      saved_jobs: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          notes: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          notes?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          notes?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocked_user_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          blocked_user_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          blocked_user_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_follows: {
        Row: {
          created_at: string;
          follower_id: string;
          following_id: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          follower_id: string;
          following_id: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          follower_id?: string;
          following_id?: string;
          id?: string;
        };
        Relationships: [];
      };
      user_mutes: {
        Row: {
          created_at: string;
          id: string;
          muted_user_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          muted_user_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          muted_user_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_restrictions: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          kind: string;
          reason: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          kind: string;
          reason?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          kind?: string;
          reason?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_nickname: { Args: { _nickname: string }; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean };
      normalize_nickname: { Args: { _input: string }; Returns: string };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
