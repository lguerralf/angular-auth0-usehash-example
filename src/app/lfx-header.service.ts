/**
 * updated: 2020-10-21
 * v0.0.1
 * 
 */

import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class LfxHeaderService {

  constructor(private auth: AuthService) {
    this.setUserInLFxHeader();
  }

  setUserInLFxHeader(): void {
    const lfHeaderEl: any = document.getElementById('lfx-header');
    if (!lfHeaderEl) {
      return;
    }

    this.auth.userProfile$.subscribe((data) => {
      if (data) {
        lfHeaderEl.authuser = data;
      }
    });

  }
}
