# Auth0Strategy

The Auth0 strategy is used to authenticate users against an Auth0 account. It
extends the OAuth2Strategy.

## Supported runtimes

| Runtime    | Has Support |
| ---------- | ----------- |
| Node.js    | ✅          |
| Cloudflare | ✅          |

## Usage

### Create an Auth0 tenant

Follow the steps on
[the Auth0 documentation](https://auth0.com/docs/get-started/create-tenants) to
create a tenant and get a client ID, client secret and domain.

### Create the strategy instance

```tsx
// app/utils/auth.server.ts
import { Authenticator } from "remix-auth";
import { Auth0Strategy } from "remix-auth-auth0";

type User = { /* fill in*/ };

// Create an instance of the authenticator, pass a generic with what your
// strategies will return and will be stored in the session
export const authenticator = new Authenticator<User>(sessionStorage);

const auth0Strategy = new Auth0Strategy(
  {
    callbackURL: "https://example.com/auth/auth0/callback",
    clientID: "YOUR_AUTH0_CLIENT_ID",
    clientSecret: "YOUR_AUTH0_CLIENT_SECRET",
    domain: "YOUR_TENANT.us.auth0.com",
  },
  async ({ tokens: { access_token, scope, expires_in, refresh_token }, profile }) => {
    // Get the user data from your DB or API using the tokens and profile
    return User.findOrCreate({ email: profile.emails[0].value });
  },
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
// app/routes/auth.auth0.tsx
import { redirect, type ActionFunctionArgs } from "@remix-run/node";

import { authenticator } from "~/utils/auth.server";

export const loader = () => redirect("/login");

export const action = ({ request }: ActionFunctionArgs) => {
  return authenticator.authenticate("auth0", request);
};
```

```tsx
// app/routes/auth.auth0.callback.tsx
import { type LoaderFunctionArgs } from "@remix-run/node";

import { authenticator } from "~/utils/auth.server";

export const loader = ({ request }: LoaderFunctionArgs) => {
  return authenticator.authenticate("auth0", request, {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  });
};
```

```tsx
// app/routes/auth.logout.ts
import { redirect, type ActionFunctionArgs } from "@remix-run/node";

import { destroySession, getSession } from "~/utils/auth.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const session = await getSession(request.headers.get("Cookie"));
  const logoutURL = new URL(process.env.AUTH0_LOGOUT_URL); // i.e https://YOUR_TENANT.us.auth0.com/v2/logout

  logoutURL.searchParams.set("client_id", process.env.AUTH0_CLIENT_ID);
  logoutURL.searchParams.set("returnTo", process.env.AUTH0_RETURN_TO_URL);

  return redirect(logoutURL.toString(), {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};
```

## Advanced Usage

### Link directly to signup

```tsx
// app/routes/register.tsx
export default function Register() {
  return (
    <Form action="/auth/auth0?screen_hint=signup" method="post">
      <button>Register with Auth0</button>
    </Form>
  );
}

// https://auth0.com/docs/authenticate/login/auth0-universal-login/new-experience#signup
```
