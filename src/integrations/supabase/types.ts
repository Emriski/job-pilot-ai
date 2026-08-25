export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          application_url: string | null
          applied_at: string | null
          company_name: string
          created_at: string
          follow_up_date: string | null
          id: string
          job_id: string | null
          job_title: string
          next_action: string | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_url?: string | null
          applied_at?: string | null
          company_name: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          job_id?: string | null
          job_title: string
          next_action?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_url?: string | null
          applied_at?: string | null
          company_name?: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          job_id?: string | null
          job_title?: string
          next_action?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          application_id: string | null
          changes: Json
          content: string
          created_at: string
          doc_type: string
          id: string
          job_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          changes?: Json
          content: string
          created_at?: string
          doc_type: string
          id?: string
          job_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          changes?: Json
          content?: string
          created_at?: string
          doc_type?: string
          id?: string
          job_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_alerts: {
        Row: {
          active: boolean
          countries: string[]
          created_at: string
          employment_types: string[]
          id: string
          label: string
          last_run_at: string | null
          min_salary: number | null
          query: string | null
          remote_only: boolean
          salary_period: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          countries?: string[]
          created_at?: string
          employment_types?: string[]
          id?: string
          label: string
          last_run_at?: string | null
          min_salary?: number | null
          query?: string | null
          remote_only?: boolean
          salary_period?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          countries?: string[]
          created_at?: string
          employment_types?: string[]
          id?: string
          label?: string
          last_run_at?: string | null
          min_salary?: number | null
          query?: string | null
          remote_only?: boolean
          salary_period?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_matches: {
        Row: {
          breakdown: Json
          created_at: string
          gaps: Json
          id: string
          job_id: string
          reasons: Json
          score: number
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          gaps?: Json
          id?: string
          job_id: string
          reasons?: Json
          score: number
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          gaps?: Json
          id?: string
          job_id?: string
          reasons?: Json
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_source_runs: {
        Row: {
          error: string | null
          fetched: number
          finished_at: string | null
          id: string
          source_slug: string
          started_at: string
          upserted: number
        }
        Insert: {
          error?: string | null
          fetched?: number
          finished_at?: string | null
          id?: string
          source_slug: string
          started_at?: string
          upserted?: number
        }
        Update: {
          error?: string | null
          fetched?: number
          finished_at?: string | null
          id?: string
          source_slug?: string
          started_at?: string
          upserted?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_source_runs_source_slug_fkey"
            columns: ["source_slug"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["slug"]
          },
        ]
      }
      job_sources: {
        Row: {
          config: Json
          enabled: boolean
          job_count: number
          last_error: string | null
          last_sync_at: string | null
          name: string
          notes: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          job_count?: number
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          notes?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          job_count?: number
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          notes?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          application_url: string
          company_logo: string | null
          company_name: string
          company_url: string | null
          country: string | null
          created_at: string
          dedupe_key: string
          description: string | null
          employment_type: string | null
          experience_level: string | null
          expired: boolean
          id: string
          last_synced_at: string
          location: string | null
          posted_at: string | null
          remote: boolean
          remote_type: string | null
          requirements: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          skills: string[]
          source: string
          source_job_id: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          application_url: string
          company_logo?: string | null
          company_name: string
          company_url?: string | null
          country?: string | null
          created_at?: string
          dedupe_key: string
          description?: string | null
          employment_type?: string | null
          experience_level?: string | null
          expired?: boolean
          id?: string
          last_synced_at?: string
          location?: string | null
          posted_at?: string | null
          remote?: boolean
          remote_type?: string | null
          requirements?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          skills?: string[]
          source: string
          source_job_id: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          application_url?: string
          company_logo?: string | null
          company_name?: string
          company_url?: string | null
          country?: string | null
          created_at?: string
          dedupe_key?: string
          description?: string | null
          employment_type?: string | null
          experience_level?: string | null
          expired?: boolean
          id?: string
          last_synced_at?: string
          location?: string | null
          posted_at?: string | null
          remote?: boolean
          remote_type?: string | null
          requirements?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          skills?: string[]
          source?: string
          source_job_id?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          countries: string[]
          created_at: string
          email: string | null
          employment_types: string[]
          experience_level: string | null
          full_name: string | null
          id: string
          industries: string[]
          min_salary: number | null
          onboarded: boolean
          salary_currency: string
          salary_period: string
          skills: string[]
          target_titles: string[]
          updated_at: string
          work_modes: string[]
        }
        Insert: {
          countries?: string[]
          created_at?: string
          email?: string | null
          employment_types?: string[]
          experience_level?: string | null
          full_name?: string | null
          id: string
          industries?: string[]
          min_salary?: number | null
          onboarded?: boolean
          salary_currency?: string
          salary_period?: string
          skills?: string[]
          target_titles?: string[]
          updated_at?: string
          work_modes?: string[]
        }
        Update: {
          countries?: string[]
          created_at?: string
          email?: string | null
          employment_types?: string[]
          experience_level?: string | null
          full_name?: string | null
          id?: string
          industries?: string[]
          min_salary?: number | null
          onboarded?: boolean
          salary_currency?: string
          salary_period?: string
          skills?: string[]
          target_titles?: string[]
          updated_at?: string
          work_modes?: string[]
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      resume_analyses: {
        Row: {
          ats: Json
          category_scores: Json
          created_at: string
          id: string
          improvements: Json
          overall_score: number
          resume_id: string
          strengths: Json
          summary: string | null
          target_role: string
          user_id: string
          verdict: string | null
          weaknesses: Json
        }
        Insert: {
          ats?: Json
          category_scores?: Json
          created_at?: string
          id?: string
          improvements?: Json
          overall_score: number
          resume_id: string
          strengths?: Json
          summary?: string | null
          target_role: string
          user_id: string
          verdict?: string | null
          weaknesses?: Json
        }
        Update: {
          ats?: Json
          category_scores?: Json
          created_at?: string
          id?: string
          improvements?: Json
          overall_score?: number
          resume_id?: string
          strengths?: Json
          summary?: string | null
          target_role?: string
          user_id?: string
          verdict?: string | null
          weaknesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "resume_analyses_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          created_at: string
          error_message: string | null
          file_path: string
          id: string
          is_active: boolean
          mime_type: string | null
          original_filename: string | null
          parsed: Json | null
          raw_text: string | null
          size_bytes: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_path: string
          id?: string
          is_active?: boolean
          mime_type?: string | null
          original_filename?: string | null
          parsed?: Json | null
          raw_text?: string | null
          size_bytes?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_path?: string
          id?: string
          is_active?: boolean
          mime_type?: string | null
          original_filename?: string | null
          parsed?: Json | null
          raw_text?: string | null
          size_bytes?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
