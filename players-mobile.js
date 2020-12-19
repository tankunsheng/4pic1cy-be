// Player operations that are meant to be called by mobile clients only

import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
import { getQnsById } from "./questions.js";
import { newHintForPlayerByQns } from "./players.js";

/*
* AWS_PROFILE=kunsheng sls invoke local --function add-player-mobile --path mocks/add-player-mobile.json
* https://www.uuidgenerator.net/version4
*/
export async function add(event) {
    const data = JSON.parse(event.body);
    const params = {
        TableName: process.env.playerTableName,
        Item: {
            player_sub: data.id,
            email: data.email,
            name: data.name,
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

// /*
// * AWS_PROFILE=kunsheng sls invoke local --function get-player-mobile --path mocks/get-user-mobile.json
// */
export async function get(event) {
    const data = event.pathParameters;
    const params = {
        TableName: process.env.playerTableName,
        Key: {
            player_sub: data.playerId
        }
    };
    try {
        const player = await dynamoDbLib.call("get", params);
        return success(player.Item);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}

//  sls invoke local --function get-hint --path mocks/get-user-qns-hint-uuid.json
export async function getHint(event) {
    const resp = await get(event);
    const player = JSON.parse(resp.body);
    const qId = event.pathParameters.qId;
    const isNew = event.pathParameters.new;

    const qnsResp = await getQnsById(qId);
    const question = JSON.parse(qnsResp.body);
    if (player.hints && player.hints[qId] !== undefined) {
        const unlockedHintPos = player.hints[qId];
        return success({
            "success": true,
            "hint": question.answer[unlockedHintPos],
            "pos": unlockedHintPos
        });
    } else if (isNew === "true") {
        const hintResp = await newHintForPlayerByQns(player.player_sub, question);
        return success(hintResp);
    } else {
        return success({
            "success": false
        });
    }
}


/*
* AWS_PROFILE=kunsheng sls invoke local --function transfer-progress-mobile --path mocks/transfer-progress-mobile.json
*/
export async function transferProgress(event) {
    const resp = await get(event); // temp id
    const oldUserAcct = JSON.parse(resp.body);
    const data = JSON.parse(event.body);
    const params = {
        TableName: process.env.playerTableName,
        Key: {
            player_sub: data.playerId //new playerId
        },
        UpdateExpression: 'set #answered = :answered, #hints = :hints',
        ExpressionAttributeNames: {
            '#answered': 'answered',
            '#hints': 'hints'
        },
        ExpressionAttributeValues: {
            ':answered': oldUserAcct.answered || [],
            ':hints': oldUserAcct.hints || {}
        }
    };
    try {
        await dynamoDbLib.call("update", params);
        //delete old player record
        const deleteParams = {
            TableName: process.env.playerTableName,
            Key: {
                player_sub: oldUserAcct.player_sub
            }
        };
        await dynamoDbLib.call("delete", deleteParams);
        return success({
            "success": true
        });
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ "success": true, status: e });
    }
}
