import {
    IExecutionIntegration,
    IntegrationName,
    IntegrationPurpose,
    IStepResponse,
    IVerificationContext,
    IVerificationStep,
    VerificationErrorType
} from "../types";
import { Logger } from "../logger"
import Integration from "./Integration"
import {cleanupNodes, NodeCleanupMethod, popupModal} from "../utilities"

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

export enum MfaChannelType {
    PHONE = "PHONE",
    EMAIL = "EMAIL",
}

export enum MfaClientOperation{
    CANCEL = 'CANCEL',
    RESEND = 'RESEND',
    AUTHORIZE_MFA_CHANNEL = 'AUTHORIZE_MFA_CHANNEL',
    CLIENT_AUTHORIZATION = 'CLIENT_AUTHORIZATION',
    GET_TOKEN='GET_TOKEN',
    TOKEN_RESPONSE = 'TOKEN_RESPONSE'
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
        inputElement.value = initialText
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
        Logger.trace(
            "About to format authorization",
            {config: this.config}
        ).log()

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
            ()=>{return cleanupNodes(rootElement, parent)},
            responseConsumer);})

        this.adjoinButtons(parent, [cancelButton, authorizeButton])
    }

    formatResendCode(parent: HTMLElement,
                  rootElement: HTMLElement,
                  responseConsumer: (stepResponse:IStepResponse)=>Promise<any>){
        let configs = this.config as IMfaConfig

        let cancelButton = this.createButton(
            "Cancel",
            ()=>{
                return this.onCancel(
                    rootElement,
                    responseConsumer);})

        let resendCodeButton = this.createButton(
            "Resend Code",
            ()=>{return this.onResend(
                rootElement,
                responseConsumer);})

        this.adjoinButtons(parent, [cancelButton, resendCodeButton])
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
            "Submit Token",
            ()=>{return this.onGetCode(
                textInput,
                rootElement,
                responseConsumer);})

        this.adjoinButtons(parent, [cancelButton, resendCodeButton, submitCodeButton])
    }

    async onCancel(modal: HTMLElement,
                   responseConsumer: (stepResponse:IStepResponse)=>Promise<any>):Promise<void>{
        let wasSuccessful = false
        let response = {
            pluginName: "MFA",
            methodName: MfaClientOperation.CANCEL,
        }

        try {
            await responseConsumer(response)
            wasSuccessful = true
        } catch (error) {
            Logger.error("Error in cancel", error).log()
        }

        if (wasSuccessful) {
            MfaIntegration.removeModal()
        }
    }

    public async onAuthorize(
        radioBoxes: HTMLInputElement[],
        cleanupMethod: NodeCleanupMethod | null,
        responseConsumer: (stepResponse:IStepResponse)=>Promise<any>):Promise<void>{
        Logger.trace("Authorize").log()

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
                methodName: MfaClientOperation.CLIENT_AUTHORIZATION,
                data: {
                    authorizedChannelId: selectedId
                }
            }
            let response = await responseConsumer(stepResponse)
            Logger.trace("Callback response", {response: response}).log()
        }

        MfaIntegration.removeModal()
        popupModal(
            MfaIntegration.getModal,
            (modal, rootElement) =>
                this.formatResendCode(modal, rootElement, responseConsumer))
    }

    public async onResend(
        modal: HTMLElement,
        responseConsumer: (stepResponse:IStepResponse)=>Promise<any>):Promise<void> {
        let wasSuccessful = false
        let response = {
            pluginName: "MFA",
            methodName: MfaClientOperation.RESEND,
        }

        try {
            await responseConsumer(response)
            wasSuccessful = true
        } catch (error) {
            // TO DO: display this error
            Logger.error("Response Consumer", error).log()
        }

        if (wasSuccessful) {
            MfaIntegration.removeModal()
        }
    }

    public async onGetCode(
        codeInput: HTMLInputElement,
        modal: HTMLElement,
        responseConsumer: (stepResponse:IStepResponse)=>Promise<any>):Promise<void>{
        try {
            Logger.trace("onGetCode").log()
            let inputText = codeInput.value

            let config = this.config as IMfaConfig
            let numChars = config.numChars ?? 6

            let wasSuccessful = false
            if (inputText && inputText.length == numChars) {
                let response = {
                    pluginName: "MFA",
                    methodName: MfaClientOperation.TOKEN_RESPONSE,
                    data: {
                        token: inputText
                    }
                }

                try {
                    await responseConsumer(response)
                    wasSuccessful = true
                } catch (error) {
                    // TO DO: display this error
                    Logger.error("On Get Code", error).log()
                }
            }

            if (wasSuccessful) {
                MfaIntegration.removeModal()
            }
        }
        catch(error){
            Logger.error("onGetCode error", error).log()
        }
    }

    public static async getModal():Promise<HTMLElement>{
        // This follows a double-checked locking idiom, required
        // since the inner await may result in a thread transition
        if(!MfaIntegration.modalElement){
            let newElement = await document.createElement('div');

            // Absent an await execution is blocking, so no lock is needed
            if(!MfaIntegration.modalElement){
                MfaIntegration.modalElement = newElement
            }
        }

        return MfaIntegration.modalElement as HTMLElement
    }

    public static async removeModal(){
        Logger.trace("RemoveModal called").log()
        if(MfaIntegration.modalElement){
            let modal = MfaIntegration.modalElement
            MfaIntegration.modalElement = null;
            await document.body.removeChild(modal)
        }
    }

    public async execute(
        step: IVerificationStep,
        context: IVerificationContext,
        responseConsumer: (response: IStepResponse)=>Promise<any>): Promise<any> {
        Logger.trace("Mfa.Execute", {step: step}).log()
        try {
            let typedConfig: IMfaConfig = step.config as IMfaConfig
            switch(step.method) {
                case MfaClientOperation.AUTHORIZE_MFA_CHANNEL:

                    popupModal(
                        MfaIntegration.getModal,
                        (modal, rootElement) =>
                        this.formatAuthorization(modal, rootElement, responseConsumer))
                    break;

                case MfaClientOperation.GET_TOKEN:
                    MfaIntegration.removeModal()

                    popupModal(
                        MfaIntegration.getModal,
                        (modal, rootElement) => {
                        this.formatGetCode(modal, rootElement, responseConsumer)
                    })
                    break;

                default:
                    throw Error(`Unknown operation: ${step.method}`)
            }
        } catch (error) {
            context.onError({
                errorType: VerificationErrorType.SYSTEM,
                details: error as string
            });
        }
    }

    public async load() {
        Logger.error(
            "Loading MFA Integration, which is not executable from an external element"
        ).log()
    }
}
