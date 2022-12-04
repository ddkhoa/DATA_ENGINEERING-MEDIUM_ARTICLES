const { parse } = require("node-html-parser")
const { XMLParser } = require("fast-xml-parser");
const { readFromCSV, writeToCSV, generateDateRange, formatDate } = require("./helper");

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

    } catch (e) {
        console.log(e)
        return { id: id, "datadump": null }
    }
}

function getDefaultPostData(id) {
    return {
        "id": id,
        "title": null,
        "medium_url": null,
        "tags": null,
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
        "creator_name": null,
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
            "title": datadump[postKey]["title"],
            "medium_url": datadump[postKey]["mediumUrl"],
            "tags": datadump[postKey]["tags"].map(item => item.__ref.split(":")[1]),
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
        postData["creator_name"] = creatorInfo["name"]
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
        console.log(e)
        return getDefaultPostData(id)
    }
}

async function getArticlesUrlFromSitemapByDateRange(startDate, endDate) {

    const dateRange = generateDateRange(startDate, endDate)
    const articlesUrl = await Promise.all(
        dateRange.map(async date => await getArticlesUrlFromSitemapByDate(date))
    )
    const articlesUniqueUrls = [... new Set(articlesUrl.flat())]
    console.debug(`Get ${articlesUniqueUrls.length} urls from medium site map from ${formatDate(startDate)} to ${formatDate(endDate)}`)
    await writeToCSV(articlesUniqueUrls, "dataset/articles_url.csv", columns = ["url"])

    return articlesUniqueUrls.map(item => item.url)
}

async function getArticlesUrlFromSitemapByDate(date) {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const dateInMonth = date.getDate()
    const monthPadded = month.toString().padStart(2, '0')
    const dateInMonthPadded = dateInMonth.toString().padStart(2, '0')

    const sitemapUrl = `https://medium.com/sitemap/posts/${year}/posts-${year}-${monthPadded}-${dateInMonthPadded}.xml`

    const response = await fetch(sitemapUrl)
    const responseText = await response.text()

    const parser = new XMLParser();
    const dataParsed = parser.parse(responseText);
    const articlesUrl = dataParsed.urlset.url.filter(item => item.priority >= 0.5).map(item => ({ url: item.loc }))

    console.debug(`Get ${articlesUrl.length} urls from medium site map on ${formatDate(date)}`)
    return articlesUrl
}

async function main() {

    const start = (new Date()).setDate((new Date()).getDate() - 2)
    const end = (new Date()).setDate((new Date()).getDate() - 1)
    const urls = await getArticlesUrlFromSitemapByDateRange(new Date(start), new Date(end))

    const chunkSize = 5
    let articlesDatadump = []
    for (let i = 0; i < urls.length; i = i + chunkSize) {
        console.debug(`Get datadump from ${i} to ${i + chunkSize}`)
        const urlsChunk = urls.slice(i, i + chunkSize)
        const articlesDatadumpChunk = await Promise.all(urlsChunk.map(item => getMediumArticleDatadump(item)))
        articlesDatadump.push(...articlesDatadumpChunk)
    }
    await writeToCSV(articlesDatadump, "dataset/articles_datadump.csv", columns = ["id", "datadump"])
    const articlesDataParsed = articlesDatadump.map(item => extractDataFromDatadump(item))
    await writeToCSV(articlesDataParsed, "dataset/articles_dataparsed.csv", columns = Object.keys(getDefaultPostData("1")))
}

main()