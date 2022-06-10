import {
  IVerificationContext,
  IntegrationName,
  IntegrationPurpose,
  systemError,
} from "../types";

import { IQualifierIntegration } from "../types";
import Integration from "./Integration";

export interface IStripeIdentityConfig {
  publicKey: string;
  verificationSessionClientSecret?: string;
}

export interface IStripeIdentityProps {
  url: string;
  config: IStripeIdentityConfig;
  requestId: string;
}

export default class StripeIdentityIntegration
  extends Integration
  implements IQualifierIntegration
{
  stripeClient: any = null;

  constructor({ url, config, requestId }: IStripeIdentityProps) {
    super({
      url,
      config,
      name: IntegrationName.STRIPE_IDENTITY,
      purposes: [IntegrationPurpose.QUALIFY],
      requestId,
    });
  }

  public hasLoaded(): boolean {
    return (window as any)?.hasOwnProperty("Stripe");
  }

  public async configure() {
    this.stripeClient = (window as any).Stripe(this.config.publicKey);
  }

  public async reconfigure({
    url,
    config,
    requestId,
  }: IStripeIdentityProps): Promise<void> {
    this._resetConfig({ url, config, requestId });
    await this.configure();
  }

  public async qualify(context: IVerificationContext): Promise<void> {
    try {
      const result = await this.stripeClient.verifyIdentity(
        this.config.verificationSessionClientSecret
      );

      if (result.error && context.onError) {
        context.onError(result.error.step);
      }
      return;
    } catch (error) {
      if (context.onError) {
        context.onError(systemError(error as string));
      }
    }
  }
}
