# Dodgeball Client Trust SDK for JavaScript

## Table of Contents
- [Purpose](#purpose)
- [Prerequisites](#prerequisites)
- [Related](#related)
- [Installation](#installation)
- [Usage](#usage)
- [API](#api)

## Purpose
[Dodgeball](https://dodgeballhq.com) enables developers to decouple security logic from their application code. This has several benefits including:
- The ability to toggle and compare security services like fraud engines, MFA, KYC, and bot prevention.
- Faster responses to new attacks. When threats evolve and new vulnerabilities are identified, your application's security logic can be updated without changing a single line of code.
- The ability to put in placeholders for future security improvements while focussing on product development.
- A way to visualize all application security logic in one place.

The Dodgeball Client Trust SDK for JavaScript makes integration with the Dodgeball API easy and is maintained by the Dodgeball team.

## Prerequisites
You will need to obtain an API key for your application from the [Dodgeball developer center](https://app.dodgeballhq.com/developer).

## Related
Check out the [Dodgeball Trust Server SDK](https://npmjs.com/package/@dodgeball/trust-sdk-server) for how to integrate Dodgeball into your application's backend.

## Installation
Use `npm` to install the Dodgeball module:
```sh
npm install @dodgeball/trust-sdk-client
```

Alternatively, using `yarn`:
```sh
yarn add @dodgeball/trust-sdk-client
```

## Usage

### React Applications

The Dodgeball Client SDK comes with a `useDodgeball` hook that can be used in all of your components.
You'll first need to initialize the SDK with your public API key which can be found on the [developer settings](https://app.dodgeballhq.com/developer) page. This only needs to be done once when the application first loads as in the example below:

```tsx
import { useDodgeball } from "@dodgeball/trust-sdk-client";
import { useEffect, useSelector } from "react";
import { selectCurrentUser, selectCurrentSession } from "./selectors";

export default function MyApp() {
  const dodgeball = useDodgeball('public-api-key...');
  const currentSession = useSelector(selectCurrentSession);
  const currentUser = useSelector(selectCurrentUser);

  useEffect(() => {
    /* 
      When you know the ID of the currently logged-in user, 
      pass it along with a session ID to dodgeball.track():
    */
    dodgeball.track(currentSession?.id, currentUser?.id);
  }, [currentSession?.id, currentUser?.id]);

  return (
    <div>
      <h1>My App</h1>
      <MyComponent/>
    </div>
  );
}
```

Below is a simple example of a component that performs a verification when an order is placed:

```tsx
import { useDodgeball } from "@dodgeball/trust-sdk-client";
import { useState, useEffect } from "react";
import axios from "axios";

export default function MyComponent() {
  const dodgeball = useDodgeball(); // Once initialized, you can omit the public API key

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [isOrderDenied, setIsOrderDenied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsPlacingOrder(false);
  }, [isOrderPlaced, isOrderDenied])

  const placeOrder = async (order, previousVerification = null) => {
    const sourceToken = await dodgeball.getSourceToken();

    const endpointResponse = await axios.post("/api/orders", { order }, {
      headers: {
        "x-dodgeball-source-token": sourceToken, // Pass the source token to your API
        "x-dodgeball-verification-id": previousVerificationId // If a previous verification was performed, pass it along to your API
      }
    });

    dodgeball.handleVerification(endpointResponse.data.verification, {
      onVerified: async (verification) => {
        // If an additional check was performed and the request is approved, simply pass the verification ID in to your API
        await placeOrder(order, verification.id);
      },
      onApproved: async () => {
        // If no additional check was required, update the view to show that the order was placed
        setIsOrderPlaced(true);
      },
      onDenied: async (verification) => {
        // If the action was denied, update the view to show the rejection
        setIsOrderDenied(true);
      },
      onError: async (error) => {
        // If there was an error performing the verification, display it
        setError(error); // Usage Note: If the user cancels the verification, error.errorType = "CANCELLED"
        setIsPlacingOrder(false);
      }
    });
  }

  const onPlaceOrderClick = async () => {
    setIsPlacingOrder(true);

    const order = {} // Fill in with whatever data your API expects
    await placeOrder(order);
  }

  return (
    <div>
      <h2>My Component</h2>
      <p>
        This component is using the Dodgeball Client SDK.
      </p>
      {isOrderPlaced ? (
        <p>
          Your order was placed!
        </p>
      ) : (
        <p>
          {isOrderDenied && <span>Order was denied. Contact support.</span>}

          <button onClick={onPlaceOrderClick} disabled={isPlacingOrder || isOrderDenied}>
            {isPlacingOrder ? 'Placing Order...' : 'Place Order'}
          </button>

          {error && <div>{error}</div>}
        </p>
      )}
    </div>
  );
}
```

### Non-React Applications

The Dodgeball Client SDK exports a `Dodgeball` class that can be passed a public API key and an optional config object. See the [constructor](#constructor) section for more information on configuration. You can find your public API key on the [developer settings](https://app.dodgeballhq.com/developer) page. 

You'll first need to initialize the SDK with your public API key which can be found on the [developer settings](https://app.dodgeballhq.com/developer) page. This only needs to be done once when the SDK first loads as in the example below:

```js
import { Dodgeball } from "@dodgeball/trust-sdk-client";

const dodgeball = new Dodgeball('public-api-key...'); // Do this once when your application first loads

const sourceToken = await dodgeball.getSourceToken();
```

When you know the ID of the currently logged-in user, call `dodgeball.track()`.

```js
// As soon as you have a session ID, pass it to dodgeball.track()
const onSession = (currentSession) => {
  dodgeball.track(currentSession?.id);
}

// When you know the ID of the currently logged-in user, pass it along with a session ID to dodgeball.track()
const onLogin = (currentSession, currentUser) => {
  dodgeball.track(currentSession?.id, currentUser?.id);
}
```

Later, when you want to verify that a visitor is allowed to perform an action, call `dodgeball.getSourceToken()` to get a token representing this device. Pass the returned `sourceToken` to your API. Once your API returns a response, pass the `verification` to `dodgeball.handleVerification` along with a few callback functions:

```js
const placeOrder = async (order, previousVerificationId = null) => {
  const sourceToken = await dodgeball.getSourceToken();

  const endpointResponse = await axios.post("/api/orders", { order }, {
    headers: {
      "x-dodgeball-source-token": sourceToken, // Pass the source token to your API
      "x-dodgeball-verification-id": previousVerificationId // If a previous verification was performed, pass it along to your API
    }
  });

  dodgeball.handleVerification(endpointResponse.data.verification, {
    onVerified: async (verification) => {
      // If an additional check was performed and the request is approved, simply pass the verification ID in to your API
      await placeOrder(order, verification.id);
    },
    onApproved: async () => {
      // If no additional check was required, update the view to show that the order was placed
      setIsOrderPlaced(true);
    },
    onDenied: async (verification) => {
      // If the action was denied, update the view to show the rejection
      setIsOrderDenied(true);
    },
    onError: async (error) => {
      // If there was an error performing the verification, display it
      setError(error); // Usage Note: If the user cancels the verification, error.errorType = "CANCELLED"
      setIsPlacingOrder(false);
    }
  });
}
```

### Loading via CDN

The Dodgeball Client SDK is also available via CDN at this url: 
```
https://www.unpkg.com/@dodgeball/trust-sdk-client@latest/dist/umd/index.js
```

To load this in an HTML document:

```html
<!doctype html>
<html>
  <head>
    <title>My Application</title>
    <script type="text/javascript" async defer src="https://www.unpkg.com/@dodgeball/trust-sdk-client@latest/dist/umd/index.js" onload="onDodgeballLoaded()"></script>
    <script>
      async function onDodgeballLoaded() {
        const dodgeball = new Dodgeball('public-api-key...'); // Do this once when your application first loads

        // At some point later, when you are ready to call your API:
        const placeOrder = async (order, previousVerificationId = null) => {
          const sourceToken = await dodgeball.getSourceToken();

          const endpointResponse = await axios.post("/api/orders", { order }, {
            headers: {
              "x-dodgeball-source-token": sourceToken, // Pass the source token to your API
              "x-dodgeball-verification-id": previousVerificationId // If a previous verification was performed, pass it along to your API
            }
          });

          dodgeball.handleVerification(endpointResponse.data.verification, {
            onVerified: async (verification) => {
              // If an additional check was performed and the request is approved, simply pass the verification ID in to your API
              await placeOrder(order, verification.id);
            },
            onApproved: async () => {
              // If no additional check was required, update the view to show that the order was placed
              setIsOrderPlaced(true);
            },
            onDenied: async (verification) => {
              // If the action was denied, update the view to show the rejection
              setIsOrderDenied(true);
            },
            onError: async (error) => {
              // If there was an error performing the verification, display it
              setError(error); // Usage Note: If the user cancels the verification, error.errorType = "CANCELLED"
              setIsPlacingOrder(false);
            }
          });
        }

        await placeOrder({
          cart: [],
          paymentMethod: {},
          // ... any other data relevant to your API
        });
      }
    </script>
  </head>
  <body>
  Your application's content...
  </body>
</html>
```

## API

### Configuration
___
The package requires a public API key as the first argument to the constructor.
```js
const dodgeball = new Dodgeball("public-api-key...");
```
Optionally, you can pass in several configuration options to the constructor:
```js
const dodgeball = new Dodgeball("public-api-key...", {
  // Optional configuration
  apiVersion: "v1",
  apiUrl: "https://api.dodgeballhq.com",
  logLevel: "ERROR",
  disableCookies: false,
  isEnabled: true
});
```
| Option | Default | Description |
|:-- |:-- |:-- |
| `apiVersion` | `v1` | The Dodgeball API version to use. |
| `apiUrl` | `https://api.dodgeballhq.com` | The base URL of the Dodgeball API. Useful for sending requests to different environments such as `https://api.sandbox.dodgeballhq.com`. |
| `logLevel` | `INFO` | The level of logging to use. Possible options are `TRACE`, `INFO`,` ERROR`, or `NONE`. `TRACE` and `INFO` are useful for debugging. `ERROR` only logs errors. `NONE` turns off all logging. |
| `disableCookies` | `false` | If `true`, the SDK will not use cookies to store the source token. |
| `isEnabled` | `true` | If `false`, the SDK will not make external API calls. This is useful for local development. |

### Track the User
The `track` method is used to initialize any session and user information that is known. This method should be called as soon as you have a session ID and optionally a user ID. If you do not have a user ID, you can pass `null` or omit the second argument.
```js
dodgeball.track(sessionId, userId);
```
| Argument | Type | Description |
|:-- |:-- |:-- |
| `sessionId` | `string` | The ID of the current session. This may be any unique string representing the user's activity within your system. If you don't have a session ID to use, pass the `sourceToken` returned from `dodgeball.getSourceToken()`. |
| `userId` | `string` | The ID of the current user. |

### Get a Source Token
The `getSourceToken` method returns a token that represents a period of activity on the current device. This token should be passed to your API when you want to verify that a user is allowed to perform an action. Source tokens expire after 1 hour and are automatically refreshed by the SDK.
```js
const sourceToken = await dodgeball.getSourceToken();
```
If async/await isn't your thing, you can invoke the `getSourceToken` method with a callback function that will be called with the source token as an argument:
```js
dodgeball.getSourceToken((sourceToken) => {});
```

### Refresh a Source Token
The `refreshSourceToken` method refreshes the current source token. This is useful if you want to refresh the token before it expires, as in the case of when a user logs out.
```js
const newSourceToken = await dodgeball.refreshSourceToken();
```
Alternatively, you can invoke the `refreshSourceToken` method with a callback function that will be called with the new source token as an argument:
```js
dodgeball.refreshSourceToken((newSourceToken) => {});
```

### Handle a Verification
The `handleVerification` method is used to handle a verification response from your API. This method should be called after your API returns a response containing a verification object. The verification object contains information about the verification that was performed. The `handleVerification` method takes a verification object and a config object containing several callback functions. The `handleVerification` method will call the appropriate callback function based on the verification response.
```js
dodgeball.handleVerification(
  verification, // This is the verification object returned from your API
  {
    onVerified: async (verification) => {
      // If an additional check was performed and the request is approved, the requested action has not yet been taken on your API. To do so, simply retry the request, being sure to pass the verification.id to your API. On your API the verification.id should be passed as the useVerificationId argument to dodgeball.checkpoint()
    },
    onApproved: async () => {
      // If no additional check was required, the requested action was approved and taken on your API, so you should update the view to show that the action was taken
    },
    onDenied: async (verification) => {
      // If the action was denied, update the view to show the rejection
    },
    onPending: async (verification) => {
      // (Optional) This callback will be called if the verification is still processing. This is useful to inform the user that their request is still being processed.
    },
    onBlocked: async (verification) => {
      // (Optional) This callback will be called if the verification requires additional information from the user before it can be processed (e.g. the user needs to complete an MFA challenge or IDV flow)
    },
    onError: async (verificationError) => {
      // (Optional) If there was an error performing the verification, this callback will be called with an error object. If the user cancels the verification, error.errorType = "CANCELLED"
    }
  },
  {
    // Optional configuration
    maxDuration: 24 * 60 * 60 * 1000, // 24 hours
  }
);
```
| Argument | Type | Description |
|:-- |:-- |:-- |
| `verification` | `object` | The verification object returned from your API. |
| `context` | `object` | An object containing several callback functions described above. |
| `config` | `object` | An object containing several configuration options. |
| `config.maxDuration` | `number` | The maximum amount of time to wait for a verification to complete. If the verification is still pending after this amount of time, the `onError` callback will be called with an error object. |