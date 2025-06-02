import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AdvancedFilterModalComponent } from './advanced-filter-modal.component';

@NgModule({
  declarations: [AdvancedFilterModalComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  // Although it's a modal, it's good practice to export it if it were ever to be used directly in another component's template.
  // However, for dynamic creation via ModalController, it doesn't strictly need to be exported from its own module,
  // but the component itself needs to be in a module that's available to the page creating it.
  exports: [AdvancedFilterModalComponent] 
})
export class AdvancedFilterModalModule { }
