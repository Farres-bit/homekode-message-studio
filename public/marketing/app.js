(function(){
"use strict";
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

/* team */
var TEAM=[
 ["Brand & Partnerships","Guarding the brand","Closing 2 influencer briefs","Eid partner posts going live"],
 ["Catalogue Manager","Website & Shopify","12 new arrivals live","Marble collection re-merchandised"],
 ["Interior Designer","Styling & lookbooks","Eid styled set shot","Shop-the-look bundle ready"],
 ["Graphic Designer","Creative","Eid reel + 5 grid posts","White Friday key visual next"],
 ["Marketing Executive","Campaigns & scheduling","Grid scheduled to Sun","Pulling weekly report"]
];
document.getElementById("teamgrid").innerHTML=TEAM.map(function(m){
  return '<div class="member"><div class="role">'+esc(m[0])+'</div><div class="who">'+esc(m[1])+'</div>'+
    '<ul><li>'+esc(m[2])+'</li><li>'+esc(m[3])+'</li></ul></div>';
}).join("");

/* influencer pipeline */
var STAGES=["Prospect","Negotiating","Agreed","Content live","Paid"];
var DEALS=[
 ["@sara.homestyle","Prospect","51K","Home decor","—","—"],
 ["@dubai.interiors","Prospect","88K","Interiors","—","—"],
 ["@lodging.dxb","Negotiating","62K","Lifestyle","1 reel + 2 stories","AED 3,500"],
 ["@cozy.abode","Negotiating","34K","Home","3 stories","AED 1,200"],
 ["@the.villa.edit","Agreed","120K","Luxury home","1 reel + grid","AED 6,000"],
 ["@nadia.nests","Content live","47K","Family home","2 posts (code NADIA10)","AED 2,400"],
 ["@homewithlina","Paid","73K","Interiors","1 reel (code LINA10)","AED 3,000"]
];
(function(){
  var wrap=document.getElementById("pipe");
  wrap.innerHTML=STAGES.map(function(st){
    var inSt=DEALS.filter(function(d){return d[1]===st;});
    var cards=inSt.map(function(d){
      return '<div class="deal"><b>'+esc(d[0].replace("@",""))+'</b> <span class="h">'+esc(d[0])+'</span>'+
        '<div class="m">'+esc(d[2])+' followers · '+esc(d[3])+'</div>'+
        (d[5]!=="—"?'<div class="m">'+esc(d[5])+'</div>':'')+'</div>';
    }).join("")||'<div class="m" style="color:var(--muted);font-size:11.5px">—</div>';
    return '<div class="pcol"><h4>'+esc(st)+'<span>'+inSt.length+'</span></h4>'+cards+'</div>';
  }).join("");
})();
(function(){
  var h='<table><thead><tr><th>Influencer</th><th>Followers</th><th>Niche</th><th>Stage</th><th>Deliverables</th><th>Cost</th><th>Result</th></tr></thead><tbody>';
  var RES={"@nadia.nests":"92K reach · 14 orders","@homewithlina":"140K reach · 22 orders"};
  DEALS.forEach(function(d){
    var stChip=d[1]==="Paid"?"c-ok":d[1]==="Content live"?"c-accent":d[1]==="Agreed"?"c-web":"c-muted";
    h+='<tr><td><b class="mono" style="color:var(--ig)">'+esc(d[0])+'</b></td><td>'+esc(d[2])+'</td><td>'+esc(d[3])+'</td>'+
       '<td><span class="chip '+stChip+'">'+esc(d[1])+'</span></td><td>'+esc(d[4])+'</td><td>'+esc(d[5])+'</td>'+
       '<td style="color:var(--muted)">'+(RES[d[0]]||"—")+'</td></tr>';
  });
  document.getElementById("inftable").innerHTML=h+'</tbody></table>';
})();

/* IG grid + queue */
var IG=[
 ["Evalina Sofa Chair","hero","🛋️","#EA D9CE|#DCC3B4","Scheduled"],
 ["Styled living room","room","🏡","#E9E3DA|#C9BCAE","Scheduled"],
 ["@nadia.nests UGC","ugc","🤝","#EBD9CE|#C9AE9B","Posted"],
 ["Terracotta Bench","hero","🛋️","#E5CDBE|#CBA88F","Drafting"],
 ["Bedroom refresh","room","🏡","#DCD6CA|#BFB4A2","Idea"],
 ["Eid gathering reel","reel","🎬","#C9A98F|#A9542F","Scheduled"],
 ["Marble console","hero","🛋️","#E7E2D8|#C6BDAC","Idea"],
 ["Curtain lookbook","room","🏡","#E3DACD|#C2B49E","Drafting"],
 ["@homewithlina collab","ugc","🤝","#EAD7CC|#C6A78F","Posted"]
];
document.getElementById("iggrid").innerHTML=IG.map(function(p){
  var g=p[3].split("|");
  return '<div class="igcell" style="background:linear-gradient(150deg,'+g[0]+','+g[1]+')"><span class="k">'+p[2]+'</span>'+esc(p[0])+'</div>';
}).join("");
(function(){
  var h='<table><thead><tr><th>Post</th><th>Type</th><th>Status</th></tr></thead><tbody>';
  var SC={Posted:"c-ok",Scheduled:"c-accent",Drafting:"c-warn",Idea:"c-muted"};
  IG.forEach(function(p){
    var ty=p[1]==="reel"?"🎬 Reel":p[1]==="ugc"?"🤝 UGC":p[1]==="room"?"🏡 Lifestyle":"🛋️ Product";
    h+='<tr><td><b>'+esc(p[0])+'</b></td><td>'+ty+'</td><td><span class="chip '+SC[p[4]]+'">'+p[4]+'</span></td></tr>';
  });
  document.getElementById("igqueue").innerHTML=h+'</tbody></table>';
})();

/* calendar */
var CAL=[
 ["Jun 2026","Eid Al Adha — \"A home to gather in\"","Summer Living refresh"],
 ["Jul 2026","Summer Sale — cooling neutrals","Back-to-Home (villa moves)"],
 ["Aug 2026","New Season preview","Interior design services push"],
 ["Sep 2026","Autumn collection launch","UAE 60-day countdown teasers"],
 ["Oct 2026","Diwali — warmth & light","Homeowner styling series"],
 ["Nov 2026","White Friday — the big one","Gifting guide build-up"],
 ["Dec 2026","National Day · Year-end gifting","2027 lookbook reveal"]
];
document.getElementById("calbody").innerHTML=CAL.map(function(r){
  return '<div class="calrow"><div class="mo">'+esc(r[0])+'</div><div><span class="camp">'+esc(r[1])+'</span><span class="camp">'+esc(r[2])+'</span></div></div>';
}).join("");

/* approvals */
var APPR=[
 ["🎬","Eid teaser reel","Graphic Designer · due today","c-warn","Due today"],
 ["🤝","@lodging.dxb collab brief","Partnerships · AED 3,500","c-accent","Deal"],
 ["🖼️","White Friday key visual","Graphic Designer · concept","c-muted","Concept"],
 ["🛋️","Marble collection carousel","Catalogue · 6 products","c-muted","Ready"]
];
document.getElementById("apprbody").innerHTML=APPR.map(function(a,i){
  return '<div class="appr"><div class="ic">'+a[0]+'</div>'+
    '<div><div style="font-weight:600">'+esc(a[1])+'</div><div class="sub" style="font-size:12.5px">'+esc(a[2])+'</div></div>'+
    '<div style="display:flex;gap:8px;align-items:center"><span class="chip '+a[3]+'">'+esc(a[4])+'</span>'+
    '<button class="btn btn-gh" data-a="back">Send back</button><button class="btn btn-ok" data-a="ok">Approve</button></div></div>';
}).join("");
document.getElementById("apprbody").addEventListener("click",function(e){
  var b=e.target.closest("button[data-a]"); if(!b)return;
  var row=b.closest(".appr"); var badge=row.querySelector(".chip");
  if(b.getAttribute("data-a")==="ok"){badge.className="chip c-ok";badge.textContent="Approved ✓";}
  else{badge.className="chip c-crit";badge.textContent="Sent back";}
  row.querySelectorAll("button[data-a]").forEach(function(x){x.style.display="none";});
});

/* performance bars */
(function(){
  var data=[["Jan",118,64],["Feb",132,70],["Mar",149,78],["Apr",141,74],["May",166,86],["Jun",182,95]];
  var max=200;
  document.getElementById("revbars").innerHTML=data.map(function(d){
    var h=Math.round(d[1]/max*100);
    return '<div class="bar" style="height:'+h+'%"><span>'+d[1]+'</span><em>'+d[0]+'</em></div>';
  }).join("");
})();

/* merch feed */
var MERCH=[
 ["🆕","New arrival","Varenzo Walnut Center Shelf TV Unit","2m"],
 ["✅","Back in stock","Evalina Mulberry Sofa Chair","20m"],
 ["🔻","Price drop","Graciell Terracotta Bench · 1,522 → 1,450 AED","1h"],
 ["⛔","Sold out","Arched Brass Mirror","3h"],
 ["📦","Collection updated","Marble & Stone · 6 pieces added","5h"]
];
document.getElementById("merchfeed").innerHTML=MERCH.map(function(e){
  return '<div class="ev"><div class="ic">'+e[0]+'</div><div><div class="t">'+e[1]+'</div><div class="d">'+esc(e[2])+'</div></div><div class="d" style="white-space:nowrap">'+e[3]+'</div></div>';
}).join("");

/* swatches */
var SW=[["Terracotta","#A9542F"],["Warm ink","#1F1C17"],["Cream ground","#F4F1EC"],["Sand line","#E3DDD3"],["Sage (success)","#2E7355"]];
document.getElementById("swatches").innerHTML=SW.map(function(s){
  return '<div class="swatch"><div class="box" style="background:'+s[1]+'"></div><div class="n">'+esc(s[0])+'</div><div class="h">'+s[1]+'</div></div>';
}).join("");

/* nav + theme */
var nav=document.getElementById("nav");
nav.addEventListener("click",function(e){
  var b=e.target.closest("button[data-v]"); if(!b)return;
  Array.prototype.forEach.call(nav.querySelectorAll("button"),function(x){x.setAttribute("aria-current",x===b?"true":"false");});
  Array.prototype.forEach.call(document.querySelectorAll(".view"),function(v){v.classList.remove("on");});
  document.getElementById("v-"+b.dataset.v).classList.add("on");
  window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("tog").addEventListener("click",function(){
  var r=document.documentElement, cur=r.getAttribute("data-theme");
  if(!cur){cur=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
  r.setAttribute("data-theme",cur==="dark"?"light":"dark");
});
})();
