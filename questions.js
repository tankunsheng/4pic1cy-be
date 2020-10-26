
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";

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
