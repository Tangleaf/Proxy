/* IT之家首页：轮播优先保留版 v2
   完整保留所有包含 focusNewsData 的条目（不管 feedType/flag），
   只过滤无轮播数据且明确标记的普通广告条目。
*/
(() => {
  if (!$response || !$response.body || !/^https:\/\/napi\.ithome\.com\/api\/topmenu\/getfeeds\?/i.test($request.url || "")) return $done({});
  let obj;
  try { obj = JSON.parse($response.body); } catch (_) { return $done({}); }
  if (!Array.isArray(obj?.data?.list)) return $done({});
  const list=obj.data.list;
  const filtered=list.filter(item=>{
    if (!item || typeof item !== "object") return true;
    // 广告标记有时属于轮播容器，优先保留整个轮播容器和内部内容。
    if (item.feedType===10002 || item.feedType===10003 || Array.isArray(item.feedContent?.focusNewsData)) return true;
    if (item.feedType===10004 || item.feedContent?.flag===2) return false;
    return !Array.isArray(item.feedContent?.smallTags) || !item.feedContent.smallTags.some(t=>t?.text==="广告");
  });
  if (filtered.length===list.length) return $done({});
  obj.data.list=filtered;
  $done({body:JSON.stringify(obj)});
})();
