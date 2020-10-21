import { Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss'],
})
export class NavBarComponent implements OnInit {
  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit(): void { }

  loginAndBackToPreviousPage() {
    const redirectPath = this.router.url;
    this.auth.login(redirectPath);
  }
}
