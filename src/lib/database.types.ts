// Supabase'ten üretildi (generate_typescript_types). Şema değişince yeniden üretin.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VehicleKind = "kamyon" | "is_makinesi" | "diger";

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          changed_at: string;
          changed_by: string | null;
          id: number;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string;
          table_name: string;
          tenant_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: Rel[];
      };
      expenses: {
        Row: {
          amount: number;
          category: Database["public"]["Enums"]["expense_category"];
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          expense_date: string;
          id: string;
          site_id: string;
          supplier: string | null;
          tenant_id: string;
          vat_rate: number;
          work_item_id: string | null;
        };
        Insert: {
          amount: number;
          category: Database["public"]["Enums"]["expense_category"];
          client_request_id?: string | null;
          description?: string | null;
          expense_date: string;
          id?: string;
          site_id: string;
          supplier?: string | null;
          tenant_id: string;
          vat_rate?: number;
          work_item_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: Rel[];
      };
      machine_logs: {
        Row: {
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          fuel_liters: number | null;
          hours: number | null;
          id: string;
          log_date: string;
          note: string | null;
          operator: string | null;
          site_id: string;
          tenant_id: string;
          vehicle_id: string;
        };
        Insert: {
          client_request_id?: string | null;
          fuel_liters?: number | null;
          hours?: number | null;
          id?: string;
          log_date: string;
          note?: string | null;
          operator?: string | null;
          site_id: string;
          tenant_id: string;
          vehicle_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["machine_logs"]["Insert"]>;
        Relationships: Rel[];
      };
      memberships: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["member_role"];
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          role?: Database["public"]["Enums"]["member_role"];
          tenant_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["memberships"]["Insert"]>;
        Relationships: Rel[];
      };
      photos: {
        Row: {
          caption: string | null;
          created_at: string;
          created_by: string;
          id: string;
          kind: string;
          site_id: string;
          storage_path: string;
          taken_on: string;
          tenant_id: string;
        };
        Insert: {
          caption?: string | null;
          id?: string;
          kind: string;
          site_id: string;
          storage_path: string;
          taken_on: string;
          tenant_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
        Relationships: Rel[];
      };
      production_entries: {
        Row: {
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          entry_date: string;
          id: string;
          note: string | null;
          quantity: number;
          site_id: string;
          tenant_id: string;
          work_item_id: string;
        };
        Insert: {
          client_request_id?: string | null;
          entry_date: string;
          id?: string;
          note?: string | null;
          quantity: number;
          site_id: string;
          tenant_id: string;
          work_item_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["production_entries"]["Insert"]
        >;
        Relationships: Rel[];
      };
      routes: {
        Row: {
          created_at: string;
          cycle_minutes: number | null;
          destination: string | null;
          distance_km: number | null;
          id: string;
          name: string;
          origin: string | null;
          site_id: string;
          tenant_id: string;
          trip_price: number | null;
          work_item_id: string | null;
        };
        Insert: {
          cycle_minutes?: number | null;
          trip_price?: number | null;
          work_item_id?: string | null;
          destination?: string | null;
          distance_km?: number | null;
          id?: string;
          name: string;
          origin?: string | null;
          site_id: string;
          tenant_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["routes"]["Insert"]>;
        Relationships: Rel[];
      };
      sites: {
        Row: {
          code: string | null;
          created_at: string;
          day_start_hour: number;
          locked_until: string | null;
          employer: string | null;
          end_date: string | null;
          id: string;
          location: string | null;
          name: string;
          start_date: string | null;
          status: string;
          tenant_id: string;
        };
        Insert: {
          code?: string | null;
          day_start_hour?: number;
          locked_until?: string | null;
          employer?: string | null;
          end_date?: string | null;
          id?: string;
          location?: string | null;
          name: string;
          start_date?: string | null;
          status?: string;
          tenant_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["sites"]["Insert"]>;
        Relationships: Rel[];
      };
      tenants: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          tax_number: string | null;
          plan_status: "pending" | "active" | "suspended";
          paid_until: string | null;
          payment_note: string | null;
          payment_notified_at: string | null;
          activated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          tax_number?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: Rel[];
      };
      trip_entries: {
        Row: {
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          entry_date: string;
          id: string;
          note: string | null;
          route_id: string | null;
          site_id: string;
          tenant_id: string;
          tonnage: number | null;
          trip_count: number;
          vehicle_id: string;
        };
        Insert: {
          client_request_id?: string | null;
          entry_date: string;
          id?: string;
          note?: string | null;
          route_id?: string | null;
          site_id: string;
          tenant_id: string;
          tonnage?: number | null;
          trip_count: number;
          vehicle_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip_entries"]["Insert"]>;
        Relationships: Rel[];
      };
      vehicles: {
        Row: {
          active: boolean;
          capacity_ton: number | null;
          contractor_name: string | null;
          created_at: string;
          daily_rate: number | null;
          fuel_norm_lph: number | null;
          hourly_rate: number | null;
          id: string;
          kind: VehicleKind;
          ownership: string;
          plate: string;
          tenant_id: string;
          vehicle_type: string;
        };
        Insert: {
          active?: boolean;
          capacity_ton?: number | null;
          contractor_name?: string | null;
          daily_rate?: number | null;
          fuel_norm_lph?: number | null;
          hourly_rate?: number | null;
          id?: string;
          kind?: VehicleKind;
          ownership?: string;
          plate: string;
          tenant_id: string;
          vehicle_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: Rel[];
      };
      work_item_price_history: {
        Row: {
          work_item_id: string;
          tenant_id: string;
          site_id: string;
          valid_from: string;
          unit_price: number | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          work_item_id: string;
          tenant_id: string;
          site_id: string;
          valid_from: string;
          unit_price: number | null;
        };
        Update: { unit_price?: number | null };
        Relationships: Rel[];
      };
      route_price_history: {
        Row: {
          route_id: string;
          tenant_id: string;
          site_id: string;
          valid_from: string;
          trip_price: number | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          route_id: string;
          tenant_id: string;
          site_id: string;
          valid_from: string;
          trip_price: number | null;
        };
        Update: { trip_price?: number | null };
        Relationships: Rel[];
      };
      vehicle_rate_history: {
        Row: {
          vehicle_id: string;
          tenant_id: string;
          valid_from: string;
          hourly_rate: number | null;
          daily_rate: number | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          vehicle_id: string;
          tenant_id: string;
          valid_from: string;
          hourly_rate: number | null;
          daily_rate: number | null;
        };
        Update: { hourly_rate?: number | null; daily_rate?: number | null };
        Relationships: Rel[];
      };
      site_vehicles: {
        Row: {
          tenant_id: string;
          site_id: string;
          vehicle_id: string;
          created_at: string;
        };
        Insert: {
          tenant_id: string;
          site_id: string;
          vehicle_id: string;
        };
        Update: never;
        Relationships: Rel[];
      };
      invite_codes: {
        Row: {
          code: string;
          tenant_id: string;
          role: Database["public"]["Enums"]["member_role"];
          label: string | null;
          created_by: string;
          created_at: string;
          expires_at: string | null;
          max_uses: number | null;
          uses: number;
          revoked: boolean;
        };
        Insert: never;
        Update: { revoked?: boolean };
        Relationships: Rel[];
      };
      invite_uses: {
        Row: {
          code: string;
          tenant_id: string;
          user_id: string;
          used_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: Rel[];
      };
      work_item_prices: {
        Row: {
          work_item_id: string;
          tenant_id: string;
          site_id: string;
          unit_price: number | null;
          updated_at: string;
        };
        Insert: {
          work_item_id: string;
          tenant_id: string;
          site_id: string;
          unit_price?: number | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["work_item_prices"]["Insert"]
        >;
        Relationships: Rel[];
      };
      route_prices: {
        Row: {
          route_id: string;
          tenant_id: string;
          site_id: string;
          trip_price: number | null;
          updated_at: string;
        };
        Insert: {
          route_id: string;
          tenant_id: string;
          site_id: string;
          trip_price?: number | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["route_prices"]["Insert"]>;
        Relationships: Rel[];
      };
      vehicle_rates: {
        Row: {
          vehicle_id: string;
          tenant_id: string;
          hourly_rate: number | null;
          daily_rate: number | null;
          updated_at: string;
        };
        Insert: {
          vehicle_id: string;
          tenant_id: string;
          hourly_rate?: number | null;
          daily_rate?: number | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["vehicle_rates"]["Insert"]
        >;
        Relationships: Rel[];
      };
      work_items: {
        Row: {
          code: string | null;
          created_at: string;
          id: string;
          name: string;
          planned_quantity: number | null;
          site_id: string;
          tenant_id: string;
          unit: string;
          unit_price: number | null;
        };
        Insert: {
          code?: string | null;
          id?: string;
          name: string;
          planned_quantity?: number | null;
          site_id: string;
          tenant_id: string;
          unit: string;
          unit_price?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["work_items"]["Insert"]>;
        Relationships: Rel[];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_tenant: { Args: { p_name: string }; Returns: string };
      add_member: {
        Args: {
          p_tenant: string;
          p_email: string;
          p_role: Database["public"]["Enums"]["member_role"];
        };
        Returns: undefined;
      };
      am_platform_admin: { Args: Record<string, never>; Returns: boolean };
      notify_payment: {
        Args: { p_tenant: string; p_note: string };
        Returns: undefined;
      };
      admin_tenants: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          plan_status: string;
          paid_until: string | null;
          payment_note: string | null;
          payment_notified_at: string | null;
          created_at: string;
          owner_emails: string | null;
          member_count: number;
        }[];
      };
      audit_feed: {
        Args: {
          p_tenant: string;
          p_tables?: string[] | null;
          p_before?: number | null;
          p_limit?: number;
        };
        Returns: {
          id: number;
          table_name: string;
          record_id: string;
          action: string;
          old_data: Json | null;
          new_data: Json | null;
          changed_at: string;
          changed_by_email: string | null;
        }[];
      };
      admin_overview: {
        Args: Record<string, never>;
        Returns: {
          tenants_total: number;
          tenants_active: number;
          tenants_pending: number;
          tenants_suspended: number;
          payment_notices: number;
          users_total: number;
          users_unconfirmed: number;
          trips_30d: number;
          active_tenants_7d: number;
        }[];
      };
      admin_tenant_list: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          plan_status: string;
          paid_until: string | null;
          payment_note: string | null;
          payment_notified_at: string | null;
          created_at: string;
          activated_at: string | null;
          owner_emails: string | null;
          member_count: number;
          site_count: number;
          vehicle_count: number;
          trips_30d: number;
          last_activity: string | null;
        }[];
      };
      admin_tenant_members: {
        Args: { p_tenant: string };
        Returns: {
          user_id: string;
          email: string;
          role: Database["public"]["Enums"]["member_role"];
          joined_at: string;
          last_sign_in_at: string | null;
          confirmed: boolean;
        }[];
      };
      admin_tenant_sites: {
        Args: { p_tenant: string };
        Returns: {
          id: string;
          name: string;
          status: string;
          locked_until: string | null;
          trips_30d: number;
          last_trip_at: string | null;
        }[];
      };
      admin_users: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          created_at: string;
          last_sign_in_at: string | null;
          confirmed: boolean;
          platform_admin: boolean;
          memberships: string | null;
        }[];
      };
      admin_set_plan: {
        Args: {
          p_tenant: string;
          p_status: string;
          p_paid_until: string | null;
        };
        Returns: undefined;
      };
      create_invite: {
        Args: {
          p_tenant: string;
          p_role: Database["public"]["Enums"]["member_role"];
          p_label: string;
          p_days: number | null;
          p_max_uses: number | null;
        };
        Returns: string;
      };
      join_with_code: { Args: { p_code: string }; Returns: string };
      tenant_members: {
        Args: { p_tenant: string };
        Returns: {
          user_id: string;
          email: string;
          role: Database["public"]["Enums"]["member_role"];
          created_at: string;
        }[];
      };
      trip_day_summary: {
        Args: {
          p_tenant: string;
          p_site: string | null;
          p_from: string;
          p_to: string;
        };
        Returns: {
          site_id: string;
          vehicle_id: string;
          route_id: string | null;
          entry_date: string;
          trips: number;
          tonnage: number;
          untonned_trips: number;
          last_at: string;
          last_id: string;
          last_count: number;
          my_last_id: string | null;
          my_last_count: number | null;
          notes: string[];
        }[];
      };
      machine_day_summary: {
        Args: {
          p_tenant: string;
          p_site: string | null;
          p_from: string;
          p_to: string;
        };
        Returns: {
          site_id: string;
          vehicle_id: string;
          log_date: string;
          hours: number;
          fuel_liters: number;
          paired_hours: number;
          paired_fuel: number;
        }[];
      };
      expense_summary: {
        Args: { p_from: string; p_site: string; p_to: string };
        Returns: {
          amount: number;
          category: string;
          entry_count: number;
          total: number;
          vat_amount: number;
        }[];
      };
      production_summary: {
        Args: { p_from: string; p_site: string; p_to: string };
        Returns: {
          amount: number;
          code: string;
          direct_cost: number;
          name: string;
          planned_quantity: number;
          progress_percent: number;
          quantity: number;
          unit: string;
          unit_cost: number;
          unit_price: number;
          work_item_id: string;
        }[];
      };
    };
    Enums: {
      expense_category:
        | "fuel"
        | "labor"
        | "material"
        | "subcontractor"
        | "equipment_rent"
        | "maintenance"
        | "other";
      member_role: "owner" | "manager" | "field";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];
