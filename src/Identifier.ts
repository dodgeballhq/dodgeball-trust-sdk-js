import Cookies from "js-cookie";
import { Fingerprinter } from './Fingerprinter';
import {IIdentifierIntegration} from './types';
import {sendIdentifyDevice} from './utilities';

export interface IIdentifierProps {
  cookiesEnabled: boolean;
  apiUrl: string;
  apiVersion: string;
  publicKey: string;
  clientUrl: string;
}

export default class Identifier {
  publicKey: string;
  apiUrl: string;
  apiVersion: string;
  cookieName: string = "_dodgeballId";
  cookiesEnabled: boolean = true;
  fingerprinter: Fingerprinter;

  constructor({ cookiesEnabled, apiUrl, apiVersion, publicKey, clientUrl }: IIdentifierProps) {
    this.cookiesEnabled = cookiesEnabled;
    this.apiUrl = apiUrl;
    this.apiVersion = apiVersion;
    this.publicKey = publicKey;
    this.fingerprinter = new Fingerprinter(clientUrl);
  }

  public getSourceId(): string | undefined {
    if (this.cookiesEnabled) {
      return Cookies.get(this.cookieName);
    } else {
      return "";
    }
  }

  public setSourceId(newSourceId: string) {
    if (this.cookiesEnabled) {
      if (newSourceId != null && newSourceId !== "undefined") {
        Cookies.set(this.cookieName, newSourceId);
      }
    }
  }

  public async identify(identifiers: IIdentifierIntegration[]): Promise<string> {
    await this.fingerprinter.load();

    const fingerprints = await this.fingerprinter.gatherFingerprints(
      identifiers
    );

    const sourceId = this.getSourceId(); // Attempt to grab this from a cookie if enabled

    // Submit the fingerprints to the API
    const newSourceId = await sendIdentifyDevice({
      url: this.apiUrl as string,
      token: this.publicKey,
      version: this.apiVersion,
      sourceId: sourceId,
      fingerprints: fingerprints,
    }) as string;

    // Set the sourceId cookie
    this.setSourceId(newSourceId);

    return newSourceId;
  }
}
