
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('498998227385-cvqhp70dbea43jeifi6o7t56g5sbmsa1.apps.googleusercontent.com');
import { getQnsById } from "./questions.js";
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
// /*
// * AWS_PROFILE=kunsheng sls invoke local --function get-user --path mocks/get-user.json
// */
export async function get(event) {
    // console.log(event);
    const data = event.pathParameters;
    // console.log(data);
    const user = await verify(data.token).catch(console.error);
    // console.log(`user is ${user}`);
    const params = {
        TableName: process.env.playerTableName,
        Key: {
            player_sub: user.sub
        }
    };
    try {
        const player = await dynamoDbLib.call("get", params);
        // console.log(player);
        return success(player.Item);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}

// /*
// * AWS_PROFILE=kunsheng sls invoke local --function list-player-highscores
// */
export async function listPlayerHighscores(event) {
    const params = {
        TableName: process.env.playerTableName,
        AttributesToGet: [
            'username',
            'answered',
            'name',
            'hints'
        ]
    };
    try {
        const players = await dynamoDbLib.call("scan", params);
        const results = players.Items.map(eachPlayer => {
            console.log(eachPlayer);
            return {
                name: eachPlayer.name,
                username: eachPlayer.username,
                score: eachPlayer.answered ? eachPlayer.answered.length : 0,
                hints: eachPlayer.hints ? Object.keys(eachPlayer.hints).length : 0
            };
        });
        results.sort((first, second) => {
            if (second.score === first.score) {
                return first.hints - second.hints;
            }
            return second.score - first.score;
        });
        console.log(results);
        return success(results);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}
//  sls invoke local --function get-hint --path mocks/get-user-qns-hint.json
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
* AWS_PROFILE=kunsheng sls invoke local --function add-review --path mocks/add-review.json
* https://www.uuidgenerator.net/version4
*/
export async function addReview(event) {
    const data = JSON.parse(event.body);
    const user = await verify(data.token).catch(console.error);
    if (!user) {
        return;
    }
    const params = {
        TableName: process.env.playerTableName,
        Key: {
            player_sub: user.sub
        },
        UpdateExpression: 'set #review = :review, #rating = :rating',
        ExpressionAttributeNames: {
            '#review': 'review',
            '#rating': 'rating'
        },
        ExpressionAttributeValues: {
            ':review': data.review,
            ':rating': data.rating
        }
    };

    try {
        await dynamoDbLib.call("update", params);
        return success({
            "success": true
        });
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ "success": true, status: e });
    }
}

async function newHintForPlayerByQns(playerSub, question) {
    const randomPos = Math.floor(Math.random() * (3 - 0 + 1) + 0);
    const createEmptyObjectInHintField = {
        TableName: process.env.playerTableName,
        Key: {
            player_sub: playerSub
        },
        UpdateExpression: 'set #hints = if_not_exists(#hints, :empty_object)',
        ExpressionAttributeNames: {
            '#hints': 'hints'
        },
        ExpressionAttributeValues: {
            ':empty_object': {}
        }
    };
    try {
        await dynamoDbLib.call("update", createEmptyObjectInHintField);
        const hintPosToQID = {
            TableName: process.env.playerTableName,
            Key: {
                player_sub: playerSub
            },
            UpdateExpression: "SET hints.#qId = :pos",
            ExpressionAttributeNames: { "#qId": question.qId },
            ExpressionAttributeValues: { ":pos": randomPos },
            ConditionExpression: "attribute_not_exists(hints.#qId)",
        };
        await dynamoDbLib.call("update", hintPosToQID);
        return {
            "success": true,
            "hint": question.answer[randomPos],
            "pos": randomPos
        };
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}