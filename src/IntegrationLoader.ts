import { ILibConfig, IntegrationName, IntegrationPurpose } from "./types";

import FingerprintJSIntegration from "./integrations/Fingerprintjs";
import Integration from "./integrations/Integration";
import SiftIntegration from "./integrations/Sift";
import StripeIdentityIntegration from "./integrations/StripeIdentity";
import TwilioIntegration from "./integrations/Twilio";

export default class IntegrationLoader {
  loadedIntegrations: { [key: string]: Integration } = {};

  constructor() {}

  public async loadIntegration(
    libConfig: ILibConfig,
    requestId: string
  ): Promise<Integration | null> {
    try {
      let integration: Integration | null = null;

      // Check if the integration has already been loaded.
      // If so, return the existing integration.
      if (this.loadedIntegrations.hasOwnProperty(libConfig.name)) {
        integration = this.loadedIntegrations[libConfig.name];
        await integration.reconfigure({ ...libConfig, requestId });
        return integration;
      }

      let integrationClass = null;

      // Based on the integration name passed in the libConfig
      // instantiate the correct integration class
      switch (libConfig.name) {
        case IntegrationName.FINGERPRINTJS:
          integrationClass = FingerprintJSIntegration;
          break;
        case IntegrationName.SIFT:
        case IntegrationName.SIFT_SCORE:
          integrationClass = SiftIntegration;
          break;
        case IntegrationName.STRIPE_IDENTITY:
          integrationClass = StripeIdentityIntegration;
          break;
        case IntegrationName.MFA_TWILIO:
          integrationClass = TwilioIntegration;
          break;
        default:
          console.warn(`Unknown integration: ${libConfig.name}`);
      }

      if (integrationClass !== null) {
        integration = new integrationClass({
          ...libConfig,
          requestId,
        });

        await integration.load();
        await integration.configure();
        this.loadedIntegrations[libConfig.name] = integration;
      }

      return integration;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public filterIntegrationsByPurpose(
    integrations: Integration[],
    purpose: IntegrationPurpose
  ): Integration[] {
    return integrations.filter(
      (integration) => integration.purposes.indexOf(purpose) > -1
    );
  }
}
