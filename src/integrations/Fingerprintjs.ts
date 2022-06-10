import {
  FingerprintSource,
  IFingerprint,
  IIdentifierIntegration,
  IntegrationName,
  IntegrationPurpose,
} from "../types";

import Integration from "./Integration";

export interface IFingerprintJSConfig {
  browserToken: string;
  endpoint?: string;
  region?: string;
  tlsEndpoint?: string;
  disableTls?: boolean;
  storageKey?: string;
}

export interface IFingerprintJSProps {
  url: string;
  config: IFingerprintJSConfig;
  requestId: string;
}

export default class FingerprintJSIntegration
  extends Integration
  implements IIdentifierIntegration
{
  client: any = null;

  constructor({ url, config, requestId }: IFingerprintJSProps) {
    super({
      url,
      config,
      name: IntegrationName.FINGERPRINTJS,
      purposes: [IntegrationPurpose.IDENTIFY],
      requestId,
    });
  }

  public hasLoaded(): boolean {
    return (window as any)?.hasOwnProperty("FingerprintJS");
  }

  public async configure(): Promise<void> {
    // Loads the fingerprintjs client (which is an asynchronous call)
    try {
      return new Promise((resolve) => {
        const fpPromise = (window as any).FingerprintJS.load({
          token: this.config.browserToken,
          endpoint: this.config.endpoint,
          region: this.config.region,
          tlsEndpoint: this.config.tlsEndpoint,
          disableTls: this.config.disableTls,
          storageKey: this.config.storageKey,
        });

        fpPromise.then((client: any) => {
          this.client = client;
          resolve();
        });
      });
    } catch (error) {
      console.error(error);
      return Promise.reject();
    }
  }

  public async reconfigure({
    url,
    config,
    requestId,
  }: IFingerprintJSProps): Promise<void> {
    this._resetConfig({ url, config, requestId });
    await this.configure();
  }

  public async identify(): Promise<IFingerprint> {
    const fp: IFingerprint = {
      source: FingerprintSource.FINGERPRINTJS,
      props: {},
      hash: "",
    };

    try {
      const fpResult = await this.client.get({
        tag: {
          dodgeballRequestId: this.dodgeballRequestId,
        },
        linkedId: this.dodgeballRequestId,
        extendedResult: true,
      });

      fp.hash = fpResult.visitorId;
      fp.props = fpResult;
    } catch (error) {
      console.error(error);
      fp.error = (error as any).toString();
    }

    return fp;
  }
}
