import { Component, Input, OnChanges, OnInit, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SchemaService, JsonSchema } from '../../services/schema.service';
import { ColumnDefinition } from '../../interfaces/column-definition.interface';

@Component({
  selector: 'app-smart-table',
  templateUrl: './smart-table.component.html',
  styleUrls: ['./smart-table.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule, // For any Ionic components used in template (e.g., ion-icon)
  ],
  providers: [DatePipe] // Add DatePipe here if used in getDisplayValue
})
export class SmartTableComponent implements OnInit, OnChanges {
  @Input() data: any[] = [];
  @Input() schema: JsonSchema | null = null;
  @Input() collectionName: string | null = null;
  @Input() selectedRows: ReadonlySet<any> = new Set(); // Input for selected rows

  @Output() selectedRowsChanged = new EventEmitter<Set<any>>();
  // @Output() rowSelected = new EventEmitter<any>(); // Could be useful if parent needs individual row click events

  displayColumns: ColumnDefinition[] = [];
  private internalSchema: JsonSchema | null = null;

  constructor(
    private schemaService: SchemaService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.processInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    let schemaChanged = false;
    if (changes['schema']) {
      this.internalSchema = this.schema;
      schemaChanged = true;
    }
    if (changes['collectionName'] && !this.schema) {
      // If schema is not directly provided, and collectionName changes, reload schema
      this.loadSchemaByName(); // This calls generateDisplayColumns internally
      schemaChanged = false; // Already handled
    }
    if (changes['data'] && !schemaChanged) { // Only re-gen columns if data changes AND schema didn't just change (which already re-gens)
      // This condition might be too complex; often, just re-generating columns on data change is fine
      // if generateDisplayColumns is cheap, or if data structure might imply column changes (not typical).
      // For now, assume columns depend mostly on schema, not data content itself.
    }
    // If selectedRows input changes, the template will automatically reflect it due to [checked] binding.

    if (schemaChanged) {
      this.generateDisplayColumns();
    }
  }

  private processInputs(): void {
    if (this.schema) {
      this.internalSchema = this.schema;
      this.generateDisplayColumns();
    } else if (this.collectionName) {
      this.loadSchemaByName();
    } else {
      this.displayColumns = [];
    }
  }

  private loadSchemaByName(): void {
    if (this.collectionName) {
      this.internalSchema = this.schemaService.getSchema(this.collectionName) || null;
    } else {
      this.internalSchema = null;
    }
    this.generateDisplayColumns();
  }

  private generateDisplayColumns(): void {
    if (!this.internalSchema || this.internalSchema.type !== 'object' || !this.internalSchema.properties) {
      this.displayColumns = [];
      return;
    }

    const properties = this.internalSchema.properties;
    const requiredFields = new Set(this.internalSchema.required || []);
    // Assuming 'encrypted' is a custom array of field names at the schema's top level
    const encryptedFields = new Set((this.internalSchema as any).encrypted || []); 

    this.displayColumns = Object.keys(properties).map(key => {
      const propSchema = properties[key];
      const label = propSchema.ui?.label || propSchema.title || this.toTitleCase(key);
      
      return {
        path: key,
        label: label,
        type: propSchema.type,
        format: propSchema.format,
        isRequired: requiredFields.has(key),
        isEncrypted: encryptedFields.has(key), // Check against custom 'encrypted' array
        ui: propSchema.ui // Pass UI hints for potential use in template or getDisplayValue
      };
    }).sort((a,b) => { // Basic sort by UI order then by label
        const orderA = a.ui?.order ?? Infinity;
        const orderB = b.ui?.order ?? Infinity;
        if (orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
    });
  }

  // --- Row Selection Logic ---
  isRowSelected(row: any): boolean {
    return this.selectedRows.has(row);
  }

  toggleRowSelection(row: any): void {
    const newSelectedRows = new Set(this.selectedRows); // Create a new Set
    if (newSelectedRows.has(row)) {
      newSelectedRows.delete(row);
    } else {
      newSelectedRows.add(row);
    }
    this.selectedRowsChanged.emit(newSelectedRows);
    // this.rowSelected.emit(row); // Emit individual row selection event if needed
  }

  // Optional: Select All / Deselect All visible items
  get areAllDisplayedRowsSelected(): boolean {
    if (this.data.length === 0) return false;
    return this.data.every(row => this.selectedRows.has(row));
  }

  toggleSelectAllDisplayed(): void {
    const newSelectedRows = new Set(this.selectedRows);
    if (this.areAllDisplayedRowsSelected) {
      // Deselect all currently displayed items
      this.data.forEach(row => newSelectedRows.delete(row));
    } else {
      // Select all currently displayed items
      this.data.forEach(row => newSelectedRows.add(row));
    }
    this.selectedRowsChanged.emit(newSelectedRows);
  }


  // --- Display Logic ---
  getDisplayValue(item: any, column: ColumnDefinition): string {
    if (item === null || item === undefined) return '';
    
    const value = item[column.path];

    if (value === null || value === undefined) return '';
    if (column.isEncrypted) return '[Encrypted]';

    switch (column.type) {
      case 'object':
        return '[Object]';
      case 'array':
        return `[Array (${(value as any[]).length})]`;
      case 'boolean':
        // The template now handles boolean with icons directly. This can be a fallback.
        return value ? 'Yes' : 'No'; 
      case 'string':
        if (column.format === 'date-time') {
          try {
            return this.datePipe.transform(value, 'medium') || String(value);
          } catch (e) {
            return String(value);
          }
        }
        return String(value);
      case 'number':
        return String(value);
      default:
        return String(value);
    }
  }

  private toTitleCase(str: string): string {
    if (!str) return '';
    // Simple camelCase/snake_case to Title Case
    str = str.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize each word
  }
}
