import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./tabs-layout/tabs-layout.component').then(m => m.TabsLayoutComponent),
    children: [
      {
        path: ':collectionName', // e.g., 'users', 'orders'
        loadComponent: () => import('./collection-page/collection-page.component').then(m => m.CollectionPageComponent)
      },
      {
        path: '',
        redirectTo: 'users', // Default to 'users' collection or the first available
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/users', // Default route for the entire app
    pathMatch: 'full'
  },
  {
    path: '**', // Wildcard route for a 404 page or redirect
    redirectTo: '/tabs/users', // Or a dedicated 404 component
    pathMatch: 'full'
  }
];
