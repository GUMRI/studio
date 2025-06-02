import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { JsonSchema } from '../../services/schema.service'; // Re-using JsonSchema interface

interface DisplayableProperty {
  key: string;
  label: string;
  type: JsonSchema['type'];
  format?: JsonSchema['format'];
}

@Component({
  selector: 'app-array-items-modal',
  templateUrl: './array-items-modal.component.html',
  styleUrls: ['./array-items-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
  providers: [DatePipe] // For formatting dates if item properties are dates
})
export class ArrayItemsModalComponent implements OnInit {
  @Input() items: any[] = [];
  @Input() itemSchema: JsonSchema | null = null; // Schema for a single item in the array
  @Input() parentFieldLabel: string = 'Array Items'; // e.g., "Tags", "Order Lines"

  displayableProperties: DisplayableProperty[] = [];

  constructor(
    private modalCtrl: ModalController,
    private datePipe: DatePipe
  ) {}

  ngOnInit() {
    if (this.itemSchema && this.itemSchema.type === 'object' && this.itemSchema.properties) {
      const props = this.itemSchema.properties;
      this.displayableProperties = Object.keys(props).map(key => {
        const propSchema = props[key];
        return {
          key: key,
          label: propSchema.ui?.label || propSchema.title || this.toTitleCase(key),
          type: propSchema.type,
          format: propSchema.format
        };
      }).sort((a,b) => { // Basic sort by label or UI order if available
        const orderA = this.itemSchema?.properties?.[a.key]?.ui?.order ?? Infinity;
        const orderB = this.itemSchema?.properties?.[b.key]?.ui?.order ?? Infinity;
        if(orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
      });
    }
  }

  dismissModal(): void {
    this.modalCtrl.dismiss();
  }

  getDisplayValueForItemProperty(item: any, prop: DisplayableProperty): string {
    if (item === null || item === undefined) return '-';
    const value = item[prop.key];

    if (value === null || value === undefined) return '-';

    switch (prop.type) {
      case 'object':
        return '[Object]';
      case 'array':
        return `[Array (${(value as any[]).length})]`;
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'string':
        if (prop.format === 'date-time' || prop.format === 'date') {
          try {
            return this.datePipe.transform(value, 'mediumDate') || String(value);
          } catch (e) { return String(value); }
        }
        return String(value);
      case 'number':
      case 'integer':
        return String(value);
      default:
        return String(value);
    }
  }
  
  // Helper to get value for simple items (not objects)
  getDisplayValueForSimpleItem(item: any): string {
    if (item === null || item === undefined) return '-';
    if (this.itemSchema) { // Use itemSchema for formatting if available (e.g. if array of dates)
        if (this.itemSchema.type === 'string' && (this.itemSchema.format === 'date-time' || this.itemSchema.format === 'date')) {
            try {
                return this.datePipe.transform(item, 'mediumDate') || String(item);
            } catch(e) { return String(item); }
        }
         if (this.itemSchema.type === 'boolean') {
            return item ? 'Yes' : 'No';
        }
    }
    if (typeof item === 'object') return JSON.stringify(item); // Fallback for unexpected objects
    return String(item);
  }


  private toTitleCase(str: string): string {
    if (!str) return '';
    str = str.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ');
    return str.replace(/\b\w/g, char => char.toUpperCase()).trim();
  }
}
