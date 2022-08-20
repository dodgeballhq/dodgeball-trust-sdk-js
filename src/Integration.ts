import {
  IIntegrationConfig,
  IIntegrationProps,
  IntegrationPurpose,
  IReconfigureIntegrationProps,
} from "./types";

export default abstract class Integration {
  config: IIntegrationConfig = {};
  url: string = "";
  name: string;
  purposes: IntegrationPurpose[] = [];
  dodgeballRequestId: string = "";

  constructor({ config, url, name, purposes, requestId }: IIntegrationProps) {
    this.name = name;
  }

  public abstract hasLoaded(): boolean;

  public async load() {}

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
  }: IReconfigureIntegrationProps): void {}
}
