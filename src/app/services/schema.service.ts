import { Injectable } from '@angular/core';

// Represents a subset of JSON Schema Draft 7 for simplicity
// In a real app, you might use a more complete library or type definition.
export interface JsonSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: { [key: string]: JsonSchema };
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  enum?: any[];
  format?: 'date-time' | 'email' | 'hostname' | 'ipv4' | 'ipv6' | 'uri' | 'uuid';
  default?: any;
  // Add other JSON Schema keywords as needed: minimum, maximum, pattern, etc.
  // UI specific hints (not standard JSON schema, but can be useful)
  ui?: {
    label?: string;
    inputType?: string; // 'textarea', 'select', etc.
    order?: number; // For field ordering
    foreignKey?: {
        collectionName: string;
        valueField: string; // e.g., 'id'
        displayField: string; // e.g., 'name'
    };
  };
}


@Injectable({
  providedIn: 'root'
})
export class SchemaService {
  private schemas: Map<string, JsonSchema> = new Map();

  constructor() {
    this.loadInitialSchemas();
  }

  private loadInitialSchemas(): void {
    // Example: FullUserSchema (adapted slightly for direct embedding)
    const fullUserSchema: JsonSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "User",
      description: "A user object with comprehensive details",
      type: "object",
      properties: {
        id: { type: "number", description: "Unique identifier for the user", ui: { label: "User ID" } },
        username: { type: "string", description: "User's chosen username", ui: { label: "Username" } },
        email: { type: "string", format: "email", description: "User's email address", ui: { label: "Email Address" } },
        isActive: { type: "boolean", default: true, description: "Is the user account active?", ui: { label: "Active Status" } },
        registrationDate: { type: "string", format: "date-time", description: "Date and time of registration", ui: { label: "Registration Date" } },
        roles: {
          type: "array",
          description: "Roles assigned to the user",
          items: { type: "string", enum: ["admin", "editor", "viewer", "contributor"] },
          default: ["viewer"],
          ui: { label: "User Roles" }
        },
        profile: {
          type: "object",
          description: "User's profile information",
          ui: { label: "Profile" },
          properties: {
            firstName: { type: "string", ui: { label: "First Name" } },
            lastName: { type: "string", ui: { label: "Last Name" } },
            bio: { type: "string", ui: { inputType: "textarea", label: "Biography" } },
            avatarUrl: { type: "string", format: "uri", ui: { label: "Avatar URL" } }
          },
          required: ["firstName", "lastName"]
        },
        address: {
          type: "object",
          description: "User's primary address",
          ui: { label: "Address" },
          properties: {
            street: { type: "string", ui: { label: "Street Address" } },
            city: { type: "string", ui: { label: "City" } },
            zipCode: { type: "string", pattern: "^[0-9]{5}(?:-[0-9]{4})?$", ui: { label: "ZIP Code" } },
            country: { type: "string", ui: { label: "Country" } }
          },
          required: ["street", "city", "zipCode", "country"]
        },
        preferences: {
          type: "object",
          description: "User specific preferences",
          ui: { label: "Preferences" },
          properties: {
            newsletter: { type: "boolean", default: false, ui: { label: "Subscribe to Newsletter" } },
            theme: { type: "string", enum: ["light", "dark", "system"], default: "system", ui: { label: "Interface Theme" } }
          }
        },
        tags: {
          type: "array",
          description: "Descriptive tags for the user",
          items: { type: "string" },
          ui: { label: "Tags" }
        },
        lastLogin: { // Example of a potentially optional top-level field
            type: "object",
            properties: {
                ip: { type: "string", format: "ipv4"},
                timestamp: {type: "string", format: "date-time"}
            },
            required: ["timestamp"],
            ui: {label: "Last Login Details"}
        }
      },
      required: ["id", "username", "email", "registrationDate", "roles", "profile", "address"]
    };

    this.schemas.set('users', fullUserSchema); // Using 'users' as collectionName based on previous tasks

    // Example for a simple 'orders' schema
    const simpleOrderSchema: JsonSchema = {
        title: "Order",
        type: "object",
        properties: {
            orderId: { type: "string", format: "uuid", ui: {label: "Order ID"} },
            userId: { type: "number", description: "ID of the user who placed the order", ui: {label: "User ID", foreignKey: {collectionName: "users", valueField: "id", displayField: "username"}}},
            orderDate: { type: "string", format: "date-time", ui: {label: "Order Date"} },
            totalAmount: { type: "number", ui: {label: "Total Amount"} },
            status: { type: "string", enum: ["pending", "shipped", "delivered", "cancelled"], default: "pending", ui: {label: "Status"} }
        },
        required: ["orderId", "userId", "orderDate", "totalAmount", "status"]
    };
    this.schemas.set('orders', simpleOrderSchema);
  }

  getSchema(collectionName: string): JsonSchema | undefined {
    return this.schemas.get(collectionName);
  }

  getAllSchemaNames(): string[] {
    return Array.from(this.schemas.keys());
  }

  getCollectionProperties(collectionName: string): { [key: string]: JsonSchema } | undefined {
    const schema = this.schemas.get(collectionName);
    if (schema && schema.type === 'object' && schema.properties) {
      return schema.properties;
    }
    return undefined;
  }

  getFieldSchema(collectionName: string, fieldPath: string): JsonSchema | undefined {
    const schema = this.schemas.get(collectionName);
    if (!schema) return undefined;

    const pathParts = fieldPath.split('.');
    let currentSchemaPart: JsonSchema | undefined = schema;

    for (const part of pathParts) {
      if (currentSchemaPart && currentSchemaPart.type === 'object' && currentSchemaPart.properties && currentSchemaPart.properties[part]) {
        currentSchemaPart = currentSchemaPart.properties[part];
      } else if (currentSchemaPart && currentSchemaPart.type === 'array' && currentSchemaPart.items && !Array.isArray(currentSchemaPart.items)) {
        // This simplified logic assumes 'part' refers to a property of the items in the array,
        // rather than an index. e.g., 'myArray.itemProperty' not 'myArray[0].itemProperty'
        // To get the schema of items themselves, one might pass 'myArray.items'
        if (part === 'items') { 
             currentSchemaPart = currentSchemaPart.items as JsonSchema;
        } else if ( (currentSchemaPart.items as JsonSchema)?.type === 'object' && (currentSchemaPart.items as JsonSchema).properties?.[part]) {
             currentSchemaPart = (currentSchemaPart.items as JsonSchema).properties![part];
        } else {
          return undefined; // Path part not found within array items
        }
      } else {
        return undefined; // Path part not found or not an object/array
      }
    }
    return currentSchemaPart;
  }
}
