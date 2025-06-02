import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { FieldSchema } from '../../services/schema.service';
import { FilterCondition, FilterOperator } from '../../interfaces/filter-condition.interface';

@Component({
  selector: 'app-advanced-filter-modal',
  templateUrl: './advanced-filter-modal.component.html',
  styleUrls: ['./advanced-filter-modal.component.scss'],
})
export class AdvancedFilterModalComponent implements OnInit {
  @Input() fields: FieldSchema[] = [];
  @Input() appliedFilters: FilterCondition[] = [];

  currentFilters: FilterCondition[] = [];

  // Define available operators for each field type
  operatorsByType: { [key in FieldSchema['type']]: FilterOperator[] } = {
    string: ['equals', 'notEquals', 'contains', 'doesNotContain', 'startsWith', 'endsWith', 'isNull', 'isNotNull', 'in', 'notIn'],
    number: ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'between', 'isNull', 'isNotNull'],
    boolean: ['equals', 'notEquals', 'isNull', 'isNotNull'],
    date: ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'between', 'isNull', 'isNotNull'],
    enum: ['equals', 'notEquals', 'isNull', 'isNotNull', 'in', 'notIn'],
    object: [], // Not supporting direct filtering on objects for now
    array: ['contains', 'doesNotContain', 'isNull', 'isNotNull'], // 'contains' for simple arrays of string/number
  };

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    // Deep copy applied filters to currentFilters to avoid modifying the original array directly
    this.currentFilters = JSON.parse(JSON.stringify(this.appliedFilters));
    if (this.currentFilters.length === 0) {
      this.addFilter(); // Start with one empty filter if none are applied
    }
  }

  addFilter(): void {
    const defaultField = this.fields[0];
    if (!defaultField) return; // No fields available

    this.currentFilters.push({
      id: Date.now().toString() + Math.random().toString(36).substring(2), // Simple unique ID
      field: defaultField.name,
      fieldType: defaultField.type,
      operator: this.getOperatorsForField(defaultField)[0],
      value: undefined,
      value2: undefined,
    });
  }

  removeFilter(index: number): void {
    this.currentFilters.splice(index, 1);
  }

  onFieldChange(filter: FilterCondition, fieldName: string): void {
    const selectedField = this.fields.find(f => f.name === fieldName);
    if (selectedField) {
      filter.field = selectedField.name;
      filter.fieldType = selectedField.type;
      filter.operator = this.getOperatorsForField(selectedField)[0]; // Reset operator
      filter.value = undefined; // Reset values
      filter.value2 = undefined;
    }
  }

  getOperatorsForField(field: FieldSchema | undefined): FilterOperator[] {
    if (!field) return [];
    return this.operatorsByType[field.type] || [];
  }

  getOperatorsForFilterCondition(filter: FilterCondition): FilterOperator[] {
    const fieldSchema = this.fields.find(f => f.name === filter.field);
    return this.getOperatorsForField(fieldSchema);
  }

  isOperatorUnary(operator: FilterOperator): boolean {
    return ['isNull', 'isNotNull'].includes(operator);
  }

  isOperatorBinary(operator: FilterOperator): boolean {
    return !this.isOperatorUnary(operator) && operator !== 'between';
  }

  isOperatorTernary(operator: FilterOperator): boolean { // 'between'
    return operator === 'between';
  }

  dismissModal(apply: boolean): void {
    if (apply) {
      // Optional: Validate filters before dismissing
      const validFilters = this.currentFilters.filter(f => f.field && f.operator && (!this.isOperatorBinary(f.operator) || f.value !== undefined || this.isOperatorUnary(f.operator)));
      this.modalCtrl.dismiss(validFilters, 'apply');
    } else {
      this.modalCtrl.dismiss(null, 'cancel');
    }
  }

  // Helper for trackBy in ngFor for performance
  trackByFilterId(index: number, filter: FilterCondition): string {
    return filter.id;
  }
}
