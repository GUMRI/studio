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
  @Input() selectedRows: ReadonlySet<any> = new Set();

  @Output() selectedRowsChanged = new EventEmitter<Set<any>>();
  @Output() viewArrayItems = new EventEmitter<{ itemData: any, column: ColumnDefinition, fullRowData: any }>();
  @Output() viewObjectDetails = new EventEmitter<{ itemData: any, column: ColumnDefinition, fullRowData: any }>();
  // Note: fullRowData is added to emitter to give context to the modal host if needed. itemData is specifically item[col.path]

  displayColumns: ColumnDefinition[] = [];
  private internalSchema: JsonSchema | null = null;

  constructor(
    private schemaService: SchemaService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    // ngOnChanges will handle initial input processing.
    // ngOnInit can be used for one-time initializations not dependent on @Inputs, if any.
    // console.log('SmartTableComponent: ngOnInit');
    if (!this.internalSchema && (this.schema || this.collectionName)) {
       // This case handles if ngOnChanges didn't fire for initial inputs for some reason,
       // or if inputs become available after initial empty/null state.
       // However, ngOnChanges *should* fire for initial @Input values.
       this.processInitialSchema();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // console.log('SmartTableComponent: ngOnChanges detected changes', changes);
    let needsColumnGeneration = false;
    let schemaPotentiallyChanged = false;

    // Priority 1: Direct schema input change
    if (changes['schema']) {
      // console.log('SmartTableComponent: Schema input changed');
      this.internalSchema = this.schema;
      needsColumnGeneration = true;
      schemaPotentiallyChanged = true;
    }

    // Priority 2: collectionName change (only if schema is not directly provided or was removed)
    // If schema is provided directly, collectionName is secondary or for context only.
    if (changes['collectionName'] && (!this.schema || !changes['schema'])) {
      // console.log('SmartTableComponent: collectionName input changed and no direct schema override');
      // If collectionName changes, we must reload the schema based on the new name.
      this.loadSchemaByName(); // This method sets internalSchema and calls generateDisplayColumns.
      needsColumnGeneration = false; // loadSchemaByName handles its own column generation.
      schemaPotentiallyChanged = true; // Schema will be loaded (or attempted)
    }
    
    // If schema was set directly in this cycle, and it's different, generate columns.
    if (needsColumnGeneration) {
      // console.log('SmartTableComponent: Needs column generation due to direct schema change or initial load.');
      this.generateDisplayColumns();
    }
    
    // Handle data changes
    if (changes['data']) {
      // console.log('SmartTableComponent: Data input changed');
      // Data has changed. The template will re-render automatically as it iterates over 'data'.
      // If the schema also changed in the same cycle, columns are already being regenerated.
      // If only data changed, selected rows should be reset by the parent component typically.
      // If this component were to manage its selection independently from input:
      // if (!schemaPotentiallyChanged) { // Only reset selection if schema didn't change (avoid double reset)
      //    this.selectedRowsChanged.emit(new Set()); // If component itself managed selection
      // }
    }

    // If schema potentially changed (either by direct input or collectionName change),
    // it's a good idea to notify that selection might be invalid.
    // The parent (CollectionPage) already clears selection in applyAllFilters when data/schema changes.
    if (schemaPotentiallyChanged && changes['selectedRows'] === undefined) { // Avoid if parent is already resetting selection
        // console.log('SmartTableComponent: Schema changed, emitting empty set for selectedRowsChanged');
        // This signals to parent that current selection might be invalid due to schema change.
        // However, this can create a loop if parent then updates selectedRows input.
        // Best if parent manages selection reset when it changes the data/schema.
        // For now, CollectionPageComponent clears selection in applyAllFilters, which is good.
    }
  }

  private processInitialSchema(): void {
    // console.log('SmartTableComponent: processInitialSchema called');
    if (this.schema) {
      this.internalSchema = this.schema;
      this.generateDisplayColumns();
    } else if (this.collectionName) {
      this.loadSchemaByName();
    } else {
      this.displayColumns = []; // No schema context
    }
  }

  private loadSchemaByName(): void {
    // console.log('SmartTableComponent: loadSchemaByName for', this.collectionName);
    if (this.collectionName) {
      this.internalSchema = this.schemaService.getSchema(this.collectionName) || null;
    } else {
      this.internalSchema = null;
    }
    this.generateDisplayColumns(); // Regenerate columns after schema is loaded/updated
  }

  private generateDisplayColumns(): void {
    // console.log('SmartTableComponent: generateDisplayColumns based on', this.internalSchema);
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


  // --- Modal Trigger Emitters ---
  onViewArrayItems(event: Event, itemData: any, column: ColumnDefinition, fullRowData: any): void {
    event.stopPropagation(); // Prevent row selection toggle if button is inside cell
    this.viewArrayItems.emit({ itemData, column, fullRowData });
  }

  onViewObjectDetails(event: Event, itemData: any, column: ColumnDefinition, fullRowData: any): void {
    event.stopPropagation(); // Prevent row selection toggle
    this.viewObjectDetails.emit({ itemData, column, fullRowData });
  }

  // --- Display Logic ---
  // This method is now simplified, primarily for basic string conversion or complex object/array length.
  // Specific formatting (dates, booleans) is handled more directly in the template.
  getDisplayValue(item: any, column: ColumnDefinition): string {
    if (item === null || item === undefined) return ''; // Should not happen if item is the row data
    
    const value = item[column.path]; // Access the specific field's value from the row item

    if (value === null || value === undefined) return '-'; // Display dash for null/undefined values
    // Encrypted check will be done in template before calling this for value.

    switch (column.type) {
      case 'object':
        return '[Object]'; // Placeholder, button will be used
      case 'array':
        // For simple arrays of primitives, could join them. For now, just count.
        if (Array.isArray(value)) {
          return `[${value.length} item(s)]`;
        }
        return '[Array]';
      case 'string':
        if (column.format === 'date-time' || column.format === 'date') {
          // DatePipe will be used in template, this is a fallback or for non-pipe scenarios
          try {
            return this.datePipe.transform(value, 'mediumDate') || String(value);
          } catch (e) { return String(value); }
        }
        return String(value);
      case 'number':
      case 'boolean': // Boolean is handled by ion-toggle in template, this is fallback
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
