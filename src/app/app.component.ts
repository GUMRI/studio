import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular'; // IonicModule includes IonApp, IonRouterOutlet
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'], // Assuming an app.component.scss might exist or be created
  standalone: true,
  imports: [
    IonicModule, // Provides IonApp, IonRouterOutlet among others
    RouterOutlet,
  ],
})
export class AppComponent {
  constructor() {}
}
