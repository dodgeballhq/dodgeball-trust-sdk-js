import {
  DodgeballClientObjectsNull,
  IDodgeballParentContext,
  ILibConfig,
  IntegrationPurpose,
} from "./types";

import Integration from "./Integration";
import { MAX_INTEGRATION_LOAD_TIMEOUT, DEFAULT_REQUIRE_SRC } from "./constants";
import { Logger } from "./logger";

export interface IIntegrationLoaderProps {
  requireSrc?: string;
  parentContext: IDodgeballParentContext;
}

export default class IntegrationLoader {
  parentContext: IDodgeballParentContext;
  isRequireLoaded: boolean = false;
  onRequireLoaded: any[] = [];
  loadedIntegrations: { [key: string]: Integration } = {};

  constructor({ requireSrc, parentContext }: IIntegrationLoaderProps) {
    this.parentContext = parentContext;

    (async () => {
      try {
        if(!document){
          Logger.error(
              "Client Document is null: is the Javascript Client execution on a server"
          ).log();

          throw new DodgeballClientObjectsNull("document", "IntegrationLoader::constructor");
        }

        const requireScript = document.createElement("script");
        const sourceToUse = requireSrc ? requireSrc : DEFAULT_REQUIRE_SRC;
        const sourceText = await (await fetch(sourceToUse as string)).text();
        const customRequire = `
        var dodgeballRequire = (function () {
          var require = {};
          ${sourceText}
          return {require, define, requirejs};
        }());
      `;
        requireScript.innerHTML = customRequire;

        let tries = 0;
        const maxTries = 1000;

        const registerCheck = () => {
          setTimeout(async () => {
            tries += 1;
            if ((window as any).dodgeballRequire) {
              this.isRequireLoaded = true;
              for (const callback of this.onRequireLoaded) {
                await callback();
              }
            } else if (tries < maxTries) {
              registerCheck();
            }
          }, 1);
        };

        registerCheck();
        document.body.appendChild(requireScript);
      } catch (error){
        Logger.error("Could not load Dodgeball Integrations", error).log();
      }
    })();
  }

  public async loadIntegrations(
    libs: ILibConfig[],
    requestId: string
  ): Promise<Integration[]> {
    return new Promise((resolve) => {
      try {
        let integrationsMap: { [key: string]: Integration } = {};
        let resolvedCount = 0;

        const onIntegrationLoaded = (integration: Integration | null) => {
          resolvedCount += 1;
          if (integration !== null) {
            integrationsMap[integration.name] = integration;
          }

          if (libs.length === resolvedCount) {
            // All of the integrations have been loaded or skipped
            resolve(Object.values(integrationsMap));
          }
        };

        libs.forEach((libConfig) => {
          try {
            this.loadIntegration(libConfig, requestId).then(onIntegrationLoaded);
          } catch (error){
            Logger.error(
                `Could not load requested integration: ${libConfig?.name ?? ""}`,
                error
            ).log();
          }
        });
      } catch(error){
        Logger.error(
            "Could not load integrations",
            error
        ).log();
      }
    });
  }

  public async loadIntegration(
    libConfig: ILibConfig,
    requestId: string
  ): Promise<Integration | null> {
    let integration: Integration;

    // Check if the integration has already been loaded.
    // If so, return the existing integration.
    if (this.loadedIntegrations.hasOwnProperty(libConfig.name)) {
      try {
        Logger.info(`Integration already loaded: ${libConfig.name}`).log();
        integration = this.loadedIntegrations[libConfig.name];
        Logger.info(`Reconfiguring integration: ${libConfig.name}`).log();
        await integration.reconfigure({ ...libConfig, requestId });
        return integration;
      } catch (error) {
        Logger.error(
          `Error loading integration: ${libConfig.name}`,
          error
        ).log();
        return null;
      }
    } else {
      const _loadIntegration = (resolve: any, reject: any) => {
        try {
          // Dynamically load the integration content
          if (libConfig.content != null) {
            const integrationTimeoutValue = libConfig.loadTimeout
              ? libConfig.loadTimeout
              : this.parentContext?.config?.integrationTimeout
              ? this.parentContext.config.integrationTimeout
              : MAX_INTEGRATION_LOAD_TIMEOUT;
            const timeoutHandle = setTimeout(() => {
              Logger.error(
                `Timeout loading integration. ${libConfig.name} took longer than ${integrationTimeoutValue}ms to load. Skipping.`
              ).log();
              resolve(null);
            }, integrationTimeoutValue);

            const integrationScript = document.createElement("script");

            const onIntegrationContentReady = async () => {
              (window as any).dodgeballRequire.require(
                [`integrations/${libConfig.name}`],
                () => {
                  let integrationClass: Integration;

                  integrationClass = (window as any)._dodgeball_integrations[
                    libConfig.name
                  ];

                  if (integrationClass != null) {
                    Logger.info(
                      `Integration class found for: ${libConfig.name}`
                    ).log();

                    integration = new (integrationClass as any)({
                      ...libConfig,
                      requestId,
                      parentContext: this.parentContext,
                    });

                    (async () => {
                      if (!integration.hasLoaded()) {
                        Logger.info(
                          `Loading integration dependencies: ${libConfig.name}`
                        ).log();
                        await integration.load();
                      }

                      // At this point, we know all the integration dependencies have been loaded
                      clearTimeout(timeoutHandle);

                      Logger.info(
                        `Configuring integration: ${libConfig.name}`
                      ).log();
                      await integration.configure();
                      this.loadedIntegrations[libConfig.name] = integration;
                      resolve(integration);
                    })();
                  } else {
                    Logger.error(
                      `No integration class found for: ${libConfig.name}`
                    );
                    resolve(integration);
                  }
                }
              );
            };

            if (libConfig.content.url) {
              integrationScript.src = libConfig.content.url;
              integrationScript.onload = onIntegrationContentReady;
            } else {
              integrationScript.innerHTML = `(function ({require, define, requirejs}) {${
                libConfig.content.text as string
              }}(dodgeballRequire));`;
              setTimeout(onIntegrationContentReady, 2);
            }
            document.body.appendChild(integrationScript);
          } else {
            Logger.error(`No integration content: ${libConfig.name}`).log();
            resolve(null);
          }
        } catch (error) {
          Logger.error(
            `Error loading integration: ${libConfig.name}`,
            error
          ).log();
          resolve(null);
        }
      };

      return new Promise((resolve, reject) => {
        if (this.isRequireLoaded) {
          _loadIntegration(resolve, reject);
        } else {
          this.onRequireLoaded.push(() => {
            _loadIntegration(resolve, reject);
          });
        }
      });
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
