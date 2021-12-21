# Auth0Strategy

The Auth0 strategy is used to authenticate users against an Auth0 account. It extends the OAuth2Strategy.

## Supported runtimes

| Runtime    | Has Support |
| ---------- | ----------- |
| Node.js    | ✅          |
| Cloudflare | ✅          |

## Usage

### Create an Auth0 tenant

Follow the steps on [the Auth0 documentation](https://auth0.com/docs/get-started/create-tenants) to create a tenant and get a client ID, client secret and domain.

### Create the strategy instance

```tsx
// app/utils/auth.server.ts
import { Authenticator } from "remix-auth";
import { Auth0Strategy } from "remix-auth-auth0";

// Create an instance of the authenticator, pass a generic with what your
// strategies will return and will be stored in the session
export const authenticator = new Authenticator<User>(sessionStorage);

let auth0Strategy = new Auth0Strategy(
  {
    callbackURL: "https://example.com/auth/auth0/callback",
    clientID: "YOUR_AUTH0_CLIENT_ID",
    clientSecret: "YOUR_AUTH0_CLIENT_SECRET",
    domain: "YOUR_TENANT.us.auth0.com",
  },
  async ({ accessToken, refreshToken, extraParams, profile }) => {
    // Get the user data from your DB or API using the tokens and profile
    return User.findOrCreate({ email: profile.emails[0].value });
  }
);

authenticator.use(auth0Strategy);
```

### Setup your routes

```tsx
// app/routes/login.tsx
export default function Login() {
  return (
    <Form action="/auth/auth0" method="post">
      <button>Login with Auth0</button>
    </Form>
  );
}
```

```tsx
// app/routes/auth/auth0.tsx
import type { ActionFunction, LoaderFunction } from "remix";

import { authenticator } from "~/utils/auth.server";

export let loader: LoaderFunction = () => redirect("/login");

export let action: ActionFunction = ({ request }) => {
  return authenticator.authenticate("auth0", request);
};
```

```tsx
// app/routes/auth/auth0/callback.tsx
import type { ActionFunction, LoaderFunction } from "remix";

import { authenticator } from "~/utils/auth.server";

export let loader: LoaderFunction = ({ request }) => {
  return authenticator.authenticate("auth0", request, {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  });
};
```
