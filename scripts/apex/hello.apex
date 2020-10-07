System.debug('Invoking MyFunction');

    functions.Function myFunction = functions.Function.get('sfdcImgProcessing');
    functions.FunctionInvocation invocation = myFunction.invoke('{"fileId": "0681g000000oHCTAA2" , "recordId": "0011g00000pm9MfAAI"}');
    String jsonResponse = invocation.getResponse();

    System.debug('Response from MyFunction ' + jsonResponse);