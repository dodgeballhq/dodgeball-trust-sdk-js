import {IntegrationName, IntegrationPurpose, IQualifierIntegration, IVerificationContext} from '../types';

import { IObserverIntegration } from './../types';
import Integration from "./Integration";

export interface ITwilioConfig {
  serviceSid: string;
  authToken: string;
}

export interface ITwilioProps {
  url: string;
  config: ITwilioConfig;
  requestId: string;
}

export default class TwilioIntegration extends Integration implements IQualifierIntegration{
  twilioClient: any = null;
  
  constructor({ url, config, requestId }: ITwilioProps) {
    super({
      url,
      config,
      name: IntegrationName.MFA,
      purposes: [IntegrationPurpose.QUALIFY],
      requestId
    });
    console.log('twilio constructor', url, config, requestId);
  }

  public async configure() {
    console.log('twilio config');
    const _user_id = ''; // Set to the user's ID, username, or email address, or '' if not yet known.
    const _session_id = this.dodgeballRequestId; // Set to a unique session ID for the visitor's current browsing session.

    this.twilioClient = (window as any)._twilio = (window as any)._twilio || [];
    this.twilioClient.push(["_setAccount", this.config.serviceSid]);
    this.twilioClient.push(["_setUserId", _user_id]);
    this.twilioClient.push(["_setSessionId", _session_id]);
    this.twilioClient.push(["_trackPageview"]);
  }

  public async reconfigure({ url, config, requestId }: ITwilioProps): Promise<void> {
    console.log('twilio reconfig', url, config, requestId);
    this._resetConfig({ url, config, requestId });
    await this.configure();
  }

  public async qualify(context: IVerificationContext): Promise<any> {
     
  }

  // public observe(sourceId: string) {

  //   console.log('Twilio observer', arguments);

  //   // Once we have a sourceId, we can send it to twilio.
  //   const _user_id = sourceId;

  //   console.log('Twilio observe', _user_id);

  //   if (this.twilioClient) {
  //     this.twilioClient.push(["_setUserId", _user_id]);
  //   }
  // }
}