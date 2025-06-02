import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { CollectionTabPageComponent } from './collection-tab-page.component';
import { AdvancedFilterModalModule } from '../shared/advanced-filter-modal/advanced-filter-modal.module'; // Import the modal module

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: CollectionTabPageComponent }]),
    AdvancedFilterModalModule // Add AdvancedFilterModalModule here
  ],
  declarations: [CollectionTabPageComponent],
})
export class CollectionTabPageModule {}
