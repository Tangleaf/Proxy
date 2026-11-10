// Surge native binary response adapter for Umetrip (independent conservative port)
// Based on the publicly published Egern module and its source logic.
// Supports selected advertisement payloads; intentionally leaves unknown schema intact.
(() => {
  try {
    if ($response.status !== 200 || !($response.body instanceof Uint8Array)) return $done({});
    const input = $response.body;
    const enc = new TextEncoder(), dec = new TextDecoder();
    function varint(a, p) {
      let v=0, shift=0, i=p;
      while(i<a.length && shift<=49) {const b=a[i++];v+=(b&127)*Math.pow(2,shift);if(!(b&128))return {v,p:i};shift+=7;}
      return null;
    }
    function writeVarint(n) {const a=[];while(n>=128){a.push((n%128)|128);n=Math.floor(n/128);}a.push(n);return new Uint8Array(a);}
    function concat(parts) {let n=0;for(const p of parts)n+=p.length;const out=new Uint8Array(n);let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length;}return out;}
    function parse(a) {
      try {const fields=[];let p=0;
        while(p<a.length){const start=p, tag=varint(a,p);if(!tag)return null;p=tag.p;
          const field=Math.floor(tag.v/8),wire=tag.v%8;if(!field||![0,1,2,5].includes(wire))return null;
          let data;
          if(wire===0){const t=varint(a,p);if(!t)return null;p=t.p;}
          else if(wire===1){p+=8;}else if(wire===5){p+=4;}
          else {const t=varint(a,p);if(!t)return null;p=t.p;if(p+t.v>a.length)return null;data=a.slice(p,p+t.v);p+=t.v;}
          if(p>a.length)return null;fields.push({field,wire,data,raw:a.slice(start,p),dirty:false});
        }return fields;
      }catch(e){return null;}
    }
    function serialize(fields){const chunks=[];for(const f of fields){if(f.dirty&&f.wire===2){chunks.push(writeVarint(f.field*8+2),writeVarint(f.data.length),f.data);}else chunks.push(f.raw);}return concat(chunks);}
    function has(data,needle){if(!data)return false;const n=enc.encode(needle);outer:for(let i=0;i+n.length<=data.length;i++){for(let j=0;j<n.length;j++)if(data[i+j]!==n[j])continue outer;return true;}return false;}
    function hasAny(data,arr){return arr.some(s=>has(data,s));}
    function fieldText(fields,n){if(!fields)return null;for(const f of fields)if(f.field===n&&f.wire===2){try{return dec.decode(f.data);}catch(e){return null;}}return null;}
    function prune(data,predicate,depth=0){
      if(depth>12)return {data,count:0};const fields=parse(data);if(!fields)return {data,count:0};
      let count=0,dirty=false;const kept=[];
      for(let f of fields){if(f.wire===2){const inner=parse(f.data);
          if(predicate(f,inner)){count++;dirty=true;continue;}
          if(inner){const r=prune(f.data,predicate,depth+1);if(r.count){f={...f,data:r.data,dirty:true};count+=r.count;dirty=true;}}
        }kept.push(f);}
      return {data:dirty?serialize(kept):data,count};
    }
    function editField7(bytes,fn){const fields=parse(bytes);if(!fields)return {data:bytes,count:0};let changed=false,count=0;
      for(const f of fields){if(f.field===7&&f.wire===2){const r=fn(f.data);if(r.count){f.data=r.data;f.dirty=true;changed=true;count+=r.count;}}}
      return {data:changed?serialize(fields):bytes,count};
    }
    function cleanJson(data,mine){
      let s;try{s=dec.decode(data);}catch(e){return {data,count:0};}
      if(!/^[\s]*[\[{]/.test(s))return {data,count:0};
      let obj;try{obj=JSON.parse(s);}catch(e){return {data,count:0};}
      const rank=new Set(['风景榜','盘旋榜','延误榜','准点榜','到达榜']);
      const unwanted=new Set(['礼金中心','票券权益','特价专区']);
      const labels=['title','name','caption','tabName','tabTitle','displayName','text'];
      let count=0;
      function walk(node,depth){if(depth>24||!node||typeof node!=='object')return;
        if(Array.isArray(node)){for(let i=node.length-1;i>=0;i--){const v=node[i];const txt=v&&typeof v==='object'?labels.map(k=>v[k]).filter(x=>typeof x==='string'):[];
            const remove=txt.some(t=>rank.has(t)||(mine&&unwanted.has(t)))||(mine&&v&&v.cardType==='PRODUCT');
            if(remove){node.splice(i,1);count++;}else walk(v,depth+1);
          }return;}
        if(mine&&node.groupId===111402&&Array.isArray(node.children)){const before=node.children.length;
          node.children=node.children.filter(v=>!(v&&(/会员月卡/.test(v.title||'')||/会员月卡/.test(v.sensorParam?.service_label||'')||/^商品\d+$/.test(v.sensorParam?.service_name||''))));count+=before-node.children.length;
        }
        for(const k of Object.keys(node))walk(node[k],depth+1);
      }
      walk(obj,0);return count?{data:enc.encode(JSON.stringify(obj)),count}:{data,count:0};
    }
    function rewriteJson(data,mine,depth=0){if(depth>12)return {data,count:0};const fields=parse(data);if(!fields)return {data,count:0};let changed=false,count=0;
      for(const f of fields){if(f.wire!==2)continue;let r=cleanJson(f.data,mine);if(!r.count&&parse(f.data))r=rewriteJson(f.data,mine,depth+1);
        if(r.count){f.data=r.data;f.dirty=true;changed=true;count+=r.count;}}
      return {data:changed?serialize(fields):data,count};
    }
    const reqHeaders=$request.headers||{};
    const rpidKey=Object.keys(reqHeaders).find(k=>k.toLowerCase()==='rpid');
    const rpid=(rpidKey?String(reqHeaders[rpidKey]):null)||fieldText(parse(input),5);
    let result={data:input,count:0};
    if(['1000019','1420002','1120000'].includes(rpid)){
      const fields=parse(input);if(fields){for(const f of fields)if(f.field===7&&f.wire===2){f.data=new Uint8Array([10,0,16,0,32,0]);f.dirty=true;result.count++;}
        if(result.count)result.data=serialize(fields);}
    } else {
      const textTargets={
        '1000002':['机上闭门购虚拟卡片','里程积分兑换_首页右上角入口','广告兜底服务2','无行程机票直销卡片','跟着电影去旅行','回归礼包_无行程首页底部条','解锁888元隐藏优惠'],
        '1000029':['瀑布流_特价机票','瀑布流_酒店','瀑布流_租车卡片','瀑布流_权益','瀑布流_今日热议','瀑布流_城市攻略','瀑布流_景点攻略','瀑布流_附近底部跳转'],
        '1370126':['付费会员','更早历史行程待解锁'],
        '1011058':['历史行程容量剩余','付费会员'],
        '1060060':['付费会员'],
        '1100001':['我的页面-会员卡片V3','机票-31-推荐管']
      };
      const words=textTargets[rpid]||[];
      if(words.length)result=editField7(input,payload=>prune(payload,(field,inner)=>{
        const targeted=(rpid==='1000002'&&field.field===5)||(rpid==='1000029'&&field.field===8)||(rpid==='1370126'&&field.field===8)||(rpid==='1011058'&&field.field===11)||(rpid==='1060060'&&field.field===12)||(rpid==='1100001'&&field.field===5);
        if(!targeted)return false;
        if(rpid==='1000002'&&fieldText(inner,37)==='ADVERT')return true;
        return hasAny(field.data,words);
      }));
      const extra=editField7(result.data,payload=>rewriteJson(payload,rpid==='1100001'));
      result={data:extra.data,count:result.count+extra.count};
    }
    if(result.count){console.log('[Umetrip Surge] rpid='+rpid+' changed='+result.count);$done({body:result.data});}
    else $done({});
  }catch(e){console.log('[Umetrip Surge] '+e);$done({});}
})();
