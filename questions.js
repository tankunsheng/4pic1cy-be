
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('498998227385-cvqhp70dbea43jeifi6o7t56g5sbmsa1.apps.googleusercontent.com');

//https://developers.google.com/identity/sign-in/web/backend-auth
//Refactor into a common lambda function
async function verify(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: '498998227385-cvqhp70dbea43jeifi6o7t56g5sbmsa1.apps.googleusercontent.com',
    });
    return ticket.getPayload();
}

export async function list() {
    console.log(process.env.questionTableName);
    const params = {
        TableName: process.env.questionTableName,

    };

    try {
        const result = await dynamoDbLib.call("scan", params);
        // Return the matching list of items in response body
        return success(result.Items);
    } catch (e) {
        console.log(e);
        return failure({ status: false });
    }
}
export async function get(event) {
    console.log(process.env.blogTableName);
    console.log(event.pathParameters);
    console.log(event.pathParameters.blogid);
    const params = {
        TableName: process.env.blogTableName,
        IndexName: 'blogId-index',
        KeyConditionExpression: 'blogId = :blogId',
        ExpressionAttributeValues: {
            ':blogId': event.pathParameters.blogid
        }
    };

    try {
        const result = await dynamoDbLib.call("query", params);
        // Return the matching list of items in response body
        return success(result.Items);
    } catch (e) {
        console.log(e);
        return failure({ status: false });
    }
}

// /*
// * AWS_PROFILE=kunsheng sls invoke local --function get-qns --path mocks/get-qns.json
// */
export async function getNewQnsForPlayer(event) {
    const data = JSON.parse(event.body);
    const user = await verify(data.token).catch(console.error);
    if (!user) {
        return;
    }
    const params = {
        TableName: process.env.playerTableName,
        Key: {
            player_sub: user.sub
        }
    };

    try {
        const result = await dynamoDbLib.call("get", params);
        const qns = await getNewQuestion(result.Item.answered);
        return success(qns);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}

async function getNewQuestion(answered) {
    let params = {
        TableName: process.env.questionTableName
    };
    if (answered && answered.length > 0) {
        let exprAttrVals = {};
        const filterExprArr = answered.map((single, index) => {
            exprAttrVals[`:q${index}`] = single;
            return `qId <> :q${index}`;
        });
        const filterExpr = filterExprArr.join(' AND ');
        params = {
            TableName: process.env.questionTableName,
            FilterExpression: filterExpr,
            ExpressionAttributeValues: exprAttrVals
        };
    }

    try {
        const result = await dynamoDbLib.call("scan", params);
        const randomPos = Math.round(Math.random() * (result.Items.length - 1));
        const randomItem = result.Items[randomPos];
        return success(randomItem);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}