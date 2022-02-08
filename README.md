# Dodgeball Client Trust SDK for JavaScript

The Dodgeball Client Trust SDK allows you to decouple trust and safety requirements from your application code. Dodgeball serves as an abstraction layer for the various integrations your application requires when performing risky actions. For example, instead of directly integrating fraud engines, 2FA, KYC providers, and bot prevention solutions into your application, use Dodgeball to decouple these requirements from your application code. Your trust and safety teams focus on ensuring your application is safe and secure, and you focus on your application's business logic. When threats evolve or new vulnerabilities are identified, your application can be updated to mitigate these risks without having to change a single line of code or add support for a new integration.

Check out the [Dodgeball Trust Server SDK](https://npmjs.com/package/@dodgeball/trust-sdk-server) for how to integrate Dodgeball into your API.

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
import { useEffect } from "react";

export default function MyApp() {
  const dodgeball = useDodgeball();

  useEffect(() => {
    // This code gets executed once when the app loads
    dodgeball.track(process.env.DODGEBALL_PUBLIC_KEY);
  }, []);

  return (
    <div>
      <h1>My App</h1>
      <MyComponent/>
    </div>
  );
  )
}
```

Below is a simple example of a component that performs a verification when an order is placed:

```tsx
import { useDodgeball } from "@dodgeball/trust-sdk-client";
import { useState, useEffect } from "react";
import axios from "axios";

export default function MyComponent() {
  const dodgeball = useDodgeball();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [isOrderDenied, setIsOrderDenied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsPlacingOrder(false);
  }, [isOrderPlaced, isOrderDenied])
  
  const placeOrder = async (order, previousVerification = null) => {
    const dodgeballId = await dodgeball.getIdentity();
    
    const response = await axios.post("/api/orders", {
      order,
      dodgeballId, // The dodgeballId is used to identify the device making the request
      verification: previousVerification // If a previous verification was performed, pass it along to your API
    });

    dodgeball.handleVerification(response.data.verification, {
      onVerified: async (verification) => {
        // If a verification was performed and it is approved, simply pass it in to your API
        await placeOrder(order, verification);
      },
      onApproved: async () => {
        // If no additional verification was required (ie verification = null), update the view to show that the order was placed
        setIsOrderPlaced(true);
      },
      onDenied: async (verification) => {
        // If the action was denied, update the view to show the rejection
        setIsOrderDenied(true);
      },
      onError: async (error) => {
        // If there was an error performing the verification, display it
        setError(error);
        setIsPlacingOrder(false);
      }
    })
  }

  const onPlaceOrderClick = async () => {
    setIsPlacingOrder(true);

    const order = {} // Arbitrary data your API expects
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

The Dodgeball Client SDK attaches a `dodgeball` object to the `window` that can be accessed from anywhere in your application.
You'll first need to initialize the SDK with your public API key which can be found on the [developer settings](https://app.dodgeballhq.com/developer) page. This only needs to be done once when the SDK first loads as in the example below:

```ts
const dodgeballId = await dodgeball.track(process.env.DODGEBALL_PUBLIC_KEY);
```

Later, when you want to verify that a visitor is allowed to perform an action, you call `dodgeball.handleVerification` with the verification data returned from your API and a few callback functions:

```ts
const placeOrder = async (order, previousVerification = null) => {
  const dodgeballId = await dodgeball.getIdentity();

  const response = await axios.post("/api/orders", {
    order,
    dodgeballId, // The dodgeballId is used to identify the device making the request
    verification: previousVerification // If a previous verification was performed, pass it along to your API
  });

  dodgeball.handleVerification(response.data.verification, {
    onVerified: async (verification) => {
      // If a verification was performed and it is approved, simply pass it in to your API
      await placeOrder(order, verification);
    },
    onApproved: async () => {
      // If no additional verification was required (ie verification = null), update the view to show that the order was placed
      console.log("Order placed!");
    },
    onDenied: async (verification) => {
      // If the action was denied, update the view to show the rejection
      console.log("Order denied.");
    },
    onError: async (error) => {
      // If there was an error performing the verification, display it
      console.log("Verification error:", error);
    }
  })
}
```
