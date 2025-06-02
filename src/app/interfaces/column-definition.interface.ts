import { JsonSchema } from "../services/schema.service"; // To use JsonSchema['type'] etc.

export interface ColumnDefinition {
  path: string; // Property key or dot-notation path for nested fields e.g., 'firstName', 'address.street'
  label: string; // User-friendly label for the column header
  type: JsonSchema['type']; // JSON schema type: 'string', 'number', 'boolean', 'object', 'array', 'null'
  format?: JsonSchema['format']; // e.g., 'date-time', 'email', 'uuid'
  isRequired: boolean;
  isEncrypted?: boolean; // If the field is marked as encrypted
  ui?: JsonSchema['ui']; // To access UI hints like label from schema directly

  // For handling nested schemas if we decide to display more than just "[Object]"
  // properties?: { [key: string]: ColumnDefinition }; // For type 'object'
  // itemSchema?: ColumnDefinition; // For type 'array'
}
