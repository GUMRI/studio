import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { JsonSchema } from '../../services/schema.service'; // Re-using JsonSchema interface

interface DisplayableObjectProperty {
  key: string;
  label: string;
  type: JsonSchema['type'];
  format?: JsonSchema['format'];
  isEncrypted?: boolean;
  isRequired?: boolean; // Added to indicate if the field is required by the parent object
  schema?: JsonSchema; 
  value?: any;
}

@Component({
  selector: 'app-object-details-modal',
  templateUrl: './object-details-modal.component.html',
  styleUrls: ['./object-details-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
  providers: [DatePipe]
})
export class ObjectDetailsModalComponent implements OnInit {
  @Input() objectData: any | null = null;
  @Input() objectSchema: JsonSchema | null = null; // Schema for the object itself
  @Input() parentFieldLabel: string = 'Object Details';

  displayableProperties: DisplayableObjectProperty[] = [];

  constructor(
    private modalCtrl: ModalController,
    private datePipe: DatePipe
  ) {}

  ngOnInit() {
    if (this.objectData && this.objectSchema && this.objectSchema.type === 'object' && this.objectSchema.properties) {
      const props = this.objectSchema.properties;
      const encryptedFields = new Set((this.objectSchema as any).encrypted || []);
      const requiredFields = new Set(this.objectSchema.required || []); // Get required fields from the parent object's schema

      this.displayableProperties = Object.keys(props).map(key => {
        const propSchema = props[key];
        const value = this.objectData![key];
        return {
          key: key,
          label: propSchema.ui?.label || propSchema.title || this.toTitleCase(key),
          type: propSchema.type,
          format: propSchema.format,
          isEncrypted: encryptedFields.has(key),
          isRequired: requiredFields.has(key), // Check if this key is in parent's required list
          schema: propSchema,
          value: value
        };
      }).sort((a,b) => {
        const orderA = a.schema?.ui?.order ?? Infinity;
        const orderB = b.schema?.ui?.order ?? Infinity;
        if(orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
      });
    }
  }

  dismissModal(): void {
    this.modalCtrl.dismiss();
  }

  // This method now primarily formats the pre-resolved value stored in DisplayableObjectProperty
  getFormattedDisplayValue(prop: DisplayableObjectProperty): string {
    if (prop.isEncrypted) return '[Encrypted]';
    if (prop.value === null || prop.value === undefined) return '-';

    switch (prop.type) {
      case 'object':
        return '[Object]'; // Placeholder for nested object
      case 'array':
        return `[Array (${(prop.value as any[]).length})]`; // Placeholder for nested array
      case 'boolean':
        return prop.value ? 'Yes' : 'No';
      case 'string':
        if (prop.format === 'date-time' || prop.format === 'date') {
          try {
            return this.datePipe.transform(prop.value, 'mediumDate') || String(prop.value);
          } catch (e) { return String(prop.value); }
        }
        return String(prop.value);
      case 'number':
      case 'integer':
        return String(prop.value);
      default:
        return String(prop.value);
    }
  }

  isNestedObjectOrArray(propType: JsonSchema['type']): boolean {
    return propType === 'object' || propType === 'array';
  }
  
  // In case we want to show a small preview of array items if they are simple
  getArrayPreview(value: any[], itemSchema?: JsonSchema): string {
    if (!Array.isArray(value) || value.length === 0) return '[]';
    
    // If items are complex or itemSchema is not simple, just show count
    if (!itemSchema || (itemSchema.type !== 'string' && itemSchema.type !== 'number' && itemSchema.type !== 'boolean')) {
        return `[${value.length} item(s)]`;
    }

    const previewLimit = 3;
    let preview = value.slice(0, previewLimit).map(v => {
        if (itemSchema.type === 'boolean') return v ? 'true' : 'false';
        return String(v);
    }).join(', ');

    if (value.length > previewLimit) {
        preview += `, ... (${value.length - previewLimit} more)`;
    }
    return `[ ${preview} ]`;
  }


  private toTitleCase(str: string): string {
    if (!str) return '';
    str = str.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ');
    return str.replace(/\b\w/g, char => char.toUpperCase()).trim();
  }
}
