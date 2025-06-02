import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPageComponent } from './tabs-page.component';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPageComponent,
    children: [
      {
        path: ':collectionName', // e.g., /tabs/users, /tabs/orders
        // Assuming CollectionTabPage will be responsible for displaying the data
        // and will be part of a lazy-loaded module CollectionTabPageModule
        loadChildren: () => import('../collection-tab/collection-tab.module').then(m => m.CollectionTabPageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/users', // Default to the first collection or a specific one
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/users', // Default route for the app
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsPageRoutingModule {}
