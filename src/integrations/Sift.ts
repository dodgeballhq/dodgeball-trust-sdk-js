import { IntegrationName, IntegrationPurpose } from "../types";

import { IObserverIntegration } from "./../types";
import Integration from "./Integration";

export interface ISiftConfig {
  beaconKey: string;
}

export interface ISiftProps {
  url: string;
  config: ISiftConfig;
  requestId: string;
}

export default class SiftIntegration
  extends Integration
  implements IObserverIntegration
{
  siftClient: any = null;

  constructor({ url, config, requestId }: ISiftProps) {
    super({
      url,
      config,
      name: IntegrationName.SIFT,
      purposes: [IntegrationPurpose.OBSERVE],
      requestId,
    });
  }

  public hasLoaded(): boolean {
    return (window as any)?.hasOwnProperty("_sift");
  }

  public async configure() {
    this.siftClient = (window as any)._sift = (window as any)._sift || [];
  }

  public async reconfigure({
    url,
    config,
    requestId,
  }: ISiftProps): Promise<void> {
    this._resetConfig({ url, config, requestId });
    await this.configure();
  }

  public observe(sourceId: string, userId?: string) {
    // Once we have a sourceId, we can send it to Sift.
    const _user_id = userId;
    const _session_id = sourceId;

    if (this.siftClient) {
      this.siftClient.push(["_setAccount", this.config.beaconKey]);
      this.siftClient.push(["_setSessionId", _session_id]);

      if (_user_id) {
        this.siftClient.push(["_setUserId", _user_id]);
      } else {
        this.siftClient.push(["_setUserId", ""]);
      }

      this.siftClient.push(["_trackPageview"]);
    }
  }
}
