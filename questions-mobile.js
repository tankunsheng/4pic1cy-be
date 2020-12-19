
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
import {addQnsAnsweredInPlayer} from "./questions.js";

// /*
// * AWS_PROFILE=kunsheng sls invoke local --function check-ans-mobile --path mocks/check-answer-mobile.json
// */
export async function checkAnswer(event) {
    const data = JSON.parse(event.body);
    let playerId = data.playerId;
    const params = {
        TableName: process.env.questionTableName,
        Key: {
            qId: data.qId
        }
    };
    try {
        const result = await dynamoDbLib.call("get", params);
        if (result.Item.answer === data.answer) {
            const updateResult = await addQnsAnsweredInPlayer(playerId, data.qId);
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
// * AWS_PROFILE=kunsheng sls invoke local --function get-qns-mobile --path mocks/get-qns-mobile.json
// */
export async function getNewQnsForPlayer(event) {
    const data = JSON.parse(event.body);
    let params  = {
        TableName: process.env.playerTableName,
        Key: {
            player_sub: data.playerId
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
        delete randomItem["answer"];
        return success(randomItem);
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

