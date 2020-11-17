
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

// /*
// * AWS_PROFILE=kunsheng sls invoke local --function check-ans --path mocks/check-answer.json
// */
export async function checkAnswer(event) {
    const data = JSON.parse(event.body);
    const user = await verify(data.token).catch(console.error);
    if (!user) {
        return;
    }
    // user.sub
    const params = {
        TableName: process.env.questionTableName,
        Key: {
            qId: data.qId
        }
    };
    try {
        const result = await dynamoDbLib.call("get", params);
        if (result.Item.answer === data.answer) {
            const updateResult = await addQnsAnsweredInPlayer(user.sub, data.qId);
            console.log(updateResult);
            return updateResult.statusCode === 200 ? success({ result: true, msg: "correct answer!" }) : failure({ result: false, msg: "error occurred" });
        } else {
            return success({ result: false, msg: "wrong answer!" });
        }
    } catch (e) {
        console.log(e);
        return failure({ status: e });
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
        console.log(`SUB IS ${user.sub}`);
        console.log(`RESULT ${result.Item}`);
        console.log(`RESULT ANSWERED ${result.Item.answered}`);
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
        delete randomItem["answer"];
        return success(randomItem);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}
async function addQnsAnsweredInPlayer(player_sub, qId) {
    let params = {
        TableName: process.env.playerTableName,
        Key: {
            player_sub: player_sub
        },
        UpdateExpression: 'set #answered = list_append(if_not_exists(#answered, :empty_list), :qId)',
        ExpressionAttributeNames: {
            '#answered': 'answered'
        },
        ExpressionAttributeValues: {
            ':qId': [qId],
            ':empty_list': []
        }
    };
    try {
        await dynamoDbLib.call("update", params);
        return success(true);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}
export async function getQnsById(qId) {
    const params = {
        TableName: process.env.questionTableName,
        Key: {
            qId: qId
        }
    };
    try {
        const question = await dynamoDbLib.call("get", params);
        return success(question.Item);
    } catch (e) {
        //return the e msg instead
        console.log(e);
        return failure({ status: e });
    }
}

