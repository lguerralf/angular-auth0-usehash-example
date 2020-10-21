import { Component } from '@angular/core';
import { LfxHeaderService } from './lfx-header.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'spa-angular';

  constructor(private lfxheader: LfxHeaderService) {}
}
