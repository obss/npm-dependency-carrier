module.exports.chunkArray=function (myArray, arrayCount) {
    let arrayLength = myArray.length;
    let tempArray = [];
    let chunk_size = Math.ceil(arrayLength / arrayCount);
    for (let index = 0; index < arrayLength; index += chunk_size) {
        let myChunk = myArray.slice(index, index + chunk_size);
        tempArray.push(myChunk);
    }
    return tempArray;
}
