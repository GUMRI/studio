import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, AlertController } from '@ionic/angular'; // Import AlertController
import { SchemaService, JsonSchema } from '../services/schema.service';
import { DataService } from '../services/data.service';
import { SmartTableComponent } from '../shared/smart-table/smart-table.component';

@Component({
  selector: 'app-collection-page',
  templateUrl: './collection-page.component.html',
  styleUrls: ['./collection-page.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    SmartTableComponent, // Add SmartTableComponent to imports
  ],
})
export class CollectionPageComponent implements OnInit, OnChanges {
  @Input() collectionName: string | null = null; // Bound from route parameter

  currentSchema: JsonSchema | null = null;
  currentData: any[] = []; // Original data from DataService
  displayedData: any[] = [];
  currentSelectedRows: Set<any> = new Set();
  
  searchTerm: string = '';
  advancedFilterConditions: FilterCondition[] = []; // Define FilterCondition if not already globally available

  constructor(
    private schemaService: SchemaService,
    private dataService: DataService,
    private activatedRoute: ActivatedRoute,
    private alertController: AlertController,
    private modalController: ModalController // Inject ModalController
  ) {}

  ngOnInit() {
    // Initial load based on @Input collectionName (if available)
    // This will be set by the router if withComponentInputBinding is active
    if (this.collectionName) {
      this.loadCollectionDetails();
    } else {
      // Fallback or if component is loaded not via route that sets collectionName input
      const nameFromRoute = this.activatedRoute.snapshot.paramMap.get('collectionName');
      if (nameFromRoute) {
        this.collectionName = nameFromRoute;
        this.loadCollectionDetails();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // React if collectionName input binding changes
    if (changes['collectionName'] && changes['collectionName'].currentValue) {
      this.loadCollectionDetails();
    }
  }

  private loadCollectionDetails(): void {
    if (this.collectionName) {
      this.currentSchema = this.schemaService.getSchema(this.collectionName) || null;
      this.currentData = this.dataService.getData(this.collectionName) || [];
    } else {
      this.currentSchema = null;
      this.currentData = [];
    }
    this.applyAllFilters(); // Apply filters whenever data or schema changes
  }

  // Getter for template
  get currentCollectionNameForDisplay(): string | null {
    return this.collectionName;
  }

  // --- Search and Filter Logic ---
  onSearchTermChanged(term: string | null | undefined): void {
    this.searchTerm = term || '';
    this.applyAllFilters();
  }

  applyAllFilters(): void {
    let result = [...this.currentData];

    // 1. Apply Advanced Filters (Phase 2)
    if (this.advancedFilterConditions.length > 0) {
      result = result.filter(item => {
        return this.advancedFilterConditions.every(filter => {
          // Access nested properties using fieldPath
          const itemValue = this.getValueFromPath(item, filter.fieldPath);
          
          // Ensure filter.value and filter.value2 are correctly typed based on filter.fieldSchema
          let filterValue = this.coerceFilterValue(filter.value, filter.fieldSchema);
          let filterValue2 = this.coerceFilterValue(filter.value2, filter.fieldSchema);
          let itemFieldForComparison = this.coerceItemValue(itemValue, filter.fieldSchema);

          switch (filter.operator) {
            case 'equals': return itemFieldForComparison == filterValue;
            case 'notEquals': return itemFieldForComparison != filterValue;
            case 'contains': return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
            case 'doesNotContain': return !String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
            case 'startsWith': return String(itemValue).toLowerCase().startsWith(String(filterValue).toLowerCase());
            case 'endsWith': return String(itemValue).toLowerCase().endsWith(String(filterValue).toLowerCase());
            case 'greaterThan': return itemFieldForComparison > filterValue;
            case 'lessThan': return itemFieldForComparison < filterValue;
            case 'greaterThanOrEquals': return itemFieldForComparison >= filterValue;
            case 'lessThanOrEquals': return itemFieldForComparison <= filterValue;
            case 'between': return itemFieldForComparison >= filterValue && itemFieldForComparison <= filterValue2;
            case 'isNull': return itemValue === null || itemValue === undefined;
            case 'isNotNull': return itemValue !== null && itemValue !== undefined;
            case 'isEmpty': 
              return Array.isArray(itemValue) ? itemValue.length === 0 : (String(itemValue).trim() === '');
            case 'isNotEmpty':
              return Array.isArray(itemValue) ? itemValue.length > 0 : (String(itemValue).trim() !== '');
            // 'in' and 'notIn' might require filterValue to be an array (e.g., from comma-separated string)
            // case 'in': 
            //   const listIn = String(filterValue).split(',').map(v => v.trim());
            //   return listIn.includes(String(itemValue));
            // case 'notIn':
            //   const listNotIn = String(filterValue).split(',').map(v => v.trim());
            //   return !listNotIn.includes(String(itemValue));
            default: return true;
          }
        });
      });
    }

    // 2. Apply Smart Search (Phase 1 - applied to result of advanced filters)
    if (this.searchTerm.trim() !== '') {
      const lowerSearchTerm = this.searchTerm.toLowerCase().trim();
      if (this.currentSchema && this.currentSchema.properties) {
        result = result.filter(item => 
          this.itemMatchesSearchTerm(item, this.currentSchema!, lowerSearchTerm)
        );
      }
    }

    this.displayedData = result;
    this.currentSelectedRows = new Set(); // Clear selection as displayed data has changed
  }

  private itemMatchesSearchTerm(item: any, schema: JsonSchema, lowerSearchTerm: string): boolean {
    if (item === null || item === undefined) return false;

    // Iterate over schema properties to decide how to search
    for (const key in schema.properties) {
      if (Object.prototype.hasOwnProperty.call(item, key)) { // Check if item actually has the property
        const value = item[key];
        const fieldSchema = schema.properties[key];

        if (value === null || value === undefined) continue;

        switch (fieldSchema.type) {
          case 'string':
            if (String(value).toLowerCase().includes(lowerSearchTerm)) return true;
            break;
          case 'number':
          case 'boolean':
            if (String(value).toLowerCase().includes(lowerSearchTerm)) return true;
            break;
          case 'array':
            // Simple search for arrays of strings/numbers
            if (fieldSchema.items && (fieldSchema.items as JsonSchema).type &&
               ['string', 'number'].includes((fieldSchema.items as JsonSchema).type as string) && Array.isArray(value)) {
              if (value.join(' ').toLowerCase().includes(lowerSearchTerm)) return true;
            }
            // For arrays of objects, this basic search won't dive deep. Could stringify or recurse.
            break;
          case 'object':
            // Recursive search for nested objects (1 level deep for simplicity here)
            if (fieldSchema.properties) {
              if (this.itemMatchesSearchTerm(value, fieldSchema, lowerSearchTerm)) return true;
            }
            break;
        }
      }
    }
    return false;
  }

  private getValueFromPath(item: any, path: string): any {
    if (!path) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== 'undefined') ? o[k] : undefined, item);
  }
  
  private coerceFilterValue(value: any, fieldSchema?: JsonSchema): any {
    if (value === undefined || value === null || !fieldSchema) return value;
    
    switch (fieldSchema.type) {
      case 'number': return parseFloat(value);
      case 'boolean': return String(value).toLowerCase() === 'true' || value === true;
      case 'date': // Assuming date values from filter are already in a comparable format (e.g., ISO string or timestamp)
                  // Or convert to a consistent format for comparison if needed.
                  // For 'between', this might need pre-processing if inputs are just date strings.
                  // For simplicity, if filter.value is a string from ion-datetime, it's ISO 8601.
                  // If comparing with item values that are also ISO 8601, string comparison might work for date part.
                  // For true date/time comparison, convert both to Date objects or timestamps.
        return value; // No coercion here, assuming input is already appropriate or handled by comparison logic
      default: return String(value); // Default to string for other types or if unsure
    }
  }
   private coerceItemValue(value: any, fieldSchema?: JsonSchema): any {
    if (value === undefined || value === null || !fieldSchema) return value;
    // If field is a date, convert to a comparable format if not already (e.g. timestamp or ISO string)
    if (fieldSchema.type === 'date' || fieldSchema.format === 'date-time') {
        // This assumes item value might need conversion for consistent comparison
        // For example, if item values are Date objects, convert to ISO string or timestamp
        // return new Date(value).toISOString(); // Or .getTime()
    }
    return value; // No specific coercion for item value here, assuming it's mostly fine
                  // Or apply similar coercions as filterValue if direct comparison issues arise
  }


  // --- Advanced Filter Modal ---
  async openAdvancedFilterModal(): Promise<void> {
    if (!this.currentSchema) return;

    const modal = await this.modalController.create({
      component: AdvancedFilterModalComponent,
      componentProps: {
        schema: this.currentSchema, // Pass the full schema
        appliedFilters: JSON.parse(JSON.stringify(this.advancedFilterConditions)) // Deep copy
      }
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role === 'apply' && data) {
      this.advancedFilterConditions = data;
      this.applyAllFilters();
    }
  }


  // --- Data Operation Handlers ---

  handleSelectedRowsChange(newSelection: Set<any>): void {
    this.currentSelectedRows = newSelection;
  }

  addNewRow(): void {
    if (!this.collectionName) return;
    const newRecordScaffold = this.dataService.getNewRecordScaffold(this.collectionName);

    if (newRecordScaffold) {
      const idFieldInfo = this.getIdFieldInfo(); // Helper to get ID field details
      if (idFieldInfo && idFieldInfo.type === 'number') {
        const maxId = this.currentData.reduce((max, item) => Math.max(max, item[idFieldInfo.name] || 0), 0);
        newRecordScaffold[idFieldInfo.name] = maxId + 1;
      } else if (idFieldInfo && idFieldInfo.type === 'string' && idFieldInfo.format === 'uuid') {
        // Assuming DataService or a utility would generate UUID if needed.
        // newRecordScaffold[idFieldInfo.name] = generateUUID(); 
      }

      this.currentData = [newRecordScaffold, ...this.currentData];
      this.dataService.updateData(this.collectionName, this.currentData);
      this.applyAllFilters(); // Refresh displayedData
      // Consider selecting the new row or clearing search to make it visible
    } else {
      console.warn('Could not generate new record scaffold for', this.collectionName);
    }
  }

  private getIdFieldInfo(): { name: string, type: JsonSchema['type'], format?: JsonSchema['format'] } | null {
    if (!this.collectionName || !this.currentSchema || !this.currentSchema.properties) return null;
    
    // Try common ID names first
    const commonIdNames = ['id', '_id'];
    for (const idName of commonIdNames) {
        if (this.currentSchema.properties[idName]) {
            return { name: idName, type: this.currentSchema.properties[idName].type, format: this.currentSchema.properties[idName].format };
        }
    }
    // Fallback: find first field that looks like an ID or is a UUID
    for (const key in this.currentSchema.properties) {
        if (key.toLowerCase().endsWith('id') || this.currentSchema.properties[key].format === 'uuid') {
            return { name: key, type: this.currentSchema.properties[key].type, format: this.currentSchema.properties[key].format };
        }
    }
    return null; // No clear ID field found
  }


  async deleteSelectedRows(): Promise<void> {
    if (this.currentSelectedRows.size === 0) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete ${this.currentSelectedRows.size} selected row(s)? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          handler: () => {
            this.performDelete();
          },
        },
      ],
    });
    await alert.present();
  }

  private performDelete(): void {
    if (!this.collectionName) return;

    this.currentData = this.currentData.filter(item => !this.currentSelectedRows.has(item));
    this.dataService.updateData(this.collectionName, this.currentData);
    this.currentSelectedRows = new Set(); // Clear selection
  }
}
