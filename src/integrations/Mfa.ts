import {IVerificationContext, IntegrationName, IntegrationPurpose, IIntegrationConfig} from "../types";

import { IQualifierIntegration } from "../types";
import Integration from "./Integration"
import {popupModal, removeModal  } from "../utilities"

export interface IMfaChannel{
    channel: string;
    target: string;
    id: string;
}

export interface IMfaConfig {
    mfaChannels: IMfaChannel[];
    operation: string;
    tryNum? : number;
    numChars? : number
}

import { IVerificationStep } from "../types";

export enum MfaChannelType {
    PHONE = "PHONE",
    EMAIL = "EMAIL",
}

export enum MfaOperation {
    AUTHORIZE_MFA_CHANNEL = "AUTHORIZE_MFA_CHANNEL",
    GET_TOKEN = "GET_TOKEN",
}

export interface IMfaProps{
    url:string;
    config: IMfaConfig;
    requestId: string;
}

export default class MfaIntegration
    extends Integration
    implements IQualifierIntegration
{
    stripeClient: any = null;
    static modalElement: HTMLElement | null = null

    constructor({ url, config, requestId  }: IMfaProps) {
        super({
            url: "",
            config: config,
            name: IntegrationName.MFA_TWILIO,
            purposes: [IntegrationPurpose.QUALIFY],
            requestId,
        });
    }

    public async configure() {
    }

    public async reconfigure({
                                 url,
                                 config,
                                 requestId,
                             }: IMfaProps): Promise<void> {
        this._resetConfig({ url, config, requestId });
        await this.configure();
    }

    formatAuthorization(parent: HTMLElement){
        let configs = this.config as IMfaConfig

        var label = document.createElement('label')
        label.htmlFor = 'Verifications: ';
        parent.appendChild(label)
        let channelBoxes: HTMLInputElement[] = []

        configs.mfaChannels.forEach((channel)=>{
            let radiobox = document.createElement('input');
            radiobox.type = 'radio';
            radiobox.id = channel.id;
            radiobox.value = `${channel.channel} ${channel.target}`;

            channelBoxes.push(radiobox)
            parent.appendChild(radiobox)
        })

        let newline = document.createElement('br');
        parent.appendChild(newline)

        let cancelButton = document.createElement("button");
        cancelButton.innerHTML = "Cancel";
        cancelButton.addEventListener("click", ()=>{this.onCancel(parent);})
        document.body.appendChild(cancelButton);

        let authorizeButton = document.createElement("button");
        authorizeButton.innerHTML = "Authorize";
        authorizeButton.addEventListener("click", ()=>{this.onAuthorize(
            channelBoxes,
            parent);})
        document.body.appendChild(authorizeButton);
    }

    formatGetCode(parent: HTMLElement){
        let configs = this.config as IMfaConfig

        var label = document.createElement('label')
        label.htmlFor = 'Access Code: ';
        parent.appendChild(label)

        let codeInput: HTMLInputElement = document.createElement("input");
        codeInput.setAttribute('type', 'text');

        let newline = document.createElement('br');
        parent.appendChild(newline)

        let cancelButton = document.createElement("button");
        cancelButton.innerHTML = "Cancel";
        cancelButton.addEventListener("click", ()=>{this.onCancel(parent);})
        document.body.appendChild(cancelButton);

        let authorizeButton = document.createElement("button");
        authorizeButton.innerHTML = "Authorize";
        authorizeButton.addEventListener(
            "click",
            ()=>{this.onGetCode(codeInput, parent);})
        document.body.appendChild(authorizeButton);
    }

    async onCancel(modal: HTMLElement){
        console.log("Cancel")
        removeModal(modal)
    }

    public async onAuthorize(radioBoxes: HTMLInputElement[], modal: HTMLElement){
        console.log("Authorize")
        removeModal(modal)
    }

    public async onGetCode(codeInput: HTMLInputElement, modal: HTMLElement){
        console.log("Authorize")
        removeModal(modal)
    }

    public async qualify(context: IVerificationContext): Promise<void> {
        try {

            let typedConfig: IMfaConfig = this.config as IMfaConfig
            switch(typedConfig.operation) {
                case MfaOperation.AUTHORIZE_MFA_CHANNEL:
                    popupModal((modal) => this.formatAuthorization(modal))
                    break;

                case MfaOperation.GET_TOKEN:
                    popupModal((modal) => {
                        this.formatGetCode(modal)
                    })
                    break;

                default:
                    throw Error(`Unknown operation: ${typedConfig.operation}`)
            }
        } catch (error) {
            context.onError(error as string);
        }
    }
}
