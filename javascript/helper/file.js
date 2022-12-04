const { stringify } = require("csv-stringify")
const { parse: csvParser } = require("csv-parse");
const fs = require("fs")

async function isFileExist(filename) {
    return new Promise((resolve, reject) => {
        fs.stat(filename, (error, _) => {
            if (error) {
                return resolve(false)
            }
            return resolve(true)
        })
    })
}

function writeToCSV(dataSet, filename, columns) {

    return new Promise((resolve, reject) => {
        isFileExist(filename).then(fileExist => {
            const writeStream = fs.createWriteStream(filename, { flags: "a" })
            writeStream.on('finish', () => {
                console.debug(`Write ${dataSet.length} lines to file ${filename} successfully!`)
                resolve()
            })
            const stringifier = stringify({ header: !fileExist, columns: columns })
            stringifier.pipe(writeStream)
            dataSet.forEach(row => {
                stringifier.write(row)
            })
            stringifier.end()
        })
    })
}

async function readFromCSV(filename) {

    return new Promise((resolve, reject) => {
        let rows = []
        fs.createReadStream(filename)
            .pipe(csvParser({ delimiter: ",", from_line: 1, columns: true }))
            .on("data", function (row) {
                rows.push(row);
            })
            .on("end", function () {
                resolve(rows)
            })
    })

}

module.exports = {
    readFromCSV,
    writeToCSV
}