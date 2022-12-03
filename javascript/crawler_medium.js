const { parse } = require("node-html-parser")
const { stringify } = require("csv-stringify")
const { parse: csvParser } = require("csv-parse");
const fs = require("fs")

function getLastElementOfArray(arr) {
    return arr[arr.length - 1]
}
async function getMediumArticleDatadump(url) {

    const id = getLastElementOfArray(url.split("-"))
    const headers = {
        "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:86.0) Gecko/20100101 Firefox/86.0"
    }
    try {

        const response = await fetch(url, headers)
        const responseText = await response.text()

        const htmlParsed = parse(responseText)
        const dataElement = htmlParsed.querySelectorAll("script")
            .find(script => script.textContent.includes("__APOLLO_STATE__"))

        const prefix = "window.__APOLLO_STATE__ ="
        const articleDataString = dataElement.text.substring(prefix.length)
        const articleDataObj = JSON.parse(articleDataString)
        return { id: id, "datadump": articleDataObj, }

    } catch {
        return { id: id, "datadump": null }
    }
}

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
                console.log(`Write to ${dataSet.length} lines to file ${filename} successfully!`)
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

function getDefaultPostData(id) {
    return {
        "id": id,
        "is_deleted": true,
        "clap_count": null,
        "voter_count": null,
        "post_responses": null,
        "reading_time": null,
        "curation_status": null,
        "seo_title": null,
        "seo_description": null,
        "is_locked": null,
        "first_published_at": null,
        "latest_published_at": null,
        "image_count": null,
        "topics": null,
        "collection_name": null,
        "collection_slug": null,
        "collection_subscribers": null,
        "creator_id": null,
        "creator_follower_count": null,
        "creator_following_count": null,
        "creator_medium_member_at": null,
        "creator_ats_qualified_at": null,
        "creator_has_subdomain": null,
        "creator_country": null,
    }
}

function extractDataFromDatadump({ id, datadump }) {
    if (typeof (datadump) == "string") {
        datadump = JSON.parse(datadump)
    }
    const postKey = `Post:${id}`
    if (!datadump || !(postKey in datadump)) {
        return getDefaultPostData(id)
    }

    try {

        let postData = {
            "id": id,
            "is_deleted": false,
            "clap_count": datadump[postKey]["clapCount"],
            "voter_count": datadump[postKey]["voterCount"],
            "post_responses": datadump[postKey]["postResponses"]["count"],
            "reading_time": datadump[postKey]["readingTime"],
            "curation_status": datadump[postKey]["curationStatus"],
            "seo_title": datadump[postKey]["seoTitle"],
            "seo_description": datadump[postKey]["seoDescription"],
            "is_locked": datadump[postKey]["isLocked"],
            "first_published_at": datadump[postKey]["firstPublishedAt"],
            "latest_published_at": datadump[postKey]["latestPublishedAt"],
        }

        let image_count = 0
        for (let attr in datadump) {
            if (attr.includes("ImageMetadata")) {
                if (("originalHeight" in datadump[attr]) && (datadump[attr]["originalHeight"] != null)) {
                    image_count += 1
                }
            }
        }
        postData["image_count"] = image_count

        if (datadump[postKey]["topics"] != null) {
            const topics = datadump[postKey]["topics"]
            const topicsName = topics.map(item => item.name)
            postData["topics"] = topicsName
        } else {
            postData["topics"] = null
        }

        if (datadump[postKey]["collection"] != null) {
            const collectionKey = datadump[postKey]["collection"]["__ref"]
            postData["collection_name"] = datadump[collectionKey]["name"]
            postData["collection_slug"] = datadump[collectionKey]["slug"]
            postData["collection_subscribers"] = datadump[collectionKey]["subscriberCount"]
        } else {
            postData["collection_name"] = null
            postData["collection_slug"] = null
            postData["collection_subscribers"] = null
        }

        const creatorKey = datadump[postKey]["creator"]["__ref"]
        const creatorInfo = datadump[creatorKey]
        postData["creator_id"] = creatorInfo["id"]
        postData["creator_follower_count"] = creatorInfo["socialStats"]["followerCount"]
        postData["creator_following_count"] = creatorInfo["socialStats"]["followingCount"]
        postData["creator_medium_member_at"] = creatorInfo["mediumMemberAt"]
        postData["creator_ats_qualified_at"] = creatorInfo["atsQualifiedAt"]
        postData["creator_has_subdomain"] = creatorInfo["hasSubdomain"]

        if ("geolocation" in creatorInfo) {
            postData["creator_country"] = creatorInfo["geolocation"]["country"]
        } else {
            postData["creator_country"] = null
        }

        return postData

    } catch (e) {
        return getDefaultPostData(id)
    }
}

async function main() {
    const urlSet = [
        "https://medium.com/@ddkhoa.blogging/being-a-junior-developer-taught-me-the-important-life-lesson-8ad73582d912"
    ]
    const articleDatadumpSet = await Promise.all(urlSet.map(item => getMediumArticleDatadump(item)))
    await writeToCSV(articleDatadumpSet, "dataset/articles.csv", columns = ["id", "datadump"])
    const articleData = await readFromCSV("dataset/articles.csv")
    const articleDataFilterred = articleData.map(item => extractDataFromDatadump(item))
    console.log(articleDataFilterred)
}

main()