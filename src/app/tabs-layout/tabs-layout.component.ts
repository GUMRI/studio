import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular'; // Import ToastController
import { SchemaService, JsonSchema } from '../services/schema.service';
import { DataService, PendingChanges } from '../services/data.service'; // Import DataService and PendingChanges

interface TabInfo {
  name: string;
  label: string;
  icon?: string; // Optional icon name
}

@Component({
  selector: 'app-tabs-layout',
  templateUrl: './tabs-layout.component.html',
  styleUrls: ['./tabs-layout.component.scss'], // Assuming SCSS file will be created
  standalone: true,
  imports: [
    CommonModule,
    RouterModule, // For routerLink
    RouterOutlet, // For the child route's component
    IonicModule,  // For ion-tabs, ion-tab-bar, etc.
  ],
})
export class TabsLayoutComponent implements OnInit {
  public availableTabs: TabInfo[] = [];
  public hasPendingChanges: boolean = false; // To potentially show a badge or indicator

  constructor(
    private schemaService: SchemaService,
    private dataService: DataService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.loadTabs();
    // Periodically check for pending changes (simple example, could be event-driven)
    // For a more robust solution, DataService could emit an event when data is updated.
    // setInterval(() => this.checkForPendingChanges(), 5000); 
    // For now, we won't auto-check to avoid spamming getPendingChanges.
    // The button itself will trigger the check when clicked.
  }

  loadTabs(): void {
    const schemaNames = this.schemaService.getAllSchemaNames();
    this.availableTabs = schemaNames.map(name => {
      const schema = this.schemaService.getSchema(name);
      const label = schema?.title || name.charAt(0).toUpperCase() + name.slice(1);
      let icon = 'list-outline';
      if (name.toLowerCase().includes('user')) icon = 'people-outline';
      if (name.toLowerCase().includes('order')) icon = 'cart-outline';
      if (name.toLowerCase().includes('product')) icon = 'cube-outline';
      return { name, label, icon };
    });
  }

  // Optional: Method to check for pending changes for UI indication
  // checkForPendingChanges(): void {
  //   const changes = this.dataService.getPendingChanges();
  //   this.hasPendingChanges = changes.added.length > 0 || changes.deleted.length > 0 || changes.updated.length > 0;
  // }

  async saveAllChanges(): Promise<void> {
    const pendingChanges = this.dataService.getPendingChanges();
    const totalChanges = pendingChanges.added.reduce((sum, item) => sum + item.records.length, 0) +
                         pendingChanges.deleted.reduce((sum, item) => sum + item.records.length, 0) +
                         pendingChanges.updated.reduce((sum, item) => sum + item.records.length, 0);

    let message: string;
    let color: string;

    if (totalChanges > 0) {
      console.log('Pending Changes:', JSON.stringify(pendingChanges, null, 2));
      this.dataService.commitChanges();
      message = `Successfully "saved" ${totalChanges} change(s) across ${
                    new Set([...pendingChanges.added.map(p => p.collectionName), ...pendingChanges.deleted.map(p => p.collectionName), ...pendingChanges.updated.map(p => p.collectionName)]).size
                  } collection(s). Logged to console.`;
      color = 'success';
      // this.hasPendingChanges = false; // Reset indicator after saving
    } else {
      message = 'No pending changes to save.';
      color = 'medium';
    }

    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'top',
    });
    toast.present();
  }
}
