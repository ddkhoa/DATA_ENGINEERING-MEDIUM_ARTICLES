import requests
from bs4 import BeautifulSoup
import json
import pandas as pd
import ast


def default_post_data(id):
    def_post_data = {
        "id": id,
        "is_deleted": True,
        "clap_count": None,
        "voter_count": None,
        "post_responses": None,
        "reading_time": None,
        "curation_status": None,
        "seo_title": None,
        "seo_description": None,
        "is_locked": None,
        "first_published_at": None,
        "latest_published_at": None,
        "image_count": None,
        "topics": None,
        "collection_name": None,
        "collection_slug": None,
        "collection_subscribers": None,
        "creator_id": None,
        "creator_follower_count": None,
        "creator_following_count": None,
        "creator_medium_member_at": None,
        "creator_ats_qualified_at": None,
        "creator_has_subdomain": None,
        "creator_country": None,
    }

    return def_post_data


def parse_post_data(id: str, object: dict):

    key = f"Post:{id}"
    if object is None or key not in object:
        return default_post_data(id)

    try:
        postData = {
            "id": id,
            "is_deleted": False,
            "clap_count": object[key]["clapCount"],
            "voter_count": object[key]["voterCount"],
            "post_responses": object[key]["postResponses"]["count"],
            "reading_time": object[key]["readingTime"],
            "curation_status": object[key]["curationStatus"],
            "seo_title": object[key]["seoTitle"],
            "seo_description": object[key]["seoDescription"],
            "is_locked": object[key]["isLocked"],
            "first_published_at": object[key]["firstPublishedAt"],
            "latest_published_at": object[key]["latestPublishedAt"],
        }

        image_count = 0
        for attr in object:
            if "ImageMetadata" in attr:
                if "originalHeight" in object[attr] and object[attr]["originalHeight"] is not None:
                    image_count += 1
        postData["image_count"] = image_count

        if object[key]["topics"] is not None:
            topics = object[key]["topics"]
            topics_name = [topic["name"] for topic in topics]
            postData["topics"] = topics_name
        else:
            postData["topics"] = None

        if object[key]["collection"] is not None:
            postData["collection_name"] = object[object[key]
                                                 ["collection"]["__ref"]]["name"]
            postData["collection_slug"] = object[object[key]
                                                 ["collection"]["__ref"]]["slug"]
            postData["collection_subscribers"] = object[object[key]
                                                        ["collection"]["__ref"]]["subscriberCount"]
        else:
            postData["collection_name"] = None
            postData["collection_slug"] = None
            postData["collection_subscribers"] = None

        creator = object[key]["creator"]["__ref"]
        creatorInfo = object[creator]
        postData["creator_id"] = creatorInfo["id"]
        postData["creator_follower_count"] = creatorInfo["socialStats"]["followerCount"]
        postData["creator_following_count"] = creatorInfo["socialStats"]["followingCount"]
        postData["creator_medium_member_at"] = creatorInfo["mediumMemberAt"]
        postData["creator_ats_qualified_at"] = creatorInfo["atsQualifiedAt"]
        postData["creator_has_subdomain"] = creatorInfo["hasSubdomain"]
        if "geolocation" in creatorInfo:
            postData["creator_country"] = creatorInfo["geolocation"]["country"]
        else:
            postData["creator_country"] = None

        return postData

    except Exception as e:
        print(e)
        return default_post_data(id)


def get_medium_article_info(article_url: str):

    id = article_url.split("-")[-1]
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:86.0) Gecko/20100101 Firefox/86.0"}

    try:
        response = requests.get(article_url, headers=headers)
        soup = BeautifulSoup(response.text, "html.parser")

        script = soup.find(
            "script", text=lambda text: text and "window.__APOLLO_STATE__" in text)
        object = script.text[len("window.__APOLLO_STATE__ = "):]
        return {"datadump": json.loads(object), "id": id}

    except Exception as e:
        print(e)
        return {"datadump": None, "id": id}


def main(nb_article_to_crawl=10000):
    df_treated = pd.read_csv(
        "./dataset/medium_articles_add_info_4.csv", usecols=['title'])
    start = len(df_treated.index)
    print(f"Start from: {start}. Crawl: {nb_article_to_crawl} articles")
    end = start + nb_article_to_crawl
    write_header = True if start == 0 else False

    df = pd.read_csv("./dataset/medium_articles.csv")
    article_list = df.to_dict("records")
    article_list = article_list[start:end]
    for index, article in enumerate(article_list):
        print(index)
        info = get_medium_article_info(article['url'])
        article_list[index].update(info)

    df_result = pd.DataFrame.from_dict(article_list)
    df_result = df_result[["id", "title", "authors",
                           "url", "tags", "text", "datadump"]]
    df_result.index = range(start, end, 1)
    df_result.to_csv("./dataset/medium_articles_add_info_4.csv",
                     mode='a', header=write_header)


def fix_data(test_mode=False, reparse_all_data=False):

    df = pd.read_csv("./dataset/medium_articles_add_info_4.csv")
    unnamed_columns = [col for col in df if 'Unnamed' in col]
    df.drop(columns=unnamed_columns, inplace=True)

    df_treated = pd.read_csv(
        "./dataset/medium_articles_add_info_5.csv", usecols=['title'])

    output_file = "./dataset/medium_articles_add_info_5.csv"
    start = len(df_treated.index)
    end = len(df.index)
    mode = "a"
    if test_mode:
        output_file = "./dataset/medium_articles_add_info_test.csv"
        start = 0
        end = 1000
        mode = "w"
    if reparse_all_data:
        start = 0
        mode = "w"

    write_header = True if start == 0 else False

    print(f"Parse data from: {start} to {end}")
    article_list = df.to_dict("records")[start:end]
    for index, article in enumerate(article_list):
        print(index)
        datadump = None
        if type(article['datadump']) == float:
            pass
        else:
            datadump = ast.literal_eval(article["datadump"])
        info = parse_post_data(article['id'], datadump)
        article_list[index].update(info)

    df_result = pd.DataFrame.from_dict(article_list)
    df_result.drop(columns=["datadump"], inplace=True)
    df_result.index = range(start, end, 1)

    df_result.to_csv(output_file, mode=mode, header=write_header, sep=",")


main()
fix_data()
