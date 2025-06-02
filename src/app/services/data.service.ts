import { Injectable } from '@angular/core';
import { SchemaService } from './schema.service'; // Assuming SchemaService can provide ID field names

interface PendingChanges {
  added: { collectionName: string, records: any[] }[];
  deleted: { collectionName: string, records: any[] }[];
  updated: { collectionName: string, records: any[] }[];
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  // Stores the current live data
  private liveData: Map<string, any[]> = new Map();
  // Stores a deep copy of the data as it was when first loaded or last saved
  private initialDataState: Map<string, any[]> = new Map();

  // Initial hardcoded data (can be loaded from a file or API in a real app)
  private seedData: { [collectionName: string]: any[] } = {
    users: [
      { id: 1, name: 'Alice Wonderland', email: 'alice@example.com', isActive: true, registrationDate: '2023-01-15' },
      { id: 2, name: 'Bob The Builder', email: 'bob@example.com', isActive: false, registrationDate: '2022-07-20' },
      { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', isActive: true, registrationDate: '2023-03-10' },
    ],
    orders: [
      { id: 101, userId: 1, orderDate: '2023-02-20', totalAmount: 150.00, status: 'delivered' },
      { id: 102, userId: 2, orderDate: '2023-03-01', totalAmount: 75.50, status: 'shipped' },
      { id: 103, userId: 1, orderDate: '2023-03-05', totalAmount: 220.25, status: 'pending' },
      { id: 104, userId: 3, orderDate: '2023-04-10', totalAmount: 99.99, status: 'shipped' },
    ],
    products: [
      { id: 201, name: 'Laptop Pro', price: 1200.00, stockQuantity: 50, tags: ['electronics', 'computer'], dimensions: { length: 35, width: 25, height: 2.5 } },
      { id: 202, name: 'Wireless Mouse', price: 25.00, stockQuantity: 200, tags: ['electronics', 'accessory'], dimensions: { length: 10, width: 6, height: 3 } },
      { id: 203, name: 'Coffee Maker', price: 70.00, stockQuantity: 75, tags: ['kitchen', 'appliance'], dimensions: { length: 20, width: 15, height: 30 } },
    ]
  };

  constructor(private schemaService: SchemaService) {
    // Initialize liveData and initialDataState with seed data
    Object.keys(this.seedData).forEach(collectionName => {
      const data = JSON.parse(JSON.stringify(this.seedData[collectionName])); // Deep copy
      this.liveData.set(collectionName, data);
      this.initialDataState.set(collectionName, JSON.parse(JSON.stringify(data))); // Another deep copy for initial state
    });
  }

  private getCollectionIdField(collectionName: string): string | undefined {
    const schema = this.schemaService.getSchema(collectionName);
    const idField = schema?.fields.find(f => f.isId);
    return idField?.name;
  }

  getData(collectionName: string): any[] {
    if (!this.liveData.has(collectionName)) {
      // If data for this collection wasn't pre-seeded, initialize it.
      // This could also be a point to fetch from a backend if not already done.
      const dataFromSeed = this.seedData[collectionName] ? JSON.parse(JSON.stringify(this.seedData[collectionName])) : [];
      this.liveData.set(collectionName, dataFromSeed);
      this.initialDataState.set(collectionName, JSON.parse(JSON.stringify(dataFromSeed)));
    }
    // Return a copy to prevent direct modification of the service's internal array by components
    // This was a previous note, but for add/delete, the component directly modifies its copy and calls updateData.
    // For now, returning the direct reference and relying on updateData to manage state.
    return this.liveData.get(collectionName) || [];
  }

  updateData(collectionName: string, newData: any[]): void {
    // This method is called by components after they modify their local copy of data (e.g., add/delete)
    // It replaces the entire dataset for the collection in liveData.
    this.liveData.set(collectionName, [...newData]); // Store a copy of the new data
    console.log(`Live data for ${collectionName} updated. Current items: ${newData.length}`);
  }

  getPendingChanges(): PendingChanges {
    const changes: PendingChanges = { added: [], deleted: [], updated: [] };

    this.liveData.forEach((currentItems, collectionName) => {
      const initialItems = this.initialDataState.get(collectionName) || [];
      const idField = this.getCollectionIdField(collectionName) || 'id'; // Default to 'id' if no schema

      const currentIds = new Set(currentItems.map(item => item[idField]));
      const initialIds = new Set(initialItems.map(item => item[idField]));

      // Added: In current but not in initial
      const addedRecords = currentItems.filter(item => !initialIds.has(item[idField]));
      if (addedRecords.length > 0) {
        changes.added.push({ collectionName, records: addedRecords });
      }

      // Deleted: In initial but not in current
      const deletedRecords = initialItems.filter(item => !currentIds.has(item[idField]));
      if (deletedRecords.length > 0) {
        changes.deleted.push({ collectionName, records: deletedRecords });
      }

      // Updated: In both but different (simple JSON stringify comparison for objects)
      const updatedRecords: any[] = [];
      currentItems.forEach(currentItem => {
        if (initialIds.has(currentItem[idField])) { // Exists in both
          const initialItem = initialItems.find(item => item[idField] === currentItem[idField]);
          // Simple deep comparison. For complex objects or performance, a more robust diff is needed.
          if (JSON.stringify(currentItem) !== JSON.stringify(initialItem)) {
            updatedRecords.push(currentItem); // Report the current state of the updated item
          }
        }
      });
      if (updatedRecords.length > 0) {
        changes.updated.push({ collectionName, records: updatedRecords });
      }
    });

    return changes;
  }

  commitChanges(): void {
    this.initialDataState = new Map(); // Clear old initial state
    this.liveData.forEach((data, collectionName) => {
      // Update initialDataState to match the current liveData (deep copy)
      this.initialDataState.set(collectionName, JSON.parse(JSON.stringify(data)));
    });
    console.log('Changes committed. Initial data state updated to current live data.');
  }

  // Optional: Add methods for more granular CRUD if needed later,
  // which would directly update liveData and allow more precise change tracking.
  // e.g., addItemToCollection, updateItemInCollection, deleteItemFromCollection
}
