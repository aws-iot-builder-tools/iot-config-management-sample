import {SendTaskFailureCommand, SendTaskSuccessCommand, SFNClient} from "@aws-sdk/client-sfn";
import {
    DynamoDBClient,
    QueryCommand
} from '@aws-sdk/client-dynamodb';
import {unmarshall} from '@aws-sdk/util-dynamodb';

const sfnClient = new SFNClient({});
const dynamodb = new DynamoDBClient({});
const TOKENS_TABLE_NAME = process.env.TOKENS_TABLE_NAME;

/**
 * Relevant event is:
 * SET_TEMP
 * @param event
 */
export const lambdaHandler = async (event) => {
    console.log('[DeviceEvents]', {event: event});
    if (event.name && event.operationId && event.thingName) {
        const tokenResult = await query(event.operationId, event.name, event.thingName);
        console.log('Token', tokenResult);
        if (tokenResult?.token) {
            if (event.status === 'SUCCESS' || event.status === 'FAIL' ) {
                const outputParameters = {status: event.status, event: event.name, token: tokenResult.token,};
                if(event.name === "SET_TEMP") {
                    outputParameters.newTemperatureValue = event.value;
                }
                const parameters = {
                    output: JSON.stringify(outputParameters),
                    taskToken: tokenResult.token
                };
                return await sfnClient.send(new SendTaskSuccessCommand(parameters));
            } else {
                const parameters = {
                    cause: event.name,
                    error: event.name,
                    taskToken: tokenResult.token
                };
                return await sfnClient.send(new SendTaskFailureCommand(parameters));
            }
        } else {
            console.log("[DeviceEvents] Missing token, cant terminate.");
            return;
        }
    } else {
        console.log(`[DeviceEvents] Missing operationId or name in ${event}, cant terminate.`);
        return;
    }
};

const query = async (operationId, name, thingName) => {
    const queryInput = {
        ExpressionAttributeNames: {
            '#operationId': 'operationId',
            '#deviceId': 'deviceId',
            '#name': 'name',
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':operationId': {
                S: operationId
            },
            ':deviceId': {
                S: thingName
            },
            ':name': {
                S: 'SET_TEMP'
            },
            ':status': {
                S: "ACTIVE"
            }
        },
        FilterExpression: '#name=:name AND #status=:status AND #deviceId=:deviceId',
        KeyConditionExpression: '#operationId = :operationId',
        TableName: TOKENS_TABLE_NAME
    };

    console.log('HERE', queryInput)

    const response = await dynamodb.send(new QueryCommand(queryInput));
    console.log('RESPONSE', response);
    if (response.Count === 0) {
        console.log(`[DeviceEvents] OperationId: ${operationId}, error: No ACTIVE Entry found for ${name} and ${operationId} and ${thingName}.`);
        return;
    } else if (response.Items && (response.Count === 1)) {
        const item = unmarshall(response.Items[0]);

        const {
            operationId,
            token,
            name,
            deviceId,
            status
        } = item;

        const taskExecution = {
            operationId,
            name,
            deviceId,
            status,
            token
        };
        console.log('[DeviceEvents] QueryByOperationId', {taskExecution: taskExecution});
        return taskExecution;
    } else {
        //Error.
        console.error('[DeviceEvents]  QueryByOperationId', {
            operationId: operationId,
            error: `More than one entry on Query for ${name} and ${operationId} and ${thingName}.`
        });
        return;
    }
}