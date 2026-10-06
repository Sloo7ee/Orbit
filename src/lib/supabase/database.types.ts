
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "assessment_operations": {
                  Row: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_revision": number
                  }
                  Insert: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_revision": number
                  }
                  Update: {
                    "arguments"?: NonNullable<Json>,"owner_id"?: string,"request_id"?: string,"result_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_operations_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"assessments": {
                  Row: {
                    "course_id": string,"created_at": string,"due_date": string | null,"due_time": string | null,"id": string,"name": string,"notes": string,"owner_id": string,"revision": number,"score_earned": number | null,"score_possible": number,"semester_id": string,"updated_at": string,"weight": number
                  }
                  Insert: {
                    "course_id": string,"created_at"?: string,"due_date"?: string | null,"due_time"?: string | null,"id": string,"name": string,"notes"?: string,"owner_id": string,"revision"?: number,"score_earned"?: number | null,"score_possible": number,"semester_id": string,"updated_at"?: string,"weight": number
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"due_date"?: string | null,"due_time"?: string | null,"id"?: string,"name"?: string,"notes"?: string,"owner_id"?: string,"revision"?: number,"score_earned"?: number | null,"score_possible"?: number,"semester_id"?: string,"updated_at"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessments_course_history"
      columns: ["course_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","semester_id","owner_id"]
    },{
      foreignKeyName: "assessments_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_semester_id_owner_id_fkey"
      columns: ["semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"calendar_events": {
                  Row: {
                    "color": string,"course_id": string | null,"ends_at": string,"id": string,"owner_id": string,"revision": number,"semester_id": string,"starts_at": string,"title": string
                  }
                  Insert: {
                    "color": string,"course_id"?: string | null,"ends_at": string,"id": string,"owner_id"?: string,"revision"?: number,"semester_id": string,"starts_at": string,"title": string
                  }
                  Update: {
                    "color"?: string,"course_id"?: string | null,"ends_at"?: string,"id"?: string,"owner_id"?: string,"revision"?: number,"semester_id"?: string,"starts_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_course_id_semester_id_owner_id_fkey"
      columns: ["course_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","semester_id","owner_id"]
    },{
      foreignKeyName: "calendar_events_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_semester_id_owner_id_fkey"
      columns: ["semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"course_schedules": {
                  Row: {
                    "color": string,"course_id": string | null,"created_at": string,"deleted": boolean,"effective_end": string,"effective_start": string,"end_time": string,"id": string,"location": string,"owner_id": string,"revision": number,"semester_id": string,"start_time": string,"timezone": string,"title": string,"weekdays": (number)[]
                  }
                  Insert: {
                    "color": string,"course_id"?: string | null,"created_at"?: string,"deleted"?: boolean,"effective_end": string,"effective_start": string,"end_time": string,"id": string,"location"?: string,"owner_id"?: string,"revision"?: number,"semester_id": string,"start_time": string,"timezone": string,"title": string,"weekdays": (number)[]
                  }
                  Update: {
                    "color"?: string,"course_id"?: string | null,"created_at"?: string,"deleted"?: boolean,"effective_end"?: string,"effective_start"?: string,"end_time"?: string,"id"?: string,"location"?: string,"owner_id"?: string,"revision"?: number,"semester_id"?: string,"start_time"?: string,"timezone"?: string,"title"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_schedules_course_id_semester_id_owner_id_fkey"
      columns: ["course_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","semester_id","owner_id"]
    },{
      foreignKeyName: "course_schedules_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_schedules_semester_id_owner_id_fkey"
      columns: ["semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "code": string,"color": string,"id": string,"instructor": string,"name": string,"owner_id": string,"revision": number,"semester_id": string
                  }
                  Insert: {
                    "code": string,"color": string,"id": string,"instructor"?: string,"name": string,"owner_id"?: string,"revision"?: number,"semester_id": string
                  }
                  Update: {
                    "code"?: string,"color"?: string,"id"?: string,"instructor"?: string,"name"?: string,"owner_id"?: string,"revision"?: number,"semester_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "courses_semester_id_owner_id_fkey"
      columns: ["semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"focus_intervals": {
                  Row: {
                    "ended_at": string,"id": number,"owner_id": string,"semester_id": string,"session_id": string,"started_at": string
                  }
                  Insert: {
                    "ended_at": string,"id"?: never,"owner_id": string,"semester_id": string,"session_id": string,"started_at": string
                  }
                  Update: {
                    "ended_at"?: string,"id"?: never,"owner_id"?: string,"semester_id"?: string,"session_id"?: string,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "focus_intervals_session_id_semester_id_owner_id_fkey"
      columns: ["session_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "focus_sessions"
      referencedColumns: ["id","semester_id","owner_id"]
    }
                  ]
                },"focus_operations": {
                  Row: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_revision": number
                  }
                  Insert: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_revision": number
                  }
                  Update: {
                    "arguments"?: NonNullable<Json>,"owner_id"?: string,"request_id"?: string,"result_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "focus_operations_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"focus_sessions": {
                  Row: {
                    "break_seconds": number,"course_id": string | null,"course_label": string,"created_at": string,"ended_at": string | null,"focus_seconds": number,"focused_ms": number,"id": string,"mode": string,"owner_id": string,"phase": string,"remaining_ms": number | null,"revision": number,"segment_started_at": string | null,"semester_id": string,"started_at": string,"state": string,"task_id": string | null,"task_label": string,"updated_at": string
                  }
                  Insert: {
                    "break_seconds": number,"course_id"?: string | null,"course_label"?: string,"created_at"?: string,"ended_at"?: string | null,"focus_seconds": number,"focused_ms"?: number,"id": string,"mode": string,"owner_id": string,"phase": string,"remaining_ms"?: number | null,"revision"?: number,"segment_started_at"?: string | null,"semester_id": string,"started_at"?: string,"state": string,"task_id"?: string | null,"task_label"?: string,"updated_at"?: string
                  }
                  Update: {
                    "break_seconds"?: number,"course_id"?: string | null,"course_label"?: string,"created_at"?: string,"ended_at"?: string | null,"focus_seconds"?: number,"focused_ms"?: number,"id"?: string,"mode"?: string,"owner_id"?: string,"phase"?: string,"remaining_ms"?: number | null,"revision"?: number,"segment_started_at"?: string | null,"semester_id"?: string,"started_at"?: string,"state"?: string,"task_id"?: string | null,"task_label"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "focus_sessions_course_id_semester_id_owner_id_fkey"
      columns: ["course_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","semester_id","owner_id"]
    },{
      foreignKeyName: "focus_sessions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "focus_sessions_semester_id_owner_id_fkey"
      columns: ["semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "focus_sessions_task_id_semester_id_owner_id_fkey"
      columns: ["task_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","semester_id","owner_id"]
    }
                  ]
                },"note_operations": {
                  Row: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_revision": number
                  }
                  Insert: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_revision": number
                  }
                  Update: {
                    "arguments"?: NonNullable<Json>,"owner_id"?: string,"request_id"?: string,"result_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_operations_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "content": NonNullable<Json>,"course_id": string | null,"created_at": string,"id": string,"owner_id": string,"revision": number,"semester_id": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "content": NonNullable<Json>,"course_id"?: string | null,"created_at"?: string,"id": string,"owner_id": string,"revision"?: number,"semester_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"course_id"?: string | null,"created_at"?: string,"id"?: string,"owner_id"?: string,"revision"?: number,"semester_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_course_id_semester_id_owner_id_fkey"
      columns: ["course_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","semester_id","owner_id"]
    },{
      foreignKeyName: "notes_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_semester_id_owner_id_fkey"
      columns: ["semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"revision": number,"selected_semester_id": string | null,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"revision"?: number,"selected_semester_id"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"revision"?: number,"selected_semester_id"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "selected_semester_owner_fk"
      columns: ["selected_semester_id","id"]
isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"schedule_exceptions": {
                  Row: {
                    "cancelled": boolean,"ends_at": string | null,"id": string,"location": string,"original_date": string,"owner_id": string,"revision": number,"schedule_id": string,"semester_id": string,"starts_at": string | null
                  }
                  Insert: {
                    "cancelled"?: boolean,"ends_at"?: string | null,"id"?: string,"location"?: string,"original_date": string,"owner_id": string,"revision"?: number,"schedule_id": string,"semester_id": string,"starts_at"?: string | null
                  }
                  Update: {
                    "cancelled"?: boolean,"ends_at"?: string | null,"id"?: string,"location"?: string,"original_date"?: string,"owner_id"?: string,"revision"?: number,"schedule_id"?: string,"semester_id"?: string,"starts_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedule_exceptions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "schedule_exceptions_schedule_id_semester_id_owner_id_fkey"
      columns: ["schedule_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "course_schedules"
      referencedColumns: ["id","semester_id","owner_id"]
    }
                  ]
                },"schedule_operations": {
                  Row: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_id": string
                  }
                  Insert: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_id": string
                  }
                  Update: {
                    "arguments"?: NonNullable<Json>,"owner_id"?: string,"request_id"?: string,"result_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedule_operations_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"semesters": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"end_date": string,"id": string,"name": string,"owner_id": string,"revision": number,"start_date": string,"updated_at": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"end_date": string,"id"?: string,"name": string,"owner_id"?: string,"revision"?: number,"start_date": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"end_date"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"revision"?: number,"start_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "semesters_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_operations": {
                  Row: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_revision": number
                  }
                  Insert: {
                    "arguments": NonNullable<Json>,"owner_id": string,"request_id": string,"result_revision": number
                  }
                  Update: {
                    "arguments"?: NonNullable<Json>,"owner_id"?: string,"request_id"?: string,"result_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_operations_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"course_id": string | null,"created_at": string,"description": string,"due_date": string | null,"due_time": string | null,"id": string,"owner_id": string,"priority": string,"revision": number,"semester_id": string,"title": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"description"?: string,"due_date"?: string | null,"due_time"?: string | null,"id": string,"owner_id"?: string,"priority"?: string,"revision"?: number,"semester_id": string,"title": string
                  }
                  Update: {
                    "completed_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"description"?: string,"due_date"?: string | null,"due_time"?: string | null,"id"?: string,"owner_id"?: string,"priority"?: string,"revision"?: number,"semester_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_course_id_semester_id_owner_id_fkey"
      columns: ["course_id","semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","semester_id","owner_id"]
    },{
      foreignKeyName: "tasks_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_semester_id_owner_id_fkey"
      columns: ["semester_id","owner_id"]
isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "archive_semester":
{ Args: { "p_archive": boolean,"p_id": string,"p_revision": number }; Returns: {
              "archived_at": string | null,
"created_at": string,
"end_date": string,
"id": string,
"name": string,
"owner_id": string,
"revision": number,
"start_date": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "semesters"
        isOneToOne: true
        isSetofReturn: false
      } },
"change_assessment":
{ Args: { "p_course": string | null,"p_delete": boolean,"p_id": string,"p_payload": Json,"p_request": string,"p_revision": number,"p_semester": string }; Returns: number
                           },
"change_focus":
{ Args: { "p_id": string,"p_operation": string,"p_payload": Json,"p_request": string,"p_revision": number,"p_semester": string }; Returns: number
                           },
"change_note":
{ Args: { "p_content": Json,"p_course": string | null,"p_delete": boolean,"p_id": string,"p_request": string,"p_revision": number,"p_semester": string,"p_title": string }; Returns: number
                           },
"change_schedule":
{ Args: { "p_delete": boolean,"p_id": string,"p_original": string | null,"p_payload": Json,"p_request": string,"p_revision": number,"p_scope": string }; Returns: string
                           },
"change_task":
{ Args: { "p_id": string,"p_operation": string,"p_payload": Json,"p_request": string,"p_revision": number,"p_semester": string }; Returns: number
                           },
"create_semester":
{ Args: { "p_end": string,"p_id": string,"p_name": string,"p_start": string }; Returns: {
              "archived_at": string | null,
"created_at": string,
"end_date": string,
"id": string,
"name": string,
"owner_id": string,
"revision": number,
"start_date": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "semesters"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_academic":
{ Args: { "p_id": string,"p_kind": string,"p_revision": number,"p_semester": string }; Returns: undefined
                           },
"focus_snapshot":
{ Args: { "p_semester"?: string }; Returns: Json
                           },
"save_course":
{ Args: { "p_code": string,"p_color": string,"p_id": string,"p_instructor": string,"p_name": string,"p_revision": number,"p_semester": string }; Returns: {
              "code": string,
"color": string,
"id": string,
"instructor": string,
"name": string,
"owner_id": string,
"revision": number,
"semester_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "courses"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_event":
{ Args: { "p_color": string,"p_course": string | null,"p_end": string,"p_id": string,"p_revision": number,"p_semester": string,"p_start": string,"p_title": string }; Returns: {
              "color": string,
"course_id": string | null,
"ends_at": string,
"id": string,
"owner_id": string,
"revision": number,
"semester_id": string,
"starts_at": string,
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "calendar_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_profile":
{ Args: { "p_name": string,"p_revision": number,"p_timezone": string }; Returns: {
              "created_at": string,
"display_name": string,
"id": string,
"revision": number,
"selected_semester_id": string | null,
"timezone": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"select_semester":
{ Args: { "p_id": string }; Returns: undefined
                           },
"valid_note_node":
{ Args: { "depth"?: number,"n": Json,"parent"?: string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

export type CourseSchedule = Database["public"]["Tables"]["course_schedules"]["Row"];
export type ScheduleException = Database["public"]["Tables"]["schedule_exceptions"]["Row"];
export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type CalendarEvent = Database["public"]["Tables"]["calendar_events"]["Row"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Semester = Database["public"]["Tables"]["semesters"]["Row"];
