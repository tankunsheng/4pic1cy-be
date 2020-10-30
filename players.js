
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('498998227385-cvqhp70dbea43jeifi6o7t56g5sbmsa1.apps.googleusercontent.com');

//https://developers.google.com/identity/sign-in/web/backend-auth
async function verify(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: '498998227385-cvqhp70dbea43jeifi6o7t56g5sbmsa1.apps.googleusercontent.com',
    });
    return ticket.getPayload();
}

/*
* AWS_PROFILE=kunsheng sls invoke local --function add-user --path mocks/add-user.json
* https://www.uuidgenerator.net/version4
*/
export async function add(event) {
    const data = JSON.parse(event.body);
    console.log("LOGGING");
    console.log(data);
    console.log(data.token);
    const user = await verify(data.token).catch(console.error);
    console.log(user);
    console.log(process.env.playerTableName);
    const params = {
        TableName: process.env.playerTableName,
        Item: {
            player_sub: user.sub,
            email: user.email,
            name: user.name,
            register_timestamp: Date.now()
        }
    };

    try {
        await dynamoDbLib.call("put", params);
        return success(params.Item);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}