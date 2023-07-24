import {
    IoTClient,
    CreateThingCommand,
    CreateKeysAndCertificateCommand, AttachPolicyCommand, AttachThingPrincipalCommand
} from "@aws-sdk/client-iot";
import fs from 'fs';
import {config} from './config.js';

const CERTIFICATE_FILE = 'certificate.pem';
const PRIVATE_KEY_FILE = 'private-key.pem';
const client = new IoTClient({region: config.region});

export class Device {
    constructor(options = {}) {
        this._thingName = options.thingName;
        this._policyName = options.policyName;
    }

    get thingName() {
        return this._thingName;
    }

    //This is an idempotent call. It does not matter that the IoT thing exists already.
    async createThing() {
        console.log('[Device] Creating or Updating thing ', this.thingName);
        const command = new CreateThingCommand({
            thingName: this.thingName,
            attributePayload: {attributes: {externalId: '123'}}
        });
        return await client.send(command);
    }

    async createIdentity() {
        try {
            if (fs.existsSync(CERTIFICATE_FILE) && fs.existsSync(PRIVATE_KEY_FILE)) {
                console.log('[Device] Certificate and private key files exist');
                return true;
            } else {
                console.log('[Device] Creating key and cert for thing ', this.thingName);
            }
        } catch (err) {
            console.log('[Device] Error checking certificate and private key files', err);
        }
        const command = new CreateKeysAndCertificateCommand({setAsActive: true});
        const response = await client.send(command);
        this._storeCertificate(response);
        await this._attachPolicyToCertificate(response);
        return await this.attachCertificateToThing(response);
    }


    _storeCertificate(response) {
        fs.writeFileSync("private-key.pem", response.keyPair.PrivateKey);
        fs.writeFileSync("certificate.pem", response.certificatePem);
        return true;
    };

    async _attachPolicyToCertificate(certResponse) {
        console.log('[Device] Attaching policy to principal ', this.thingName);
        const command = new AttachPolicyCommand({policyName: this._policyName, target: certResponse.certificateArn});
        return await client.send(command);
    }

    async attachCertificateToThing(certResponse) {
        console.log('[Device] Attaching cert to thing ', this.thingName);
        const command = new AttachThingPrincipalCommand({
            thingName: this.thingName,
            principal: certResponse.certificateArn
        });
        return await client.send(command);
    }
}
