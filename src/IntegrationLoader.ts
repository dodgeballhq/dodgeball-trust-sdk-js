import { ILibConfig, IntegrationName, IntegrationPurpose } from "./types";

import FingerprintJSIntegration from "./integrations/Fingerprintjs";
import Integration from "./integrations/Integration";
import SiftIntegration from "./integrations/Sift";
import KountIntegration from "./integrations/Kount";
import StripeIdentityIntegration from "./integrations/StripeIdentity";
import MfaIntegration from "./integrations/Mfa";
import { MAX_INTEGRATION_LOAD_TIMEOUT } from "./constants";
import { Logger } from "./logger";

export default class IntegrationLoader {
  loadedIntegrations: { [key: string]: Integration } = {};

  constructor() {}

  public async loadIntegrations(libs: ILibConfig[], requestId: string): Promise<Integration[]> {
    return new Promise((resolve, reject) => {
      let integrationsMap: { [key: string]: Integration } = {};
      let resolvedCount = 0;

      const timeoutHandle = setTimeout(() => {
        resolve(Object.values(integrationsMap));
      }, MAX_INTEGRATION_LOAD_TIMEOUT);

      const onIntegrationLoaded = (integration: Integration | null) => {
        resolvedCount += 1;
        if (integration !== null) {
          integrationsMap[integration.name] = integration;
        }

        if (libs.length === resolvedCount) {
          // All of the integrations have been loaded
          clearTimeout(timeoutHandle);
          resolve(Object.values(integrationsMap));
        }
      };

      libs.forEach((libConfig) => {
        this.loadIntegration(libConfig, requestId).then(onIntegrationLoaded);
      });
    });
  }

  public async loadIntegration(libConfig: ILibConfig, requestId: string): Promise<Integration | null> {
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

        case IntegrationName.MFA:
          integrationClass = MfaIntegration;
          break;

        case IntegrationName.KOUNT:
          integrationClass = KountIntegration;
          break;

        default:
          console.warn(`Unknown integration: ${libConfig.name}`);
      }

      if (integrationClass !== null) {
        integration = new integrationClass({
          ...libConfig,
          requestId,
        });

        if (!integration.hasLoaded()) {
          await integration.load();
        }
        await integration.configure();
        this.loadedIntegrations[libConfig.name] = integration;
      }

      return integration;
    } catch (error) {
      Logger.error(`Error loading integration: ${libConfig.name}`, error).log();
      return null;
    }
  }

  public filterIntegrationsByPurpose(integrations: Integration[], purpose: IntegrationPurpose): Integration[] {
    return integrations.filter((integration) => integration.purposes.indexOf(purpose) > -1);
  }
}
