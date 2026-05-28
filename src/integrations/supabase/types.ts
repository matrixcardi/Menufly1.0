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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addon_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_select: number | null
          min_select: number | null
          name: string
          required: boolean
          restaurant_id: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_select?: number | null
          min_select?: number | null
          name: string
          required?: boolean
          restaurant_id: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_select?: number | null
          min_select?: number | null
          name?: string
          required?: boolean
          restaurant_id?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_items: {
        Row: {
          addon_group_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          addon_group_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          addon_group_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_items_addon_group_id_fkey"
            columns: ["addon_group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          generation_type: string | null
          id: string
          restaurant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          generation_type?: string | null
          id?: string
          restaurant_id: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          generation_type?: string | null
          id?: string
          restaurant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          restaurant_id: string
          total_purchased: number
          total_used: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          restaurant_id: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          restaurant_id?: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          created_at: string
          credits_used: number
          generation_type: string
          id: string
          product_id: string | null
          prompt: string | null
          restaurant_id: string
          result_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          generation_type: string
          id?: string
          product_id?: string | null
          prompt?: string | null
          restaurant_id: string
          result_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          generation_type?: string
          id?: string
          product_id?: string | null
          prompt?: string | null
          restaurant_id?: string
          result_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_promos: {
        Row: {
          benefit_product_id: string | null
          benefit_type: string
          benefit_value: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          schedule_days: number[] | null
          schedule_end_date: string | null
          schedule_end_time: string | null
          schedule_start_date: string | null
          schedule_start_time: string | null
          schedule_type: string
          show_in_menu: boolean
          sort_order: number
          trigger_category_id: string | null
          trigger_product_id: string | null
          trigger_type: string
          trigger_value: number
          updated_at: string
        }
        Insert: {
          benefit_product_id?: string | null
          benefit_type?: string
          benefit_value?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          schedule_days?: number[] | null
          schedule_end_date?: string | null
          schedule_end_time?: string | null
          schedule_start_date?: string | null
          schedule_start_time?: string | null
          schedule_type?: string
          show_in_menu?: boolean
          sort_order?: number
          trigger_category_id?: string | null
          trigger_product_id?: string | null
          trigger_type?: string
          trigger_value?: number
          updated_at?: string
        }
        Update: {
          benefit_product_id?: string | null
          benefit_type?: string
          benefit_value?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          schedule_days?: number[] | null
          schedule_end_date?: string | null
          schedule_end_time?: string | null
          schedule_start_date?: string | null
          schedule_start_time?: string | null
          schedule_type?: string
          show_in_menu?: boolean
          sort_order?: number
          trigger_category_id?: string | null
          trigger_product_id?: string | null
          trigger_type?: string
          trigger_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_promos_benefit_product_id_fkey"
            columns: ["benefit_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_promos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_promos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_promos_trigger_category_id_fkey"
            columns: ["trigger_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_promos_trigger_product_id_fkey"
            columns: ["trigger_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          closing_time: string
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          opening_time: string
          period_order: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          closing_time?: string
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          opening_time?: string
          period_order?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          closing_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          opening_time?: string
          period_order?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          customer_name: string
          customer_phone: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_name: string
          customer_phone: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          dispatch_days: number[]
          failed_count: number
          filter_type: string
          id: string
          image_url: string | null
          message_template: string
          name: string
          restaurant_id: string
          scheduled_at: string
          sent_count: number
          started_at: string | null
          status: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dispatch_days?: number[]
          failed_count?: number
          filter_type: string
          id?: string
          image_url?: string | null
          message_template: string
          name: string
          restaurant_id: string
          scheduled_at: string
          sent_count?: number
          started_at?: string | null
          status?: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dispatch_days?: number[]
          failed_count?: number
          filter_type?: string
          id?: string
          image_url?: string | null
          message_template?: string
          name?: string
          restaurant_id?: string
          scheduled_at?: string
          sent_count?: number
          started_at?: string | null
          status?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closing_amount: number | null
          created_at: string
          id: string
          opened_at: string
          opened_by: string
          opening_amount: number
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by: string
          opening_amount?: number
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number | null
          start_collapsed: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number | null
          start_collapsed?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number | null
          start_collapsed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_settings: {
        Row: {
          created_at: string
          fixed_costs_monthly: number
          id: string
          optimal_max: number
          packaging_cost_default: number
          restaurant_id: string
          target_cmv_percent: number
          updated_at: string
          warning_max: number
        }
        Insert: {
          created_at?: string
          fixed_costs_monthly?: number
          id?: string
          optimal_max?: number
          packaging_cost_default?: number
          restaurant_id: string
          target_cmv_percent?: number
          updated_at?: string
          warning_max?: number
        }
        Update: {
          created_at?: string
          fixed_costs_monthly?: number
          id?: string
          optimal_max?: number
          packaging_cost_default?: number
          restaurant_id?: string
          target_cmv_percent?: number
          updated_at?: string
          warning_max?: number
        }
        Relationships: [
          {
            foreignKeyName: "cmv_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applies_to: string
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          max_uses_per_user: number | null
          min_order: number | null
          restaurant_id: string
          show_in_menu: boolean
          used_count: number | null
        }
        Insert: {
          applies_to?: string
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order?: number | null
          restaurant_id: string
          show_in_menu?: boolean
          used_count?: number | null
        }
        Update: {
          applies_to?: string
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order?: number | null
          restaurant_id?: string
          show_in_menu?: boolean
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          favorite_product: string | null
          id: string
          last_order_at: string | null
          name: string
          phone: string
          restaurant_id: string
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          favorite_product?: string | null
          id?: string
          last_order_at?: string | null
          name: string
          phone: string
          restaurant_id: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          favorite_product?: string | null
          id?: string
          last_order_at?: string | null
          name?: string
          phone?: string
          restaurant_id?: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          city: string | null
          created_at: string
          estimated_time_min: number | null
          fee: number
          id: string
          is_active: boolean | null
          max_radius_km: number | null
          min_radius_km: number | null
          name: string
          restaurant_id: string
          updated_at: string
          zone_type: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          estimated_time_min?: number | null
          fee?: number
          id?: string
          is_active?: boolean | null
          max_radius_km?: number | null
          min_radius_km?: number | null
          name: string
          restaurant_id: string
          updated_at?: string
          zone_type: string
        }
        Update: {
          city?: string | null
          created_at?: string
          estimated_time_min?: number | null
          fee?: number
          id?: string
          is_active?: boolean | null
          max_radius_km?: number | null
          min_radius_km?: number | null
          name?: string
          restaurant_id?: string
          updated_at?: string
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          fee_mode: string
          fixed_fee: number
          id: string
          is_active: boolean
          name: string
          per_ride_fee: number
          phone: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_mode?: string
          fixed_fee?: number
          id?: string
          is_active?: boolean
          name: string
          per_ride_fee?: number
          phone: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_mode?: string
          fixed_fee?: number
          id?: string
          is_active?: boolean
          name?: string
          per_ride_fee?: number
          phone?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          name: string
          restaurant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      lavem_integrations: {
        Row: {
          account_email: string | null
          account_password: string | null
          created_at: string
          dispatch_mode: string
          id: string
          is_active: boolean
          restaurant_id: string
          store_id: string | null
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          account_email?: string | null
          account_password?: string | null
          created_at?: string
          dispatch_mode?: string
          id?: string
          is_active?: boolean
          restaurant_id: string
          store_id?: string | null
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          account_email?: string | null
          account_password?: string | null
          created_at?: string
          dispatch_mode?: string
          id?: string
          is_active?: boolean
          restaurant_id?: string
          store_id?: string | null
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      menu_highlights: {
        Row: {
          coupon_id: string | null
          created_at: string
          custom_description: string | null
          custom_title: string | null
          highlight_type: string
          id: string
          is_active: boolean
          product_id: string | null
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          custom_description?: string | null
          custom_title?: string | null
          highlight_type: string
          id?: string
          is_active?: boolean
          product_id?: string | null
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          custom_description?: string | null
          custom_title?: string | null
          highlight_type?: string
          id?: string
          is_active?: boolean
          product_id?: string | null
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_highlights_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_highlights_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_highlights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_highlights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancellation_reason: string | null
          coupon_code: string | null
          created_at: string | null
          customer_address: string | null
          customer_name: string
          customer_phone: string
          daily_number: number | null
          delivery_fee: number | null
          delivery_type: string
          discount: number | null
          driver_id: string | null
          driver_name: string | null
          external_data: Json | null
          external_id: string | null
          id: string
          is_archived: boolean
          items: Json
          lavem_delivery_id: string | null
          lavem_driver_name: string | null
          lavem_driver_phone: string | null
          lavem_fee: number | null
          lavem_status: string | null
          lavem_tracking_url: string | null
          notes: string | null
          order_number: string
          payment_method: string
          payment_status: string
          restaurant_id: string
          source: string
          status: string
          subtotal: number
          total: number
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          coupon_code?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          daily_number?: number | null
          delivery_fee?: number | null
          delivery_type?: string
          discount?: number | null
          driver_id?: string | null
          driver_name?: string | null
          external_data?: Json | null
          external_id?: string | null
          id?: string
          is_archived?: boolean
          items: Json
          lavem_delivery_id?: string | null
          lavem_driver_name?: string | null
          lavem_driver_phone?: string | null
          lavem_fee?: number | null
          lavem_status?: string | null
          lavem_tracking_url?: string | null
          notes?: string | null
          order_number: string
          payment_method?: string
          payment_status?: string
          restaurant_id: string
          source?: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          coupon_code?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          daily_number?: number | null
          delivery_fee?: number | null
          delivery_type?: string
          discount?: number | null
          driver_id?: string | null
          driver_name?: string | null
          external_data?: Json | null
          external_id?: string | null
          id?: string
          is_archived?: boolean
          items?: Json
          lavem_delivery_id?: string | null
          lavem_driver_name?: string | null
          lavem_driver_phone?: string | null
          lavem_fee?: number | null
          lavem_status?: string | null
          lavem_tracking_url?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: string
          payment_status?: string
          restaurant_id?: string
          source?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_integrations: {
        Row: {
          access_token: string | null
          api_token: string | null
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          merchant_id: string | null
          merchant_name: string | null
          metadata: Json | null
          platform: string
          restaurant_id: string
          status: string
          token_expires_at: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          access_token?: string | null
          api_token?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          metadata?: Json | null
          platform: string
          restaurant_id: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          access_token?: string | null
          api_token?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          metadata?: Json | null
          platform?: string
          restaurant_id?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_integrations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_integrations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_addon_groups: {
        Row: {
          addon_group_id: string
          created_at: string
          id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          addon_group_id: string
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          addon_group_id?: string
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_groups_addon_group_id_fkey"
            columns: ["addon_group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          created_at: string
          id: string
          ingredient_name: string
          product_id: string
          quantity: number
          restaurant_id: string
          sort_order: number
          total_cost: number | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_name: string
          product_id: string
          quantity?: number
          restaurant_id: string
          sort_order?: number
          total_cost?: number | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_name?: string
          product_id?: string
          quantity?: number
          restaurant_id?: string
          sort_order?: number
          total_cost?: number | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cashback: number | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cashback?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cashback?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          subscription_plan: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_items: {
        Row: {
          created_at: string
          group_name: string | null
          id: string
          is_required: boolean
          max_choices: number | null
          product_id: string
          promo_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_name?: string | null
          id?: string
          is_required?: boolean
          max_choices?: number | null
          product_id: string
          promo_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_name?: string | null
          id?: string
          is_required?: boolean
          max_choices?: number | null
          product_id?: string
          promo_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_items_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promos"
            referencedColumns: ["id"]
          },
        ]
      }
      promos: {
        Row: {
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number | null
          promo_type: string
          restaurant_id: string
          schedule_days: number[] | null
          schedule_end_date: string | null
          schedule_end_time: string | null
          schedule_start_date: string | null
          schedule_start_time: string | null
          schedule_type: string
          show_in_menu: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number | null
          promo_type?: string
          restaurant_id: string
          schedule_days?: number[] | null
          schedule_end_date?: string | null
          schedule_end_time?: string | null
          schedule_start_date?: string | null
          schedule_start_time?: string | null
          schedule_type?: string
          show_in_menu?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number | null
          promo_type?: string
          restaurant_id?: string
          schedule_days?: number[] | null
          schedule_end_date?: string | null
          schedule_end_time?: string | null
          schedule_start_date?: string | null
          schedule_start_time?: string | null
          schedule_type?: string
          show_in_menu?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          product_id: string
          quantity_used: number
          recipe_unit: string
          waste_factor: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          product_id: string
          quantity_used?: number
          recipe_unit?: string
          waste_factor?: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity_used?: number
          recipe_unit?: string
          waste_factor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_collaborators: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_collaborators_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_collaborators_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          banner_url: string | null
          bot_auto_reply_enabled: boolean
          bot_enabled: boolean
          bot_feedback_enabled: boolean
          bot_greeting_message: string | null
          bot_order_updates: boolean
          card_enabled: boolean
          card_gateway: string | null
          card_gateway_token: string | null
          card_on_delivery_enabled: boolean
          card_online_enabled: boolean
          cash_enabled: boolean
          closing_time: string | null
          created_at: string
          default_delivery_fee: number
          default_delivery_time_min: number | null
          delivery_available: boolean | null
          delivery_method: string | null
          delivery_mode: string
          description: string | null
          ga_measurement_id: string | null
          google_review_link: string | null
          gtm_container_id: string | null
          id: string
          instagram_url: string | null
          is_open: boolean | null
          logo_url: string | null
          manual_override_until: string | null
          menu_theme: string | null
          meta_access_token: string | null
          meta_pixel_id: string | null
          min_order: number | null
          mp_public_key: string | null
          mp_refresh_token: string | null
          name: string
          notification_sound: string
          opening_time: string | null
          operation_mode: string
          pickup_available: boolean | null
          pix_enabled: boolean
          pix_gateway: string | null
          pix_gateway_token: string | null
          pix_key: string | null
          restaurant_lat: number | null
          restaurant_lng: number | null
          slug: string
          stripe_publishable_key: string | null
          subscription_active: boolean
          trial_email_d0_sent: boolean
          trial_email_d1_sent: boolean
          trial_email_d3_sent: boolean
          trial_email_d7_sent: boolean
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          whatsapp_connected: boolean | null
          whatsapp_instance_name: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          banner_url?: string | null
          bot_auto_reply_enabled?: boolean
          bot_enabled?: boolean
          bot_feedback_enabled?: boolean
          bot_greeting_message?: string | null
          bot_order_updates?: boolean
          card_enabled?: boolean
          card_gateway?: string | null
          card_gateway_token?: string | null
          card_on_delivery_enabled?: boolean
          card_online_enabled?: boolean
          cash_enabled?: boolean
          closing_time?: string | null
          created_at?: string
          default_delivery_fee?: number
          default_delivery_time_min?: number | null
          delivery_available?: boolean | null
          delivery_method?: string | null
          delivery_mode?: string
          description?: string | null
          ga_measurement_id?: string | null
          google_review_link?: string | null
          gtm_container_id?: string | null
          id?: string
          instagram_url?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          manual_override_until?: string | null
          menu_theme?: string | null
          meta_access_token?: string | null
          meta_pixel_id?: string | null
          min_order?: number | null
          mp_public_key?: string | null
          mp_refresh_token?: string | null
          name?: string
          notification_sound?: string
          opening_time?: string | null
          operation_mode?: string
          pickup_available?: boolean | null
          pix_enabled?: boolean
          pix_gateway?: string | null
          pix_gateway_token?: string | null
          pix_key?: string | null
          restaurant_lat?: number | null
          restaurant_lng?: number | null
          slug: string
          stripe_publishable_key?: string | null
          subscription_active?: boolean
          trial_email_d0_sent?: boolean
          trial_email_d1_sent?: boolean
          trial_email_d3_sent?: boolean
          trial_email_d7_sent?: boolean
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          whatsapp_connected?: boolean | null
          whatsapp_instance_name?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          banner_url?: string | null
          bot_auto_reply_enabled?: boolean
          bot_enabled?: boolean
          bot_feedback_enabled?: boolean
          bot_greeting_message?: string | null
          bot_order_updates?: boolean
          card_enabled?: boolean
          card_gateway?: string | null
          card_gateway_token?: string | null
          card_on_delivery_enabled?: boolean
          card_online_enabled?: boolean
          cash_enabled?: boolean
          closing_time?: string | null
          created_at?: string
          default_delivery_fee?: number
          default_delivery_time_min?: number | null
          delivery_available?: boolean | null
          delivery_method?: string | null
          delivery_mode?: string
          description?: string | null
          ga_measurement_id?: string | null
          google_review_link?: string | null
          gtm_container_id?: string | null
          id?: string
          instagram_url?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          manual_override_until?: string | null
          menu_theme?: string | null
          meta_access_token?: string | null
          meta_pixel_id?: string | null
          min_order?: number | null
          mp_public_key?: string | null
          mp_refresh_token?: string | null
          name?: string
          notification_sound?: string
          opening_time?: string | null
          operation_mode?: string
          pickup_available?: boolean | null
          pix_enabled?: boolean
          pix_gateway?: string | null
          pix_gateway_token?: string | null
          pix_key?: string | null
          restaurant_lat?: number | null
          restaurant_lng?: number | null
          slug?: string
          stripe_publishable_key?: string | null
          subscription_active?: boolean
          trial_email_d0_sent?: boolean
          trial_email_d1_sent?: boolean
          trial_email_d3_sent?: boolean
          trial_email_d7_sent?: boolean
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_connected?: boolean | null
          whatsapp_instance_name?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      whatsapp_bot_conversations: {
        Row: {
          created_at: string
          id: string
          last_bot_reply_at: string
          phone: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_bot_reply_at?: string
          phone: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_bot_reply_at?: string
          phone?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_conversations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_conversations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          restaurant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          restaurant_id: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          restaurant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credit_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_credit_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_monthly_recharge_at: string | null
          restaurant_id: string
          total_purchased: number
          total_used: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_monthly_recharge_at?: string | null
          restaurant_id: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_monthly_recharge_at?: string | null
          restaurant_id?: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_credits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      all_orders: {
        Row: {
          coupon_code: string | null
          created_at: string | null
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          delivery_type: string | null
          discount: number | null
          id: string | null
          is_archived: boolean | null
          items: Json | null
          notes: string | null
          order_number: string | null
          payment_method: string | null
          payment_status: string | null
          restaurant_id: string | null
          restaurant_name: string | null
          status: string | null
          subtotal: number | null
          total: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "all_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      all_restaurants: {
        Row: {
          created_at: string | null
          id: string | null
          is_open: boolean | null
          logo_url: string | null
          name: string | null
          owner_email: string | null
          owner_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_all_orders_daily: { Args: never; Returns: undefined }
      auto_cancel_stale_orders: { Args: never; Returns: undefined }
      cancel_order_by_customer: { Args: { p_order_id: string }; Returns: Json }
      confirm_pix_payment: { Args: { p_order_id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_restaurant_slug: {
        Args: { restaurant_id: string; restaurant_name: string }
        Returns: string
      }
      get_device_tokens_for_restaurant: {
        Args: { _restaurant_id: string }
        Returns: {
          platform: string
          token: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_restaurant_collaborator: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_restaurant_owner: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      master_update_account: {
        Args: {
          p_plan: string
          p_status: string
          p_subscription_active?: boolean
          p_trial_ends_at?: string
          p_user_id: string
        }
        Returns: undefined
      }
      monthly_credits_for_plan: { Args: { p_plan: string }; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recharge_monthly_whatsapp_credits: { Args: never; Returns: number }
      register_customer: {
        Args: { p_name: string; p_phone: string; p_restaurant_id: string }
        Returns: Json
      }
      submit_order: {
        Args: {
          p_auto_promo_ids?: string[]
          p_coupon_code?: string
          p_customer_address: string
          p_customer_name: string
          p_customer_phone: string
          p_delivery_fee?: number
          p_delivery_type: string
          p_items: Json
          p_notes?: string
          p_payment_method: string
          p_promo_id?: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      validate_coupon: {
        Args: {
          p_coupon_code: string
          p_restaurant_id: string
          p_subtotal: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "master" | "admin" | "user" | "collaborator"
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
      app_role: ["master", "admin", "user", "collaborator"],
    },
  },
} as const
