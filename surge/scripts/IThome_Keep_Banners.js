/*
 * IT之家首页保留轮播图 · Surge 适配
 * 修复：完整保留 feedType=10002 轮播容器及其 focusNewsData
 * 普通信息流：过滤明确标记广告的条目
 * 来源参考：fkingikelee/fkikelee 的公开 IT之家去广告脚本
 */
(() => {
  if (!$response || !$response.body) return $done({});
  const url = $request.url || "";
  // 当前仅对首页 feed 列表做安全处理，其他接口原样返回。
  if (!/^https:\/\/napi\.ithome\.com\/api\/topmenu\/getfeeds\?/i.test(url)) return $done({});
  let obj;
  try { obj = JSON.parse($response.body); }
  catch (e) { return $done({}); }
  if (!Array.isArray(obj?.data?.list)) return $done({});

  const list = obj.data.list;
  const clean = list.filter(item => {
    if (!item || typeof item !== "object") return true;
    // 轮播图完整保留，避免展示图被误判为广告而被清空。
    if (item.feedType === 10002) return true;
    // 不主动移除置顶文章 feedType=10003。
    if (item.feedType === 10004 || item.feedContent?.flag === 2) return false;
    const tags = item.feedContent?.smallTags;
    if (Array.isArray(tags) && tags.some(t => t && t.text === "广告")) return false;
    return true;
  });
  if (clean.length === list.length) return $done({});
  obj.data.list = clean;
  console.log("[IT之家保留轮播图] 清理普通信息流广告：" + (list.length - clean.length));
  $done({body: JSON.stringify(obj)});
})();
