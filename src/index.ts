import {
  OAuth2Profile,
  OAuth2Strategy,
  OAuth2StrategyVerifyParams,
} from "remix-auth-oauth2";
import type { StrategyVerifyCallback } from "remix-auth";

export interface Auth0StrategyOptions {
  domain: string;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope?: Auth0Scope[] | string;
  audience?: string;
  organization?: string;
  invitation?: string;
  connection?: string;
}

/**
 * @see https://auth0.com/docs/get-started/apis/scopes/openid-connect-scopes#standard-claims
 */
export type Auth0Scope = "openid" | "profile" | "email" | string;

export interface Auth0Profile extends OAuth2Profile {
  _json?: Auth0UserInfo;
  organizationId?: string;
  organizationName?: string;
}

export interface Auth0ExtraParams extends Record<string, unknown> {
  id_token?: string;
  scope: string;
  expires_in: number;
  token_type: "Bearer";
}

interface Auth0UserInfo {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: {
    country?: string;
  };
  updated_at?: string;
  org_id?: string;
  org_name?: string;
}

export const Auth0StrategyDefaultName = "auth0";
export const Auth0StrategyDefaultScope: Auth0Scope = "openid profile email";
export const Auth0StrategyScopeSeperator = " ";

export class Auth0Strategy<User> extends OAuth2Strategy<
  User,
  Auth0Profile,
  Auth0ExtraParams
> {
  name = Auth0StrategyDefaultName;

  private userInfoURL: string;
  private scope: Auth0Scope[];
  private audience?: string;
  private organization?: string;
  private invitation?: string;
  private connection?: string;
  private fetchProfile: boolean;

  constructor(
    options: Auth0StrategyOptions,
    verify: StrategyVerifyCallback<
      User,
      OAuth2StrategyVerifyParams<Auth0Profile, Auth0ExtraParams>
    >,
  ) {
    super(
      {
        authorizationURL: `https://${options.domain}/authorize`,
        tokenURL: `https://${options.domain}/oauth/token`,
        clientID: options.clientID,
        clientSecret: options.clientSecret,
        callbackURL: options.callbackURL,
      },
      verify,
    );

    this.userInfoURL = `https://${options.domain}/userinfo`;
    this.scope = this.getScope(options.scope);
    this.audience = options.audience;
    this.organization = options.organization;
    this.invitation = options.invitation;
    this.connection = options.connection;
    this.fetchProfile = this.scope
      .join(Auth0StrategyScopeSeperator)
      .includes("openid");
  }

  // Allow users the option to pass a scope string, or typed array
  private getScope(scope: Auth0StrategyOptions["scope"]) {
    if (!scope) {
      return [Auth0StrategyDefaultScope];
    } else if (typeof scope === "string") {
      return scope.split(Auth0StrategyScopeSeperator) as Auth0Scope[];
    }

    return scope;
  }

  protected authorizationParams(params: URLSearchParams) {
    params.set("scope", this.scope.join(Auth0StrategyScopeSeperator));
    if (this.audience) {
      params.set("audience", this.audience);
    }
    if (this.organization) {
      params.set("organization", this.organization);
    }
    if (this.invitation) {
      params.set("invitation", this.invitation);
    }
    if (this.connection) {
      params.set("connection", this.connection);
    }

    return params;
  }

  protected async userProfile(accessToken: string): Promise<Auth0Profile> {
    let profile: Auth0Profile = {
      provider: Auth0StrategyDefaultName,
    };

    if (!this.fetchProfile) {
      return profile;
    }

    let response = await fetch(this.userInfoURL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    let data: Auth0UserInfo = await response.json();

    profile._json = data;

    if (data.sub) {
      profile.id = data.sub;
    }

    if (data.name) {
      profile.displayName = data.name;
    }

    if (data.family_name || data.given_name || data.middle_name) {
      profile.name = {};

      if (data.family_name) {
        profile.name.familyName = data.family_name;
      }

      if (data.given_name) {
        profile.name.givenName = data.given_name;
      }

      if (data.middle_name) {
        profile.name.middleName = data.middle_name;
      }
    }

    if (data.email) {
      profile.emails = [{ value: data.email }];
    }

    if (data.picture) {
      profile.photos = [{ value: data.picture }];
    }

    if (data.org_id) {
      profile.organizationId = data.org_id;
    }

    if (data.org_name) {
      profile.organizationName = data.org_name;
    }

    return profile;
  }
}
