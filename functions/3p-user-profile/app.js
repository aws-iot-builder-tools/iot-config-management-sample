import {round, random} from 'mathjs';

export const lambdaHandler = async (event) => {
    const thingName = event.thingName;
    const externalId = event.thing.Attributes.externalId;
    console.log(event);

    if (thingName && externalId) {
        //Here we randomize a temp value, simulating a third party call.
        const desiredTemperature = getRandomNumber(18, 25, 2);
        console.log('[3PartyUserProfile] Desired Temperature: ', desiredTemperature);
        return {
            sessionId: event.sessionIdentifier,
            thingName: event.thingName,
            desiredTemperature: desiredTemperature,
        }
    }
    throw new Error('Missing thing name or external id.');
}
const roundCustom = (number, decimalPlaces) => Number(round(number, decimalPlaces));
const getRandomNumber = (min, max, decimals) => {
    return roundCustom((random() * (max - min)) + min, decimals);
}