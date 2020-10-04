const sdk = require("@salesforce/salesforce-sdk");
const fetch = require("node-fetch");
const jimp = require("jimp");

/**
 * Describe ImgProcessFn here.
 *
 * The exported method is the entry point for your code when the function is invoked.
 *
 * Following parameters are pre-configured and provided to your function on execution:
 * @param event:   represents the data associated with the occurrence of an event, and
 *                 supporting metadata about the source of that occurrence.
 * @param context: represents the connection to Evergreen and your Salesforce org.
 * @param logger:  logging handler used to capture application logs and traces specific
 *                 to a given execution of a function.
 */
module.exports = async function (event, context, logger) {
    logger.info(
        `Invoking ImgProcessFn with payload ${JSON.stringify(
            event.data.fileId || {}
        )}`
    );
    const results = await context.org.data.query(
        "SELECT Id, FileType, PathOnClient,VersionData,Title FROM ContentVersion WHERE Id = '" +
            event.data.fileId +
            "'"
    );
    const requestUrl = context.org.baseUrl + results.records[0].VersionData;
    const headers = JSON.parse(JSON.stringify(event.headers));
    let buff = Buffer.from(headers['ce-sffncontext'][0], 'base64');  
    let tokenResponse = JSON.parse(buff.toString('utf-8'));

    const requestOptions = {
        method: 'GET',
        headers: {"Authorization": "Bearer " + tokenResponse.accessToken},
        redirect: 'follow'
    };

    response = await fetch(requestUrl, requestOptions);
    const buffer = await response.buffer();
    const image = await jimp.read(buffer);
    // Resize the image to width 150 and heigth 150.
    const resizedImage = image.rotate(90);
    //const resizedImage = image.greyscale();

    resizedImage.getBase64(jimp.AUTO, async (err, src) => {
        await uploadProcessedImage(
            event.data.recordId,
            results.records[0].Title,
            src,
            context,
            logger
        );
    });

    return "";
};

function removeBase64Padding(base64) {
    const base64Constant = "base64,";
    const base64ImageValue =
        base64.indexOf(base64Constant) + base64Constant.length;
    return base64.substring(base64ImageValue).slice(0, -1);
}

async function uploadProcessedImage(recordId, name, base64, context, logger) {
    // Init UnitOfWork
    const uow = context.org.unitOfWork;
    // Create ContentVersion
    let cv = new sdk.SObject("ContentVersion");
    cv.setValue("VersionData", removeBase64Padding(base64));
    cv.setValue("Title", `resizedImage_${name}`);
    cv.setValue("PathOnClient", "./resizedImage.jpeg");
    cv.setValue("FirstPublishLocationId", recordId);
    uow.registerNew(cv);

    // Commit transaction
    const response = await uow.commit();

    if (response.success) {
        //logger.info(JSON.stringify(response.Id));
    } else {
        const errMsg = `Failed to commit Unit of Work. Root cause: ${response.rootCause}`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }
}