import { FieldSchema } from "../services/schema.service"; // Assuming FieldSchema might be useful here

export type FilterOperator =
  | 'equals' | 'notEquals'
  | 'contains' | 'doesNotContain' | 'startsWith' | 'endsWith'
  | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'between'
  | 'isNull' | 'isNotNull'
  | 'in' | 'notIn'; // For checking against a list of values, e.g. for enums or multi-select

export interface FilterCondition {
  id: string; // Unique ID for Angular's *ngFor trackBy
  field: string; // Name of the field
  fieldType: FieldSchema['type']; // Type of the field to help determine operators/inputs
  operator: FilterOperator;
  value?: any;
  value2?: any; // For 'between' operator or IN list
}
