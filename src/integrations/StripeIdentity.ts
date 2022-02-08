import { IVerificationContext, IntegrationName, IntegrationPurpose } from "../types";

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

      if (result.error) {
        context.onError(result.error.step);
      }
      return;
    } catch (error) {
      context.onError(error as string);
    }
  }
}
