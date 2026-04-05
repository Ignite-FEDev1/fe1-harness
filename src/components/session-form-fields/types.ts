/**
 * Input schema field types used in session creation forms and pipeline input schemas.
 *
 * These types define the shape of a pipeline's input-schema.json — the contract
 * between pipeline definitions and the session creation form UI.
 */

export type InputFieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'url-list'
  | 'text-list'
  | 'repeat-group'
  | 'checkbox'
  | 'radio';

export interface InputField {
  id: string;
  label: string;
  type: InputFieldType;
  required?: boolean;
  placeholder?: string;
  /** Sub-fields for `repeat-group` type */
  fields?: InputField[];
  /** Options for `radio` type */
  options?: Array<{ value: string; label: string }>;
  /** Default value for `checkbox` (boolean) or `radio` (string) */
  default?: string | boolean;
  /** Helper text shown below the field (used by `checkbox`) */
  description?: string;
}

export interface InputSchema {
  fields: InputField[];
}

/** Form state value for any field type */
export type FieldValue = string | string[] | Record<string, string>[] | boolean;
