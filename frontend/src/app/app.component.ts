import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root component. Deliberately empty: every portal's chrome lives in
 * AppShellComponent (shared/ui/app-shell), which the routes mount per portal.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
