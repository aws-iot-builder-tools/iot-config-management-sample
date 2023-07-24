import {readFile} from 'fs/promises'
import mqtt from 'mqtt';
import {config} from './config.js';
import {Device} from "./new-device.js";
const CERTIFICATE_FILE = 'certificate.pem';
const PRIVATE_KEY_FILE = 'private-key.pem';

const main = async (config) => {
    config.clientId = config.clientId || 'CM-Test';
    const policyName = config.policyName;
    if (config.shouldCreateThingAndIdentity) {
        const device = new Device({thingName: config.clientId, policyName: policyName});
        //These calls are idempotent.
        await device.createThing();
        await device.createIdentity();
    }

    runSimulator(config)
        .then(async () => {
            console.info(' [Main] Started');
        })
        .catch(err => console.log('[Main] ', err));
};

const runSimulator = async (config) => {
    const ops = {
        host: config.iotEndpoint,
        protocol: "mqtts",
        clientId: config.clientId,
        clean: true,
        key: await content(PRIVATE_KEY_FILE),
        cert: await content(CERTIFICATE_FILE),
        reconnectPeriod: 0,
        enableTrace: false
    };
    const client = mqtt.connect(ops);
    client.on('connect', (packet) => {
        console.log('Connected');
        client.subscribe(`devices/${config.clientId}/config_req`, (err) => {
            if (err) {
                console.log(`[Simulator] Error on subscribe for ${config.clientId}`);
            } else {
                console.log(`[Simulator] Subscribe successful for ${config.clientId}`);
            }
        })
    })
    client.on('message', (topic, message) => {
        const cmd = JSON.parse(message.toString());
        console.log('[Simulator] Message received: ', cmd);
        if (cmd?.name === 'SET_TEMP' && cmd?.type === 'REQ') {
            console.log('[Simulator] Executing temperature change to: ', cmd.value);
            setTimeout(async () => {
                const replyEvent = {
                    name: 'SET_TEMP',
                    type: 'RESP',
                    operationId: cmd.operationId,
                    status: 'SUCCESS', //success
                    value: cmd.value || 'N/A',
                    error: 0,
                    timestamp: Date.now()
                }
                console.log('[Simulator] Publishing Response: ');
                client.publish(`devices/${config.clientId}/config_resp`, JSON.stringify(replyEvent), {qos: 1},
                    (error, packet) => {
                        console.log('[Simulator] PUB Callback with packet', packet);
                    })

            }, 10 * 1000);
        }
    })
    client.on('disconnected', async () => {
        console.info('[Simulator] Disconnected');
    });
    client.on('error', (error) => {
        console.log(error)
    })
}

const content = async (path) => {
    return await readFile(path, 'utf8')
}

await main(config);