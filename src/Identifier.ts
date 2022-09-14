import Cookies from "js-cookie";
import { IIdentifierIntegration, IFingerprint } from "./types";
import {
  sendGetSourceToken,
  attachSourceTokenMetadata,
  getMd5,
} from "./utilities";
import { Logger } from "./logger";

export interface IIdentifierProps {
  cookiesEnabled: boolean;
  apiUrl: string;
  apiVersion: string;
  publicKey: string;
  clientUrl?: string;
}

export default class Identifier {
  publicKey: string;
  apiUrl: string;
  apiVersion: string;
  cookieName: string = "_dodgeballId";
  cookiesEnabled: boolean = true;

  constructor({
    cookiesEnabled,
    apiUrl,
    apiVersion,
    publicKey,
    clientUrl,
  }: IIdentifierProps) {
    this.cookiesEnabled = cookiesEnabled;
    this.apiUrl = apiUrl;
    this.apiVersion = apiVersion;
    this.publicKey = publicKey;

    this.cookieName = `_db-${getMd5([this.publicKey, this.apiUrl])}`;
  }

  public getSource(): { token: string; expiry: number } | null {
    let sourceStr = null;

    if (this.cookiesEnabled) {
      sourceStr = Cookies.get(this.cookieName);
    } else if (typeof window !== "undefined" && window.localStorage) {
      sourceStr = window.localStorage.getItem(this.cookieName);
    }

    if (sourceStr != null) {
      try {
        const source = JSON.parse(sourceStr);

        if (source.expiry > Date.now()) {
          return source;
        } else {
          this.saveSource(null); // If the source is no longer valid, remove it
          return null;
        }
      } catch (e) {
        return null;
      }
    } else {
      return null;
    }
  }

  public saveSource(newSource: { token: string; expiry: number } | null) {
    if (this.cookiesEnabled) {
      if (newSource != null && newSource.token != null) {
        Cookies.set(this.cookieName, JSON.stringify(newSource), {
          expires: new Date(newSource.expiry),
          sameSite: "strict",
          secure: true,
        });
      } else {
        Cookies.remove(this.cookieName);
      }
    } else if (typeof window !== "undefined" && window.localStorage) {
      if (newSource != null && newSource.token != null) {
        window.localStorage.setItem(this.cookieName, JSON.stringify(newSource));
      } else {
        window.localStorage.removeItem(this.cookieName);
      }
    }
  }

  public async gatherFingerprints(
    identifiers: IIdentifierIntegration[]
  ): Promise<IFingerprint[]> {
    const fingerprints: IFingerprint[] = [];

    for (const identifier of identifiers) {
      try {
        const fingerprint: IFingerprint = await identifier.identify();
        if (fingerprint) {
          fingerprints.push(fingerprint);
        }
      } catch (error) {
        Logger.error("Error gathering fingerprints", error).log();
      }
    }

    return fingerprints;
  }

  public async generateSourceToken(identifiers: IIdentifierIntegration[]) {
    const fingerprints = await this.gatherFingerprints(identifiers);

    const source = this.getSource();

    // Submit the fingerprints to the API
    const newSource = await sendGetSourceToken({
      url: this.apiUrl as string,
      token: this.publicKey,
      version: this.apiVersion,
      sourceToken: source ? source.token : null,
      fingerprints: fingerprints,
    });

    // Set the sourceToken cookies / localStorage
    this.saveSource(newSource);

    return newSource;
  }

  public async saveSourceTokenMetadata(
    sourceToken: string,
    identifiers: IIdentifierIntegration[]
  ): Promise<{ [key: string]: any }> {
    let metadata: { [key: string]: any } = {};

    // Loop through the identifiers and extract their metadata
    if (identifiers) {
      for (const identifier of identifiers) {
        let integrationMetadata = await identifier.getMetadata();
        if (Object.keys(integrationMetadata.metadata).length > 0) {
          metadata[integrationMetadata.name] = integrationMetadata.metadata;
        }
      }
    }

    if (Object.keys(metadata).length > 0) {
      await attachSourceTokenMetadata({
        url: this.apiUrl as string,
        token: this.publicKey,
        version: this.apiVersion,
        sourceToken: sourceToken,
        metadata,
      });
    }

    return metadata;
  }
}
