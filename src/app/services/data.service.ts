import { Injectable } from '@angular/core';
import { SchemaService, JsonSchema } from './schema.service';
import { faker } from '@faker-js/faker';

export interface PendingChangeItem { // Exporting for potential use elsewhere, e.g. in a summary view
  collectionName: string;
  records: any[];
}
export interface PendingChanges {
  added: PendingChangeItem[];
  deleted: PendingChangeItem[];
  updated: PendingChangeItem[];
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private collectionsData: Map<string, any[]> = new Map();
  private initialDataState: Map<string, any[]> = new Map();


  constructor(private schemaService: SchemaService) {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    const schemaNames = this.schemaService.getAllSchemaNames();
    schemaNames.forEach(name => {
      const schema = this.schemaService.getSchema(name);
      if (schema) {
        // Generate between 3 and 7 records for each collection
        const mockData = Array.from({ length: faker.number.int({ min:3, max: 7 }) }, () => this.generateMockRecord(schema));
        this.collectionsData.set(name, mockData);
        // Deep copy for initial state using JSON stringify/parse
        this.initialDataState.set(name, JSON.parse(JSON.stringify(mockData)));
      }
    });
  }

  private generateMockRecord(schema: JsonSchema, currentPath: string = ''): any {
    if (!schema || schema.type !== 'object' || !schema.properties) {
      return this.generatePrimitiveValue(schema); // Fallback for non-object or schemaless parts
    }
  
    const record: { [key: string]: any } = {};
    const properties = schema.properties;
  
    Object.keys(properties).forEach(key => {
      const fieldSchema = properties[key];
      const isRequired = schema.required?.includes(key);
  
      if (!isRequired && Math.random() < 0.3) { // 30% chance to skip non-required fields
        return; 
      }
      record[key] = this.generateFieldValue(fieldSchema, `${currentPath}${key}`);
    });
  
    if (schema.required) {
      schema.required.forEach(requiredKey => {
        if (record[requiredKey] === undefined && properties[requiredKey]) { // Ensure property exists in schema
          record[requiredKey] = this.generateFieldValue(properties[requiredKey], `${currentPath}${requiredKey}`);
        }
      });
    }
    return record;
  }
  
  private generateFieldValue(fieldSchema: JsonSchema, fieldPath: string): any {
    if (fieldSchema.default !== undefined) {
      return JSON.parse(JSON.stringify(fieldSchema.default));
    }
    if (fieldSchema.enum && fieldSchema.enum.length > 0) {
      return faker.helpers.arrayElement(fieldSchema.enum);
    }
  
    if (fieldSchema.format) {
      switch (fieldSchema.format) {
        case 'email': return faker.internet.email();
        case 'date-time': return faker.date.recent({days: 30}).toISOString();
        case 'uri': return faker.internet.url();
        case 'uuid': return faker.string.uuid();
        case 'ipv4': return faker.internet.ip();
      }
    }
  
    switch (fieldSchema.type) {
      case 'string':
        const lcPath = fieldPath.toLowerCase();
        if (lcPath.includes('firstname')) return faker.person.firstName();
        if (lcPath.includes('lastname')) return faker.person.lastName();
        if (lcPath.includes('name')) return faker.person.fullName(); // General name if not first/last
        if (lcPath.includes('username')) return faker.internet.userName();
        if (lcPath.includes('city')) return faker.location.city();
        if (lcPath.includes('street')) return faker.location.streetAddress();
        if (lcPath.includes('country')) return faker.location.country();
        if (lcPath.includes('zipcode') || lcPath.includes('zipCode')) return faker.location.zipCode();
        if (lcPath.includes('bio')) return faker.lorem.paragraph();
        if (lcPath.includes('avatar')) return faker.image.avatar();
        return faker.lorem.words(faker.number.int({min:1, max:5}));
      case 'number':
        // Consider schema min/max if available, and if it's an ID for foreign key
        const isForeignKey = fieldSchema.ui?.foreignKey; // Check UI hint for foreign key
        return faker.number.int({ min: (isForeignKey ? 1 : 0), max: (isForeignKey ? 10 : 1000) }); // Smaller range for FK IDs assuming fewer related items
      case 'boolean':
        return faker.datatype.boolean();
      case 'object':
        return this.generateMockRecord(fieldSchema, `${fieldPath}.`);
      case 'array':
        const arrayLength = faker.number.int({ min: 1, max: 3 });
        if (fieldSchema.items && !Array.isArray(fieldSchema.items)) {
          return Array.from({ length: arrayLength }, () => this.generateFieldValue(fieldSchema.items as JsonSchema, `${fieldPath}.items`));
        }
        return []; 
      default:
        return undefined;
    }
  }
  
  private generatePrimitiveValue(schema: JsonSchema): any {
    if (schema.default !== undefined) return schema.default;
    if (schema.enum && schema.enum.length > 0) return faker.helpers.arrayElement(schema.enum);
    switch (schema.type) {
      case 'string': return faker.lorem.word();
      case 'number': return faker.number.int({max:100});
      case 'boolean': return faker.datatype.boolean();
      default: return undefined;
    }
  }

  getData(collectionName: string): any[] {
    return this.collectionsData.get(collectionName) || [];
  }

  updateData(collectionName: string, newData: any[]): void {
    this.collectionsData.set(collectionName, [...newData]);
  }

  getNewRecordScaffold(collectionName: string): any | undefined {
    const schema = this.schemaService.getSchema(collectionName);
    if (!schema || schema.type !== 'object' || !schema.properties) {
      return undefined;
    }
    return this.generateScaffoldFromProperties(schema.properties);
  }

  private generateScaffoldFromProperties(properties: {[key: string]: JsonSchema}): any {
    const scaffold: {[key: string]: any} = {};
    Object.keys(properties).forEach(key => {
      const fieldSchema = properties[key];
      if (fieldSchema.default !== undefined) {
        scaffold[key] = JSON.parse(JSON.stringify(fieldSchema.default));
      } else if (fieldSchema.type === 'array') {
        scaffold[key] = [];
      } else if (fieldSchema.type === 'object' && fieldSchema.properties) {
        scaffold[key] = this.generateScaffoldFromProperties(fieldSchema.properties);
      } else {
        scaffold[key] = undefined; // Or null, depending on desired default for empty fields
      }
    });
    return scaffold;
  }

  getPendingChanges(): PendingChanges {
    const changes: PendingChanges = { added: [], deleted: [], updated: [] };

    this.collectionsData.forEach((currentItems, collectionName) => {
      const initialItems = this.initialDataState.get(collectionName) || [];
      const idField = this.getCollectionIdField(collectionName);

      if (!idField) {
        console.warn(`No ID field determined for collection ${collectionName}. Change tracking may be inaccurate.`);
        // Handle collections without a clear ID field: treat all current as added, all initial as deleted if counts differ.
        // Or simply skip them for pending changes. For now, we'll rely on an ID field.
        return;
      }

      const currentItemMap = new Map(currentItems.map(item => [item[idField], item]));
      const initialItemMap = new Map(initialItems.map(item => [item[idField], item]));

      const addedRecords = currentItems.filter(item => !initialItemMap.has(item[idField]));
      if (addedRecords.length > 0) {
        changes.added.push({ collectionName, records: addedRecords });
      }

      const deletedRecords = initialItems.filter(item => !currentItemMap.has(item[idField]));
      if (deletedRecords.length > 0) {
        changes.deleted.push({ collectionName, records: deletedRecords });
      }
      
      const updatedRecords: any[] = [];
      currentItemMap.forEach((currentItem, id) => {
        if (initialItemMap.has(id)) { 
          const initialItem = initialItemMap.get(id);
          if (JSON.stringify(currentItem) !== JSON.stringify(initialItem)) {
            updatedRecords.push(currentItem); 
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
    this.initialDataState = new Map(); 
    this.collectionsData.forEach((data, collectionName) => {
      this.initialDataState.set(collectionName, JSON.parse(JSON.stringify(data)));
    });
    // console.log('Changes committed. Initial data state updated.');
  }

  /**
   * Determines the ID field for a collection based on its schema.
   * Prioritizes 'id', then fields ending with 'Id' (case-insensitive),
   * then looks for a field with format 'uuid'.
   * As a last resort, uses the first property in the schema.
   */
  private getCollectionIdField(collectionName: string): string | undefined {
    const schema = this.schemaService.getSchema(collectionName);
    if (!schema || schema.type !== 'object' || !schema.properties) {
        return undefined;
    }
    const properties = schema.properties;
    const propKeys = Object.keys(properties);

    if (properties['id']) return 'id'; // Standard 'id' field

    for (const key of propKeys) { // Fields like 'userId', 'orderId'
        if (key.toLowerCase().endsWith('id')) return key;
    }
    for (const key of propKeys) { // Fields with UUID format
        if (properties[key].format === 'uuid') return key;
    }
    
    return propKeys.length > 0 ? propKeys[0] : undefined; // Fallback to the first property
  }
}
