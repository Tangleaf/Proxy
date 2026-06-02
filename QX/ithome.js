/**
 * IT之家去广告
 * 
 * @author 奶思
 * @since 2026-06-01 18:17:00
 * 
 * 
 * =========== QuanX ===========
 [rewrite_local]
 ^https:\/\/napi\.ithome\.com\/api\/(news\/index|topmenu\/getfeeds) url script-response-body https://raw.githubusercontent.com/Tangleaf/Proxy/main/QX/ithome.js
 ^https:\/\/napi\.ithome\.com\/api\/news\/indexv2\/iphone\/927 url script-response-body https://raw.githubusercontent.com/Tangleaf/Proxy/main/QX/ithome.js

 [mitm]
 hostname = napi.ithome.com
 */

const url = $request.url;
if (!$response.body) $done({});

let obj = JSON.parse($response.body);

// 首页信息流
if (
  url.includes("/api/news/index") ||
  url.includes("/api/topmenu/getfeeds")
) {
  if (obj?.data?.list?.length > 0) {

    obj.data.list = obj.data.list.filter((item) => {

      // 过滤带“广告”标签的信息流
      if (
        item?.feedContent?.smallTags?.some(
          (i) => i?.text?.includes("广告")
        )
      ) {
        return false;
      }

      // 不再过滤 10002 / 10003
      // 这样首页轮播图会保留

      return true;
    });
  }
}

// 618 广告
if (url.includes("/api/news/indexv2/iphone/927")) {
  if (obj?.data?.list?.length > 0) {
    obj.data.list = obj.data.list.filter(
      (item) => item?.feedType !== 10004
    );
  }
}

$done({ body: JSON.stringify(obj) });