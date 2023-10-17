// Dependencies
import { createCookieSessionStorage } from "@remix-run/node";
import fetchMock, { enableFetchMocks } from "jest-fetch-mock";

// Internals
import { Auth0Profile, Auth0Strategy } from "../src";

enableFetchMocks();

describe(Auth0Strategy, () => {
  let verify = jest.fn();
  // You will probably need a sessionStorage to test the strategy.
  let sessionStorage = createCookieSessionStorage({
    cookie: { secrets: ["s3cr3t"] },
  });

  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.resetMocks();
  });

  test("should allow changing the scope", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
        scope: "custom",
      },
      verify,
    );

    let request = new Request("https://example.app/auth/auth0");

    try {
      await strategy.authenticate(request, sessionStorage, {
        sessionKey: "user",
      });
    } catch (error) {
      if (!(error instanceof Response)) throw error;
      let location = error.headers.get("Location");

      if (!location) throw new Error("No redirect header");

      let redirectUrl = new URL(location);

      expect(redirectUrl.searchParams.get("scope")).toBe("custom");
    }
  });

  test("should have the scope `openid profile email` as default", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
      },
      verify,
    );

    let request = new Request("https://example.app/auth/auth0");

    try {
      await strategy.authenticate(request, sessionStorage, {
        sessionKey: "user",
      });
    } catch (error) {
      if (!(error instanceof Response)) throw error;
      let location = error.headers.get("Location");

      if (!location) throw new Error("No redirect header");

      let redirectUrl = new URL(location);

      expect(redirectUrl.searchParams.get("scope")).toBe(
        "openid profile email",
      );
    }
  });

  test("should correctly format the authorization URL", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
      },
      verify,
    );

    let request = new Request("https://example.app/auth/auth0");

    try {
      await strategy.authenticate(request, sessionStorage, {
        sessionKey: "user",
      });
    } catch (error) {
      if (!(error instanceof Response)) throw error;

      let location = error.headers.get("Location");

      if (!location) throw new Error("No redirect header");

      let redirectUrl = new URL(location);

      expect(redirectUrl.hostname).toBe("test.fake.auth0.com");
      expect(redirectUrl.pathname).toBe("/authorize");
    }
  });

  test("should allow changing the audience", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
        scope: "custom",
        audience: "SOME_AUDIENCE",
      },
      verify,
    );

    let request = new Request("https://example.app/auth/auth0");

    try {
      await strategy.authenticate(request, sessionStorage, {
        sessionKey: "user",
      });
    } catch (error) {
      if (!(error instanceof Response)) throw error;
      let location = error.headers.get("Location");

      if (!location) throw new Error("No redirect header");

      let redirectUrl = new URL(location);

      expect(redirectUrl.searchParams.get("audience")).toBe("SOME_AUDIENCE");
    }
  });

  test("should allow changing the organization", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
        scope: "custom",
        audience: "SOME_AUDIENCE",
        organization: "SOME_ORG",
      },
      verify,
    );

    let request = new Request("https://example.app/auth/auth0");

    try {
      await strategy.authenticate(request, sessionStorage, {
        sessionKey: "user",
      });
    } catch (error) {
      if (!(error instanceof Response)) throw error;
      let location = error.headers.get("Location");

      if (!location) throw new Error("No redirect header");

      let redirectUrl = new URL(location);

      expect(redirectUrl.searchParams.get("organization")).toBe("SOME_ORG");
    }
  });

  test("should allow setting the connection type", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
        scope: "custom",
        audience: "SOME_AUDIENCE",
        organization: "SOME_ORG",
        connection: "email",
      },
      verify,
    );

    let request = new Request("https://example.app/auth/auth0");

    try {
      await strategy.authenticate(request, sessionStorage, {
        sessionKey: "user",
      });
    } catch (error) {
      if (!(error instanceof Response)) throw error;
      let location = error.headers.get("Location");

      if (!location) throw new Error("No redirect header");

      let redirectUrl = new URL(location);

      expect(redirectUrl.searchParams.get("connection")).toBe("email");
    }
  });

  test("should not fetch user profile when openid scope is not present", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
        scope: "custom",
      },
      verify,
    );

    let session = await sessionStorage.getSession();
    session.set("oauth2:state", "random-state");

    let request = new Request(
      "https://example.com/callback?state=random-state&code=random-code",
      {
        headers: { cookie: await sessionStorage.commitSession(session) },
      },
    );

    fetchMock.once(
      JSON.stringify({
        access_token: "access token",
        scope: "custom",
        expires_in: 86_400,
        token_type: "Bearer",
      }),
    );

    let context = { test: "some context" };

    await strategy.authenticate(request, sessionStorage, {
      sessionKey: "user",
      context,
    });

    expect(verify).toHaveBeenLastCalledWith({
      accessToken: "access token",
      refreshToken: undefined,
      extraParams: {
        scope: "custom",
        expires_in: 86_400,
        token_type: "Bearer",
      },
      profile: {
        provider: "auth0",
      },
      context,
    });
  });

  test("should fetch minimal user profile when only openid scope is present", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
        scope: "openid",
      },
      verify,
    );

    let session = await sessionStorage.getSession();
    session.set("oauth2:state", "random-state");

    let request = new Request(
      "https://example.com/callback?state=random-state&code=random-code",
      {
        headers: { cookie: await sessionStorage.commitSession(session) },
      },
    );

    let userInfo: Auth0Profile["_json"] = {
      sub: "subject",
    };

    fetchMock
      .once(
        JSON.stringify({
          access_token: "access token",
          id_token: "id token",
          scope: "openid",
          expires_in: 86_400,
          token_type: "Bearer",
        }),
      )
      .once(JSON.stringify(userInfo));

    let context = { test: "some context" };

    await strategy.authenticate(request, sessionStorage, {
      sessionKey: "user",
      context,
    });

    const profile: Auth0Profile = {
      provider: "auth0",
      _json: userInfo,
      id: "subject",
    };

    expect(verify).toHaveBeenLastCalledWith({
      accessToken: "access token",
      refreshToken: undefined,
      extraParams: {
        id_token: "id token",
        scope: "openid",
        expires_in: 86_400,
        token_type: "Bearer",
      },
      profile,
      context,
    });
  });

  test("should fetch full user profile when openid, profile, and email scopes are present", async () => {
    let strategy = new Auth0Strategy(
      {
        domain: "test.fake.auth0.com",
        clientID: "CLIENT_ID",
        clientSecret: "CLIENT_SECRET",
        callbackURL: "https://example.app/callback",
        scope: "openid profile email",
      },
      verify,
    );

    let session = await sessionStorage.getSession();
    session.set("oauth2:state", "random-state");

    let request = new Request(
      "https://example.com/callback?state=random-state&code=random-code",
      {
        headers: { cookie: await sessionStorage.commitSession(session) },
      },
    );

    let userInfo: Auth0Profile["_json"] = {
      sub: "248289761001",
      name: "Jane Josephine Doe",
      given_name: "Jane",
      family_name: "Doe",
      middle_name: "Josephine",
      nickname: "JJ",
      preferred_username: "j.doe",
      profile: "http://exampleco.com/janedoe",
      picture: "http://exampleco.com/janedoe/me.jpg",
      website: "http://exampleco.com",
      email: "janedoe@exampleco.com",
      email_verified: true,
      gender: "female",
      birthdate: "1972-03-31",
      zoneinfo: "America/Los_Angeles",
      locale: "en-US",
      phone_number: "+1 (111) 222-3434",
      phone_number_verified: false,
      org_id: "some-auth0-organization-id",
      org_name: "some-auth0-organization-name",
      address: {
        country: "us",
      },
      updated_at: "1556845729",
    };

    fetchMock
      .once(
        JSON.stringify({
          access_token: "access token",
          id_token: "id token",
          scope: "openid profile email",
          expires_in: 86_400,
          token_type: "Bearer",
        }),
      )
      .once(JSON.stringify(userInfo));

    let context = { test: "some context" };

    await strategy.authenticate(request, sessionStorage, {
      sessionKey: "user",
      context,
    });

    const profile: Auth0Profile = {
      provider: "auth0",
      _json: userInfo,
      id: "248289761001",
      displayName: "Jane Josephine Doe",
      name: {
        familyName: "Doe",
        givenName: "Jane",
        middleName: "Josephine",
      },
      emails: [{ value: "janedoe@exampleco.com" }],
      photos: [{ value: "http://exampleco.com/janedoe/me.jpg" }],
      organizationId: "some-auth0-organization-id",
      organizationName: "some-auth0-organization-name",
    };

    expect(verify).toHaveBeenLastCalledWith({
      accessToken: "access token",
      refreshToken: undefined,
      extraParams: {
        id_token: "id token",
        scope: "openid profile email",
        expires_in: 86_400,
        token_type: "Bearer",
      },
      profile,
      context,
    });
  });
});
