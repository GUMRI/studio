import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular'; // Import ModalController
import { SchemaService, TableSchema, FieldSchema } from '../services/schema.service';
import { DataService } from '../services/data.service';
import { FilterCondition } from '../interfaces/filter-condition.interface'; // Import FilterCondition
import { AdvancedFilterModalComponent } from '../shared/advanced-filter-modal/advanced-filter-modal.component'; // Import Modal Component

interface ColumnDefinition {
  key: string;
  label: string;
  type: FieldSchema['type'];
  isId?: boolean;
  foreignKey?: FieldSchema['foreignKey'];
  enum?: FieldSchema['enum'];
  arrayType?: FieldSchema['arrayType'];
  arrayItemSchema?: FieldSchema['arrayItemSchema'];
}

@Component({
  selector: 'app-collection-tab-page',
  templateUrl: './collection-tab-page.component.html',
  styleUrls: ['./collection-tab-page.component.scss'],
})
export class CollectionTabPageComponent implements OnInit {
  collectionName: string | null = null;
  currentSchema: TableSchema | undefined;
  collectionData: any[] = []; // Holds the original, unfiltered data from the service
  filteredCollectionData: any[] = [];
  columnDefinitions: ColumnDefinition[] = [];
  selectedRows: Set<any> = new Set();
  searchTerm: string = '';
  advancedFilters: FilterCondition[] = []; // To store active advanced filters

  constructor(
    private route: ActivatedRoute,
    private schemaService: SchemaService,
    private dataService: DataService,
    private alertController: AlertController,
    private modalController: ModalController // Inject ModalController
  ) {}

  ngOnInit() {
    this.loadDataAndSchema();
  }

  ionViewWillEnter() {
    // Potentially refresh data or schema if needed when view re-enters
    if (!this.collectionName || !this.currentSchema) {
      this.loadDataAndSchema(); // This will also call applyFiltersAndSearch
    } else {
      // If schema is loaded, ensure data is up-to-date from the service for `collectionData`
      // Then re-apply filters.
      if (this.collectionName) { // collectionName should be defined here
          this.collectionData = [...this.dataService.getData(this.collectionName)];
          this.applyFiltersAndSearch(); // Re-apply search/filters
      }
      // Selection should ideally be based on IDs if data can change instance
      // For now, clearing selection on re-enter is safer if list instances change
      this.deselectAllRows(); 
    }
  }

  private loadDataAndSchema(): void {
    const name = this.route.snapshot.paramMap.get('collectionName');
    if (name) {
      this.collectionName = name;
      this.currentSchema = this.schemaService.getSchema(this.collectionName);
      this.collectionData = [...this.dataService.getData(this.collectionName)];

      if (this.currentSchema) {
        this.columnDefinitions = this.currentSchema.fields.map(field => ({
          key: field.name,
          label: field.label || field.name,
          type: field.type,
          isId: field.isId,
          foreignKey: field.foreignKey,
          enum: field.enum,
          arrayType: field.arrayType,
          arrayItemSchema: field.arrayItemSchema,
        }));
      } else {
        console.error(`Schema not found for collection: ${this.collectionName}`);
        this.columnDefinitions = [];
        this.collectionData = []; // Clear data if no schema
      }
    } else {
      console.error('Collection name not found in route parameters.');
      this.collectionName = null;
      this.currentSchema = undefined;
      this.collectionData = [];
      this.columnDefinitions = [];
    }
    this.applyFiltersAndSearch(); // Initial application of filters (which will just copy data if no search term)
    this.deselectAllRows(); 
  }

  // --- Search and Filter ---
  onSearchChange(event: any): void {
    this.searchTerm = event.target.value || '';
    this.applyFiltersAndSearch();
  }

  applyFiltersAndSearch(): void {
    let tempData = [...this.collectionData];

    // 1. Apply Advanced Filters
    if (this.advancedFilters.length > 0) {
      tempData = tempData.filter(item => {
        return this.advancedFilters.every(filter => {
          const itemValue = item[filter.field];
          let { value, value2, operator } = filter; // value and value2 from filter are strings from input

          // Type conversion for filter values based on fieldType
          if (filter.fieldType === 'number') {
            value = parseFloat(value);
            if (value2 !== undefined) value2 = parseFloat(value2);
          } else if (filter.fieldType === 'date') {
            value = value ? new Date(value).getTime() : undefined; // Compare timestamps
            if (value2 !== undefined) value2 = value2 ? new Date(value2).getTime() : undefined;
          } else if (filter.fieldType === 'boolean') {
            value = String(value).toLowerCase() === 'true';
          }
          // String values are used as is.

          const itemFieldForComparison = filter.fieldType === 'date' && itemValue ? new Date(itemValue).getTime() : itemValue;

          switch (operator) {
            case 'equals': return itemFieldForComparison == value; // Use == for type flexibility with numbers/strings from input
            case 'notEquals': return itemFieldForComparison != value;
            case 'contains': return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
            case 'doesNotContain': return !String(itemValue).toLowerCase().includes(String(value).toLowerCase());
            case 'startsWith': return String(itemValue).toLowerCase().startsWith(String(value).toLowerCase());
            case 'endsWith': return String(itemValue).toLowerCase().endsWith(String(value).toLowerCase());
            case 'greaterThan': return itemFieldForComparison > value;
            case 'lessThan': return itemFieldForComparison < value;
            case 'greaterThanOrEqual': return itemFieldForComparison >= value;
            case 'lessThanOrEqual': return itemFieldForComparison <= value;
            case 'between': return itemFieldForComparison >= value && itemFieldForComparison <= value2;
            case 'isNull': return itemValue === null || itemValue === undefined;
            case 'isNotNull': return itemValue !== null && itemValue !== undefined;
            // 'in' and 'notIn' would require value to be an array, not handled by simple input yet
            default: return true;
          }
        });
      });
    }

    // 2. Apply Search Term (to the result of advanced filters)
    if (this.searchTerm.trim() !== '') {
      const lowerSearchTerm = this.searchTerm.toLowerCase().trim();
      tempData = tempData.filter(item => {
        if (!this.currentSchema) return false;
        return this.columnDefinitions.some(colDef => {
          const originalValue = item[colDef.key];
          let valueToSearch = String(originalValue); // Default to raw value stringified

          if (colDef.foreignKey && this.collectionName) {
             const displayValue = this.getDisplayValue(item, colDef);
             if (displayValue !== `ID: ${originalValue} (FK Not Found)` && displayValue !== originalValue) {
                valueToSearch = String(displayValue);
             }
          }
          
          switch (colDef.type) {
            case 'string':
            case 'enum':
              return valueToSearch.toLowerCase().includes(lowerSearchTerm);
            case 'number':
            case 'boolean':
              return valueToSearch.toLowerCase().includes(lowerSearchTerm);
            case 'date':
              return new Date(originalValue).toLocaleString().toLowerCase().includes(lowerSearchTerm);
            case 'array':
              if (colDef.arrayType === 'string' || colDef.arrayType === 'number') {
                return (originalValue as any[]).join(' ').toLowerCase().includes(lowerSearchTerm);
              }
              return false;
            case 'object':
              return false; 
            default:
              return false;
          }
        });
      });
    }

    this.filteredCollectionData = tempData;
    this.deselectAllRows();
  }

  // --- Advanced Filter Modal ---
  async openAdvancedFilterModal(): Promise<void> {
    if (!this.currentSchema?.fields) return;

    const modal = await this.modalController.create({
      component: AdvancedFilterModalComponent,
      componentProps: {
        fields: this.currentSchema.fields,
        appliedFilters: JSON.parse(JSON.stringify(this.advancedFilters)) // Pass a deep copy
      }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'apply' && data) {
      this.advancedFilters = data;
      this.applyFiltersAndSearch();
    }
  }

  // --- Row Selection ---
  toggleRowSelection(row: any): void {
    if (this.selectedRows.has(row)) {
      this.selectedRows.delete(row);
    } else {
      this.selectedRows.add(row);
    }
  }

  isRowSelected(row: any): boolean {
    return this.selectedRows.has(row);
  }

  selectAllRows(): void {
    // Select all visible (filtered) rows
    this.filteredCollectionData.forEach(row => this.selectedRows.add(row));
  }

  deselectAllRows(): void {
    this.selectedRows.clear();
  }

  get areAllRowsSelected(): boolean {
    // Check against filtered data
    return this.filteredCollectionData.length > 0 && this.selectedRows.size === this.filteredCollectionData.length;
  }

  toggleSelectAll(): void {
    if (this.areAllRowsSelected) {
      this.deselectAllRows();
    } else {
      this.selectAllRows();
    }
  }

  // --- Add New Row ---
  addNewRow(): void {
    if (!this.currentSchema || !this.collectionName) return;

    const newRow: any = {};
    this.currentSchema.fields.forEach(field => {
      if (field.isId) {
        const maxId = this.collectionData.reduce((max, item) => Math.max(max, item[field.name] || 0), 0);
        newRow[field.name] = maxId + 1;
      } else {
        newRow[field.name] = this.getDefaultValueForField(field);
      }
    });
    
    // Add to the main collectionData array first
    this.collectionData.unshift(newRow); 
    this.dataService.updateData(this.collectionName, this.collectionData); // Update service
    
    // Re-apply filters. If the new row matches the current search term, it will appear.
    this.applyFiltersAndSearch(); 
    // Consider if a new row should always be visible, e.g. by clearing search or selecting it.
    // For now, it will only show if it matches active search.
  }

  private getDefaultValueForField(field: FieldSchema): any {
    switch (field.type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'date': return new Date().toISOString().split('T')[0]; // Default to today's date
      case 'array': return [];
      case 'object': return {};
      case 'enum': return field.enum?.[0] || null; // Default to first enum value or null
      default: return null;
    }
  }

  // --- Delete Selected Rows ---
  async deleteSelectedRows(): Promise<void> {
    if (this.selectedRows.size === 0) return;

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete ${this.selectedRows.size} selected row(s)? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: () => {
            this.performDelete(); // Call the separate delete logic
          }
        }
      ]
    });
    await alert.present();
  }

  private performDelete(): void {
    // Filter from the main collectionData list
    this.collectionData = this.collectionData.filter(row => !this.selectedRows.has(row));
    
    if (this.collectionName) {
        this.dataService.updateData(this.collectionName, this.collectionData); // Update service
    }
    
    this.selectedRows.clear(); // Clear selection
    this.applyFiltersAndSearch(); // Refresh the filtered list
  }
  
  // --- Data Persistence (Placeholder) ---
  // Call this method after add/delete to update the DataService
  // This is a simplified approach. A more robust solution would involve a "Save" button.
  private syncDataWithService(): void {
    if (this.collectionName) {
      this.dataService.updateData(this.collectionName, [...this.collectionData]); // Send a copy
    }
  }


  // Helper to get display value for foreign keys, if applicable
  getDisplayValue(item: any, column: ColumnDefinition): any {
    if (!this.collectionName) return item[column.key]; // Should not happen if loaded correctly
    const rawValue = item[column.key];
    if (column.foreignKey && rawValue !== null && rawValue !== undefined) {
      // Ensure dataService.getData returns a fresh array or handles non-existence gracefully
      const relatedCollection = this.dataService.getData(column.foreignKey.collectionName) || [];
      const relatedItem = relatedCollection.find(rItem => rItem[column.foreignKey!.valueField] === rawValue);
      return relatedItem ? relatedItem[column.foreignKey!.displayField] : `ID: ${rawValue} (FK Not Found)`;
    }
    return rawValue;
  }
}
