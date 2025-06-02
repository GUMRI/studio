import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { JsonSchema } from '../../services/schema.service'; // SchemaService not directly used here, but JsonSchema is
import { FilterCondition, FilterOperator } from '../../interfaces/filter-condition.interface';

export interface FlattenedField { // Exporting if it might be useful externally, or keep local
  path: string; // e.g., "profile.firstName"
  label: string; // e.g., "Profile > First Name"
  schema: JsonSchema;
}

@Component({
  selector: 'app-advanced-filter-modal',
  templateUrl: './advanced-filter-modal.component.html',
  styleUrls: ['./advanced-filter-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class AdvancedFilterModalComponent implements OnInit {
  @Input() schema!: JsonSchema; // Full schema for the collection
  @Input() appliedFilters: FilterCondition[] = [];

  currentFilters: FilterCondition[] = [];
  availableFields: FlattenedField[] = [];

  // Define available operators for each field type
  operatorsByType: { [key in JsonSchema['type'] | 'default']: FilterOperator[] } = {
    string: ['equals', 'notEquals', 'contains', 'doesNotContain', 'startsWith', 'endsWith', 'isNull', 'isNotNull', 'isEmpty', 'isNotEmpty', 'in', 'notIn'],
    number: ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEquals', 'lessThanOrEquals', 'between', 'isNull', 'isNotNull', 'in', 'notIn'],
    boolean: ['equals', 'notEquals', 'isNull', 'isNotNull'],
    array: ['isEmpty', 'isNotEmpty', 'isNull', 'isNotNull'], // 'contains' / 'doesNotContain' for array items would need special handling beyond simple value input
    object: ['isNull', 'isNotNull'], // Direct filtering on objects is complex; typically done via their properties
    null: ['isNull', 'isNotNull'], // For fields that can be explicitly null
    default: ['equals', 'notEquals', 'isNull', 'isNotNull', 'contains'] // A generic fallback
  };

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    this.availableFields = this.flattenSchemaPropertiesRecursive(this.schema);
    if (this.appliedFilters && this.appliedFilters.length > 0) {
      this.currentFilters = JSON.parse(JSON.stringify(this.appliedFilters));
      // Ensure fieldSchema is (re)populated for existing filters based on the current full schema
      this.currentFilters.forEach(filter => {
        const field = this.availableFields.find(f => f.path === filter.fieldPath);
        if (field) {
          filter.fieldSchema = field.schema; // Assign the schema part for the field
        } else {
          // Handle cases where a saved filter's fieldPath might no longer exist in schema
          console.warn(`Field path "${filter.fieldPath}" not found in current schema.`);
          // Optionally, mark this filter as invalid or remove it
        }
      });
    } else {
      this.addFilterCondition(); // Start with one empty filter if none are applied
    }
  }

  private flattenSchemaPropertiesRecursive(schema: JsonSchema, prefix: string = '', currentLabelPrefix: string = ''): FlattenedField[] {
    let fields: FlattenedField[] = [];
    if (schema && schema.type === 'object' && schema.properties) {
      for (const key in schema.properties) {
        const propSchema = schema.properties[key];
        const path = prefix ? `${prefix}.${key}` : key;
        // Use ui.label from property schema first, then title, then formatted key
        const title = propSchema.ui?.label || propSchema.title || this.toTitleCase(key);
        const label = currentLabelPrefix ? `${currentLabelPrefix} > ${title}` : title;

        // Add the current property
        fields.push({ path, label, schema: propSchema });

        // Recursively flatten nested objects, limit depth to avoid overly complex UI / performance issues
        if (propSchema.type === 'object' && propSchema.properties && (prefix.match(/\./g) || []).length < 2) { // Limit nesting depth for UI
          fields = fields.concat(this.flattenSchemaPropertiesRecursive(propSchema, path, label));
        }
        // Note: Arrays of objects are not flattened for field selection by this logic.
        // Filtering on items within an array of objects (e.g., 'tags.ANY_ITEM.name') would need more specific UI/logic.
        // For arrays of primitives, the main field (e.g. 'tags') can be filtered with 'isEmpty', 'isNotEmpty'.
      }
    }
    return fields.sort((a,b) => a.label.localeCompare(b.label)); // Sort alphabetically by full label path
  }
  
  toTitleCase(str: string): string { // Helper for formatting property keys into labels
    if (!str) return '';
    // Add spaces before capitals (for camelCase) and replace underscores/hyphens
    str = str.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ');
    // Capitalize first letter of each word
    return str.replace(/\b\w/g, char => char.toUpperCase()).trim();
  }


  addFilterCondition(): void {
    if (this.availableFields.length === 0) return; // Should not happen if schema is valid
    const defaultField = this.availableFields[0];
    this.currentFilters.push({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2), // Simple unique ID
      fieldPath: defaultField.path,
      operator: this.getApplicableOperators(defaultField.schema)[0], // Default to first applicable operator
      value: undefined,
      value2: undefined,
      fieldSchema: defaultField.schema, // Store the schema for this field
    });
  }

  removeFilterCondition(id: string): void {
    this.currentFilters = this.currentFilters.filter(f => f.id !== id);
    if (this.currentFilters.length === 0) {
      // Optionally, always keep at least one filter row by calling addFilterCondition()
      // For now, allow removing all to have an empty filter state.
    }
  }

  onFieldSelected(filter: FilterCondition, fieldPath: string): void {
    const selectedField = this.availableFields.find(f => f.path === fieldPath);
    if (selectedField) {
      filter.fieldPath = selectedField.path;
      filter.fieldSchema = selectedField.schema; // Update the field's schema
      filter.operator = this.getApplicableOperators(selectedField.schema)[0]; // Reset operator
      filter.value = undefined; // Reset values as type might have changed
      filter.value2 = undefined;
    }
  }

  getApplicableOperators(fieldSchema?: JsonSchema): FilterOperator[] {
    if (!fieldSchema || !fieldSchema.type) {
      return this.operatorsByType['default']; // Fallback if type is missing
    }
    // For arrays, operators depend on items type. If items is object, only isNull/isNotNull/isEmpty/isNotEmpty.
    // If items is primitive, could allow contains/doesNotContain on the array of primitives.
    if (fieldSchema.type === 'array') {
        if (fieldSchema.items && !Array.isArray(fieldSchema.items) && 
            ['string', 'number'].includes((fieldSchema.items as JsonSchema).type as string)) {
            return ['isEmpty', 'isNotEmpty', 'contains', 'doesNotContain', 'isNull', 'isNotNull'];
        }
        return ['isEmpty', 'isNotEmpty', 'isNull', 'isNotNull'];
    }
    return this.operatorsByType[fieldSchema.type] || this.operatorsByType['default'];
  }

  dismissModal(apply: boolean): void {
    if (apply) {
      const validFilters = this.currentFilters.filter(f => {
        if (!f.fieldPath || !f.operator) return false; // Field and operator must be selected
        if (this.isOperatorUnary(f.operator)) return true; // Unary operators don't need a value
        if (this.isOperatorTernary(f.operator)) { // 'between'
            return f.value !== undefined && f.value !== '' && f.value2 !== undefined && f.value2 !== '';
        }
        // For 'in'/'notIn', value might be a comma-separated string to be parsed later
        return f.value !== undefined && f.value !== ''; // Basic validation: value must be set for non-unary
      });
      this.modalCtrl.dismiss(validFilters, 'apply');
    } else {
      this.modalCtrl.dismiss(null, 'cancel');
    }
  }

  isOperatorUnary(operator: FilterOperator): boolean {
    return ['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(operator);
  }

  isOperatorTernary(operator: FilterOperator): boolean { // Needs two value inputs ('between')
    return operator === 'between';
  }
  
  // Helper for trackBy in ngFor for performance
  trackById(index: number, item: FilterCondition): string {
    return item.id;
  }
}
