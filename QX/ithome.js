// IT之家：仅移除信息流广告，不移除轮播图和置顶文章

const url = $request.url;

if (!$response.body) {
  $done({});
}

let obj = JSON.parse($response.body);

if (
  url.includes("/api/news/index") ||
  url.includes("/api/topmenu/getfeeds")
) {
  if (obj?.data?.list?.length > 0) {
    obj.data.list = obj.data.list.filter(item => {
      return !item?.feedContent?.smallTags?.some(tag =>
        tag?.text?.includes("广告")
      );
    });
  }
}

$done({
  body: JSON.stringify(obj)
});