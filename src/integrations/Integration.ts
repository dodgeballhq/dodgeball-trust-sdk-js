import {
  IIntegrationConfig,
  IIntegrationProps,
  IntegrationName,
  IntegrationPurpose,
} from "../types";

import { loadScript } from "../utilities";

interface IReconfigureIntegrationProps {
  config: IIntegrationConfig;
  url: string;
  purposes?: IntegrationPurpose[];
  requestId: string;
}

export default abstract class Integration {
  config: IIntegrationConfig = {};
  url: string = "";
  name: IntegrationName;
  purposes: IntegrationPurpose[] = [];
  dodgeballRequestId: string = "";

  constructor({ config, url, name, purposes, requestId }: IIntegrationProps) {
    this.config = config;
    this.url = url;
    this.name = name;
    this.purposes = purposes;
    this.dodgeballRequestId = requestId;
  }

  public async load() {
    return await loadScript(this.url);
  }

  public abstract configure(): Promise<void>;

  public abstract reconfigure({
    url,
    config,
    requestId,
  }: IReconfigureIntegrationProps): Promise<void>;

  protected _resetConfig({
    url,
    config,
    requestId,
    purposes = [],
  }: IReconfigureIntegrationProps): void {
    this.url = url;
    this.config = config;
    this.dodgeballRequestId = requestId;

    if (purposes.length > 0) {
      // If there were any purposes passed in, use them
      this.purposes = purposes;
    }

    return;
  }
}
