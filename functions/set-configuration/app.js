import {IoTDataPlaneClient, PublishCommand} from "@aws-sdk/client-iot-data-plane";
import {v4 as uuid} from "uuid";

const client = new IoTDataPlaneClient({});
const encoder = new TextEncoder();

export const lambdaHandler = async (event) => {
    console.log('[SetConfiguration]', {event: event});
    if (event.thingName) {
        return await pubTempRequest(event);
    } else {
        throw new Error('Invalid request')
    }
}

const pubTempRequest = async (event) => {
    const thingName = event.thingName;
    const topic = `devices/${thingName}/config_req`;
    const tempValue = event.desiredTemperature;
    const payload = {
        operationId: event.sessionIdentifier || uuid(),
        name: 'SET_TEMP',
        type: 'REQ',
        value: tempValue,
        timestamp: Date.now()
    }
    const command = new PublishCommand({
        topic: topic,
        qos: 1,
        retain: false,
        payload: encoder.encode(JSON.stringify(payload))
    });
    const response = await client.send(command);
    return new Promise((resolve, reject) => {
        if (response.$metadata.httpStatusCode === 200) {
            resolve({
                operationId: payload.operationId,
                name: 'SET_TEMP',
                type: 'REQ',
                status: "SUCCESS",
                thingName: event.thingName
            });
        } else {
            reject('MQTT publish failed');
        }
    })
}