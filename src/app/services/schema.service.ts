import { Injectable } from '@angular/core';

export interface TableSchema {
  collectionName: string;
  displayName: string;
  fields: FieldSchema[];
}

export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  isId?: boolean;
  label?: string;
  foreignKey?: {
    collectionName: string;
    valueField: string;
    displayField: string;
  };
  enum?: string[];
  arrayType?: 'string' | 'number' | 'object';
  arrayItemSchema?: FieldSchema[]; // For array of objects
}

@Injectable({
  providedIn: 'root'
})
export class SchemaService {

  private fakeSchemas: TableSchema[] = [
    {
      collectionName: 'users',
      displayName: 'Users',
      fields: [
        { name: 'id', type: 'number', isId: true, label: 'User ID' },
        { name: 'name', type: 'string', label: 'Name' },
        { name: 'email', type: 'string', label: 'Email' },
        { name: 'isActive', type: 'boolean', label: 'Active' },
        { name: 'registrationDate', type: 'date', label: 'Registration Date' },
      ]
    },
    {
      collectionName: 'orders',
      displayName: 'Orders',
      fields: [
        { name: 'id', type: 'number', isId: true, label: 'Order ID' },
        { name: 'userId', type: 'number', label: 'User ID', foreignKey: { collectionName: 'users', valueField: 'id', displayField: 'name' } },
        { name: 'orderDate', type: 'date', label: 'Order Date' },
        { name: 'totalAmount', type: 'number', label: 'Total Amount' },
        { name: 'status', type: 'string', label: 'Status', enum: ['pending', 'shipped', 'delivered', 'cancelled'] },
      ]
    },
    {
      collectionName: 'products',
      displayName: 'Products',
      fields: [
        { name: 'id', type: 'number', isId: true, label: 'Product ID' },
        { name: 'name', type: 'string', label: 'Product Name' },
        { name: 'price', type: 'number', label: 'Price' },
        { name: 'stockQuantity', type: 'number', label: 'Stock Quantity' },
        {
          name: 'tags',
          type: 'array',
          label: 'Tags',
          arrayType: 'string'
        },
        {
          name: 'dimensions',
          type: 'object',
          label: 'Dimensions',
          arrayItemSchema: [ // Re-using arrayItemSchema here for object properties, might need a dedicated 'properties' field in FieldSchema
            { name: 'length', type: 'number', label: 'Length (cm)' },
            { name: 'width', type: 'number', label: 'Width (cm)' },
            { name: 'height', type: 'number', label: 'Height (cm)' },
          ]
        }
      ]
    }
  ];

  constructor() { }

  getSchemas(): TableSchema[] {
    return this.fakeSchemas;
  }

  getSchema(collectionName: string): TableSchema | undefined {
    return this.fakeSchemas.find(s => s.collectionName === collectionName);
  }
}
