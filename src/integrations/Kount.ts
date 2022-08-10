import { IIntegrationConfig, IntegrationName, IntegrationPurpose, IReconfigureIntegrationProps } from "../types";

import { IObserverIntegration } from "./../types";
import Integration from "./Integration";

export interface IKountProps {
  url: string;
  config: IIntegrationConfig;
  requestId: string;
}

export default class KountIntegration extends Integration implements IObserverIntegration {
  kountClient: any = null;

  //TODO: consolidate all integrations to use IIntegrationProps
  constructor({ config, requestId }: IKountProps) {
    super({
      url: `${config["global.data.endpoint"]}/collect/sdk?m=${config["global.id.account"]}`,
      config,
      requestId,
      name: IntegrationName.KOUNT,
      purposes: [IntegrationPurpose.OBSERVE],
    });
  }

  public hasLoaded(): boolean {
    return (window as any)?.hasOwnProperty("ka");
  }

  public async configure() {
    this.kountClient = (window as any).ka = (window as any).ka || [];
  }

  public async reconfigure({ url, config, requestId }: IReconfigureIntegrationProps): Promise<void> {
    this._resetConfig({ url, config, requestId });
    await this.configure();
  }

  public observe(sessionId: string) {
    const _session_id = sessionId;

    if (this.kountClient) {
      const newUrlWithSessionId = `${this.config["global.data.endpoint"]}/collect/sdk?m=${this.config["global.id.account"]}&s=${_session_id}`;
      this.reconfigure({ url: newUrlWithSessionId, config: this.config, requestId: this.dodgeballRequestId });
      this.kountClient["sessionId"] = _session_id;
    }
  }
}
