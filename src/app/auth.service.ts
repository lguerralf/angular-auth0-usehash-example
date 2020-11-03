/**
 * updated: 2020-11-02
 * v0.0.7
 *
 * Last Update:
 *  Using auth0 from CDN instead of npm module
 *  please review index.html
 */

declare let window;

import { Injectable } from '@angular/core';
import {
  from,
  of,
  Observable,
  BehaviorSubject,
  combineLatest,
  throwError,
} from 'rxjs';
import { tap, catchError, concatMap, shareReplay } from 'rxjs/operators';
import { Router } from '@angular/router';
import * as querystring from 'query-string';
import Url from 'url-parse';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  auth0Options = {
    domain: 'linuxfoundation-dev.auth0.com',
    clientId: 'O8sQ4Jbr3At8buVR3IkrTRlejPZFWenI',
    callbackUrl: window.location.origin,
    logoutUrl: window.location.origin,
    // https://auth0.com/docs/libraries/auth0-single-page-app-sdk#get-access-token-with-no-interaction
    // If you active useRefreshTokens: true , please update lfx-header directly too in index.html
     // *info make sure of using `userefreshtoken="true"` in  <lfx-header> element
    useRefreshTokens: true,
  };

  currentHref = window.location.href;

  loading$ = new BehaviorSubject<any>(true);
  // Create an observable of Auth0 instance of client
  auth0Client$ = (from(
    window.createAuth0Client({
      domain: this.auth0Options.domain,
      client_id: this.auth0Options.clientId,
      redirect_uri: this.auth0Options.callbackUrl,
      useRefreshTokens: this.auth0Options.useRefreshTokens
    })
  ) as Observable<any>).pipe(
    shareReplay(1), // Every subscription receives the same shared value
    catchError((err) => {
      this.loading$.next(false);
      return throwError(err);
    })
  );
  // Define observables for SDK methods that return promises by default
  // For each Auth0 SDK method, first ensure the client instance is ready
  // concatMap: Using the client instance, call SDK method; SDK returns a promise
  // from: Convert that resulting promise into an observable
  isAuthenticated$ = this.auth0Client$.pipe(
    concatMap((client: any) => from(client.isAuthenticated())),
    tap((res: any) => {
      // *info: once isAuthenticated$ responses , SSO sessiong is loaded
      // this.loading$.next(false);
      this.loggedIn = res;
    })
  );
  handleRedirectCallback$ = this.auth0Client$.pipe(
    concatMap((client: any) =>
      from(client.handleRedirectCallback(this.currentHref))
    )
  );
  // Create subject and public observable of user profile data
  private userProfileSubject$ = new BehaviorSubject<any>(null);
  userProfile$ = this.userProfileSubject$.asObservable();
  // Create a local property for login status
  loggedIn = false;

  constructor(private router: Router) {
    // On initial load, check authentication state with authorization server
    // Set up local auth streams if user is already authenticated
    const params = this.currentHref;
    if (params.includes('code=') && params.includes('state=')) {
      this.handleAuthCallback();
    } else {
      this.localAuthSetup();
      this.handlerReturnToAferlogout();
    }
  }

  handlerReturnToAferlogout() {
    const { query } = querystring.parseUrl(this.currentHref) || {};
    const { returnTo } = query || {};

    if (returnTo) {
      const target = this.getTargetRouteFromReturnTo(returnTo);
      this.router.navigate([target]);
    }
  }

  // When calling, options can be passed if desired
  // https://auth0.github.io/auth0-spa-js/classes/auth0client.html#getuser
  getUser$(options?): Observable<any> {
    return this.auth0Client$.pipe(
      concatMap((client: any) => from(client.getUser(options))),
      tap((user) => {
        this.userProfileSubject$.next(user);
      })
    );
  }


  private localAuthSetup() {
    // This should only be called on app initialization
    // Set up local authentication streams
    const checkAuth$ = this.isAuthenticated$.pipe(
      concatMap((loggedIn: boolean) => {
        if (loggedIn) {
          // If authenticated, get user and set in app
          // NOTE: you could pass options here if needed
          this.loading$.next(false);
          return this.getUser$();
        }
        this.auth0Client$
          .pipe(
            // https://auth0.com/docs/libraries/auth0-single-page-app-sdk#get-access-token-with-no-interaction
            // *info: Allow check user session in public pages to avoid redirecting to login page
            concatMap((client: any) => from(client.getTokenSilently())),
            concatMap(() => this.getUser$()),
            concatMap((user) => {
              if (user) {
                return this.isAuthenticated$;
              }
              return of(null);
            }),
            catchError((error) => {
              // *info: by pass error, no needed, it is login_required
              return of(null);
            })
          )
          .subscribe(() => {
            this.loading$.next(false);
           });
        // If not authenticated, return stream that emits 'false'
        return of(loggedIn);
      })
    );
    checkAuth$.subscribe();
  }

  private getTargetRouteFromAppState(appState) {
    if (!appState) {
      return '/';
    }

    const { returnTo, target, targetUrl } = appState;

    return (
      this.getTargetRouteFromReturnTo(returnTo) || target || targetUrl || '/'
    );
  }

  private getTargetRouteFromReturnTo(returnTo) {
    if (!returnTo) {
      return '';
    }

    const { fragmentIdentifier } = querystring.parseUrl(returnTo, {
      parseFragmentIdentifier: true,
    });

    if (fragmentIdentifier) {
      return fragmentIdentifier;
    }

    const { pathname } = new Url(returnTo);
    return pathname || '/';
  }

  private handleAuthCallback() {
    // Call when app reloads after user logs in with Auth0
    const params = this.currentHref;

    if (params.includes('code=') && params.includes('state=')) {
      let targetRoute = '/'; // Path to redirect to after login processsed
      const authComplete$ = this.handleRedirectCallback$.pipe(
        // Have client, now call method to handle auth callback redirect
        tap((cbRes: any) => {
          targetRoute = this.getTargetRouteFromAppState(cbRes.appState);
        }),
        concatMap(() => {
          // Redirect callback complete; get user and login status
          return combineLatest([this.getUser$(), this.isAuthenticated$]);
        })
      );
      // Subscribe to authentication completion observable
      // Response will be an array of user and login status
      authComplete$.subscribe(() => {
        // Redirect to target route after callback processing
        // *info: this url change will remove the code and state from the URL
        // * this is need to avoid invalid state in the next refresh
        this.loading$.next(false);
        this.router.navigate([targetRoute]);
      });
    }
  }

  login(redirectPath: string = '/') {
    // A desired redirect path can be passed to login method
    // (e.g., from a route guard)
    // Ensure Auth0 client instance exists
    const redirectUri = `${this.auth0Options.callbackUrl}${window.location.search}`;
    this.auth0Client$.subscribe((client: any) => {
      // Call method to log in
      client.loginWithRedirect({
        redirect_uri: redirectUri,
        appState: { target: redirectPath },
      });
    });
  }

  logout() {
    const { query, fragmentIdentifier } = querystring.parseUrl(
      window.location.href,
      { parseFragmentIdentifier: true }
    );

    const qs = {
      ...query,
      returnTo: window.location.href,
    };

    const searchStr = querystring.stringify(qs);
    const searchPart = searchStr ? `?${searchStr}` : '';

    const fragmentPart = fragmentIdentifier ? `#${fragmentIdentifier}` : '';

    const logoutUrl = this.auth0Options.logoutUrl;

    const request = {
      client_id: this.auth0Options.clientId,
      returnTo: `${logoutUrl}${searchPart}${fragmentPart}`,
    };

    this.auth0Client$.subscribe((client: any) =>
      client.logout(request)
    );
  }

  getTokenSilently$(options?): Observable<any> {
    return this.auth0Client$.pipe(
      concatMap((client: any) => from(client.getTokenSilently(options)))
    );
  }

  getIdToken$(options?): Observable<any> {
    return this.auth0Client$.pipe(
      // *info: if getIdToken fails , just return empty in the catchError
      concatMap((client: any) =>
        from(client.getIdTokenClaims(options))
      ),
      concatMap((claims: any) => of((claims && claims.__raw) || '')),
      catchError(() => of(''))
    );
  }
}
