

/*
  "verification": { 
    "id": $VERIFICATION_ID,
    "status": "REQUIRES_INPUT", 
    "outcome": "WAITING",
    "nextSteps": [ 
      {
        "id": "dsafodao230423...", // ID of the underlying workflow step
        "verificationStepId": "abe55...", // Submit this as workflowStepId
        "name": "MFA_TWILIO", // Order to start MFA operations
        "method": "AUTHORIZE_MFA_CHANNEL", // Request permission to send an MFA message to specified targets   
        "config": {
          "mfaChannels": [
              {"id": "ab...", "channel": "***-***-4021", "channelType": "phone"},
              {"id": "ac...", "channel": "f***joy@hotmail.com", "channelType": "email"},
           ],
           "tryNum": 0 // Increments on every retry
        }
      },
    ],
    */

import { IVerificationStep } from "./types";

export enum MfaChannelType {
    PHONE = "PHONE",
    EMAIL = "EMAIL",
}

export enum MfaClientOperation {
    AUTHORIZE_MFA_CHANNEL = "AUTHORIZE_MFA_CHANNEL",
    GET_TOKEN = "GET_TOKEN",
}

export interface IMfaChannel{
    id: string;
    channel: string;
    channelType: MfaChannelType;
}

export interface IMfaProps{
    mfaChannels: IMfaChannel[];
}

export default class Mfa{
    public async execute(step: IVerificationStep){
        switch (step.method) {
            case MfaClientOperation.AUTHORIZE_MFA_CHANNEL:
                await this.authorizeMfaChannel(step);
                break;
            case MfaClientOperation.GET_TOKEN:
                await this.getToken(step);
                break;

            default:
                console.warn("Unsupported MFA method", step.method);
        }
    }

    public async authorizeMfaChannel(step: IVerificationStep){
        // popup dialog for choosing MFA channel
    }

    public async getToken(step: IVerificationStep){
        // popup dialog for entering MFA code
    }

};

// authorizeMfaChannel