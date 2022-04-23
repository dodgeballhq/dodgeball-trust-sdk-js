import {
    IVerificationContext,
    IntegrationName,
    IntegrationPurpose,
    IIntegrationConfig,
    IExecutionIntegration, IStepResponse
} from "../types";

import { IQualifierIntegration } from "../types";
import Integration from "./Integration"
import {loadScript, popupModal, removeModal} from "../utilities"

export interface IMfaChannel{
    channel: string;
    target: string;
    id: string;
}

export interface IMfaConfig {
    mfaChannels: IMfaChannel[];
    tryNum? : number;
    numChars? : number
}

export enum MFAClientOperations{
    CANCEL = 'CANCEL',
    RESEND = 'RESEND',
    CLIENT_AUTHORIZATION = 'CLIENT_AUTHORIZATION',
    TOKEN_RESPONSE = 'TOKEN_RESPONSE'
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
    implements IExecutionIntegration
{
    stripeClient: any = null;
    static modalElement: HTMLElement | null = null

    constructor({ url, config, requestId  }: IMfaProps) {
        super({
            url: "",
            config: config,
            name: IntegrationName.MFA_TWILIO,
            purposes: [IntegrationPurpose.EXECUTE],
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

    private adjoinNewline(parent: HTMLElement){
        let brLabel = document.createElement('br')
        brLabel.innerHTML = `<br>`;
        parent.appendChild(brLabel)
    }

    private adjoinLabel(parent: HTMLElement, text: string){
        var label = document.createElement('label')
        label.innerHTML = text;
        parent.appendChild(label)
    }

    private adjoinTextInput(
        parent: HTMLElement,
        maxLength: number,
        initialText: string
    ):HTMLInputElement{
        var inputElement = document.createElement("input");
        inputElement.setAttribute('type', 'text');
        inputElement.textContent = initialText
        parent.appendChild(inputElement)
        return inputElement
    }

    private createButton(
        buttonText: string,
        callback: ()=>Promise<void>
    ): HTMLButtonElement{
        let button = document.createElement("button");
        button.innerHTML = buttonText;
        button.addEventListener("click", callback)
        button.style.cssText = 'background-color:#2277cc;color:white'

        return button
    }

    private adjoinButtons(parent: HTMLElement,
                   buttons: HTMLButtonElement[]) {
        let controlsContainer = document.createElement("div");
        controlsContainer.style.cssText = 'display:flex;gap:20px;padding:10px 0;'
        buttons.forEach((button)=>{
            controlsContainer.appendChild(button)
        })

        parent.appendChild(controlsContainer)
    }

    formatAuthorization(
        parent: HTMLElement,
        rootElement: HTMLElement,
        responseConsumer: (stepResponse:IStepResponse)=>Promise<any>){
        console.log("About to format authorization", this.config)
        let configs = this.config as IMfaConfig

        this.adjoinLabel(
            parent,
            'Please select a number or email to receive an authorization code: ');

        // We need the list of radio boxes in order to determine which
        // ones have been authorized to receive a code.  The first selected
        // is the only one targeted
        let channelBoxes: HTMLInputElement[] = []


        configs.mfaChannels.forEach((channel)=>{
            // For each target channel, add a selection radio box to the display
            // as well as to the list of channel boxes to check on authorize button click
            let radiobox = document.createElement('input');
            radiobox.type = 'radio';
            radiobox.id = channel.id;
            radiobox.value = `${channel.channel} ${channel.target}`;
            radiobox.innerHTML = `${channel.channel} ${channel.target}`;

            channelBoxes.push(radiobox)
            parent.appendChild(radiobox)

            this.adjoinLabel(parent, `${channel.channel} ${channel.target}`)
            this.adjoinNewline(parent)
        })

        this.adjoinNewline(parent)

        let cancelButton = this.createButton(
            "Cancel",
            ()=>{
                return this.onCancel(
                rootElement,
                responseConsumer);})

        let authorizeButton = this.createButton(
            "Authorize",
            ()=>{return this.onAuthorize(
            channelBoxes,
            rootElement,
            responseConsumer);})

        this.adjoinButtons(parent, [cancelButton, authorizeButton])
    }

    formatGetCode(parent: HTMLElement,
                  rootElement: HTMLElement,
                  responseConsumer: (stepResponse:IStepResponse)=>Promise<any>){
        let configs = this.config as IMfaConfig

        this.adjoinLabel(
            parent,
            'Please enter your authorization code: ');

        let numChars = configs.numChars ?? 6
        let initialText = "*".repeat(numChars)
        let textInput = this.adjoinTextInput(
            parent,
            numChars,
            initialText)

        this.adjoinNewline(parent)

        let cancelButton = this.createButton(
            "Cancel",
            ()=>{
                return this.onCancel(
                    rootElement,
                    responseConsumer);})

        let resendCodeButton = this.createButton(
            "Authorize",
            ()=>{return this.onResend(
                rootElement,
                responseConsumer);})

        let submitCodeButton = this.createButton(
            "Authorize",
            ()=>{return this.onGetCode(
                textInput,
                rootElement,
                responseConsumer);})

        this.adjoinButtons(parent, [cancelButton, submitCodeButton])
    }

    async onCancel(modal: HTMLElement,
                   responseConsumer: (stepResponse:IStepResponse)=>Promise<any>):Promise<void>{
        let wasSuccessful = false
        let response = {
            pluginName: "MFA",
            methodName: MFAClientOperations.CANCEL,
        }

        try {
            await responseConsumer(response)
            wasSuccessful = true
        } catch (error) {
            // TO DO: display this error
            console.error(error)
        }

        if (wasSuccessful) {
            removeModal(modal)
        }
    }

    public async onAuthorize(
        radioBoxes: HTMLInputElement[],
        modal: HTMLElement,
        responseConsumer: (stepResponse:IStepResponse)=>Promise<any>):Promise<void>{
        console.log("Authorize")

        let selectedId:string | null = null
        for(var box of radioBoxes){
            if(box.checked){
                selectedId = box.id
                break
            }
        }

        if(selectedId){
            let stepResponse = {
                pluginName: "MFA",
                methodName: MFAClientOperations.CLIENT_AUTHORIZATION,
                data: {
                    authorizedChannelId: selectedId
                }
            }
            let response = await responseConsumer(stepResponse)
            console.log("Callback response:", response)
            removeModal(modal)
        }
    }

    public async onResend(
        modal: HTMLElement,
        responseConsumer: (stepResponse:IStepResponse)=>Promise<any>):Promise<void> {
        let wasSuccessful = false
        let response = {
            pluginName: "MFA",
            methodName: MFAClientOperations.RESEND,
        }

        try {
            await responseConsumer(response)
            wasSuccessful = true
        } catch (error) {
            // TO DO: display this error
            console.error(error)
        }

        if (wasSuccessful) {
            removeModal(modal)
        }
    }

    public async onGetCode(
        codeInput: HTMLInputElement,
        modal: HTMLElement,
        responseConsumer: (stepResponse:IStepResponse)=>Promise<any>):Promise<void>{
        let inputText = codeInput.textContent
        let config = this.config as IMfaConfig
        let numChars = config.numChars ?? 6

        let wasSuccessful = false
        if(inputText && inputText.length == numChars){
            let response = {
                pluginName: "MFA",
                methodName: MFAClientOperations.TOKEN_RESPONSE,
                data: {
                    token: inputText
                }
            }

            try {
                await responseConsumer(response)
                wasSuccessful = true
            }
            catch (error){
                // TO DO: display this error
                console.error(error)
            }
        }

        if(wasSuccessful) {
            removeModal(modal)
        }
    }

    public async execute(
        step: IVerificationStep,
        context: IVerificationContext,
        responseConsumer: (response: IStepResponse)=>Promise<any>): Promise<any> {
        console.log("Mfa.Execute", step)
        try {
            let typedConfig: IMfaConfig = step.config as IMfaConfig
            switch(step.method) {
                case MfaOperation.AUTHORIZE_MFA_CHANNEL:
                    console.log("About to popup")
                    popupModal((modal, rootElement) =>
                        this.formatAuthorization(modal, rootElement, responseConsumer))
                    break;

                case MfaOperation.GET_TOKEN:
                    popupModal((modal, rootElement) => {
                        this.formatGetCode(modal, rootElement, responseConsumer)
                    })
                    break;

                default:
                    throw Error(`Unknown operation: ${step.method}`)
            }
        } catch (error) {
            context.onError(error as string);
        }
    }

    public async load() {
        console.log("Loading MFA Integration, which is not executable from an external element")
    }
}
