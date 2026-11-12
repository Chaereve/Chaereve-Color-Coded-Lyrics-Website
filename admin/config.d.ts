/**
 * Types for the Decap CMS configuration (admin/config.yml and the build-time
 * generated /admin/config.yml). Used by scripts/check-cms-config.ts.
 */

export interface CmsSelectOption {
  label: string;
  value: string;
}

export interface CmsField {
  label: string;
  name: string;
  widget:
    | 'string'
    | 'text'
    | 'number'
    | 'boolean'
    | 'datetime'
    | 'image'
    | 'color'
    | 'select'
    | 'list'
    | 'object'
    | 'markdown'
    | 'hidden'
    | 'file';
  required?: boolean;
  default?: string | number | boolean;
  options?: CmsSelectOption[];
  fields?: CmsField[];
  field?: CmsField;
  collapsed?: boolean;
  hint?: string;
  help?: string;
  pattern?: [string, string];
  format?: string;
  date_format?: string;
  time_format?: string;
  [key: string]: unknown;
}

export interface CmsFileEntry {
  name: string;
  label: string;
  file: string;
  format: string;
  fields: CmsField[];
}

export interface CmsCollection {
  name: string;
  label: string;
  label_singular?: string;
  folder?: string;
  files?: CmsFileEntry[];
  format?: string;
  slug?: string;
  summary_fields?: string[];
  fields?: CmsField[];
  [key: string]: unknown;
}

export interface CmsBackend {
  name: string;
  /** turbo-github */
  turbo_site_id?: string;
  /** github */
  repo?: string;
  branch?: string;
  base_url?: string;
  auth_endpoint?: string;
  open_authoring?: boolean;
  auth_scope?: string;
  /** test (local) */
  local_backend?: boolean;
}

export interface CmsConfig {
  backend: CmsBackend;
  publish_mode: 'editorial_workflow';
  site_url?: string;
  display_url?: string;
  logo_url?: string;
  media_folder?: string;
  public_folder?: string;
  collections: CmsCollection[];
}
