import { Component, OnInit } from '@angular/core';
import { SchemaService, TableSchema } from '../services/schema.service';
import { DataService } from '../services/data.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-tabs-page',
  templateUrl: './tabs-page.component.html',
  styleUrls: ['./tabs-page.component.scss'],
})
export class TabsPageComponent implements OnInit {
  public availableSchemas: TableSchema[] = [];

  constructor(
    private schemaService: SchemaService,
    private dataService: DataService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.availableSchemas = this.schemaService.getSchemas();
  }

  async saveAllChanges(): Promise<void> {
    const pendingChanges = this.dataService.getPendingChanges();
    
    console.log('Pending Changes:', pendingChanges);
    // Here, you would typically send these changes to a backend API.
    // For this task, we're just logging them and then committing locally.

    this.dataService.commitChanges();

    const toast = await this.toastController.create({
      message: 'Changes "saved" to console and local state committed.',
      duration: 3000,
      color: 'success',
      position: 'top'
    });
    toast.present();

    // You might want to add more detailed feedback based on pendingChanges content
    if (pendingChanges.added.length === 0 && pendingChanges.deleted.length === 0 && pendingChanges.updated.length === 0) {
      const noChangesToast = await this.toastController.create({
        message: 'No pending changes to save.',
        duration: 2000,
        color: 'medium',
        position: 'top'
      });
      noChangesToast.present();
    }
  }
}
