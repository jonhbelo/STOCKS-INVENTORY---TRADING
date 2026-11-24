/** RPI Inventory v1.4 - Google Apps Script web app (serves index.html + server API).
 *  Multi-branch: each branch (warehouse) has its own Google Sheet. The user list lives
 *  in the HOME branch sheet (ACCOUNTS tab) and is shared by all branches.
 *  Transfers between branches are written to the TRANSFERS tab of both sheets:
 *  an OUT row in the sending branch and an IN row (same id) in the receiving branch.
 *  Deploy: Deploy > New deployment > Web app > Execute as: Me,
 *          Who has access: Anyone within riteproducts.com.ph. See DEPLOY.md. */
var BRANCHES = {
  manila: {name: 'Manila Branch', id: '1l2tvgEsEHUN8--eFF3tT-MncJ2SKct6YZdyHN8cBoLs'},  // INVENTORY SYSTEM - TRADING - MANILA BRANCH
  cebu:   {name: 'Cebu Branch',   id: '1E-cTYqib8mErxa01eDcq8-5SCmn-zs9LyGhcfGZeIYQ'}   // INVENTORY SYSTEM - TRADING - CEBU BRANCH
};
var HOME = 'manila';   // the sheet that holds ACCOUNTS
/** Keep equal to VER in index.html. Pages left open on an older version see a "Reload" banner. */
var APP_VER = '1.4';
function appUrl(){ try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }
var W = {products:5, rr:10, dr:10, rs:8, cn:8, pending:10, ad:9, tf:10};
var TX = ['rr','dr','rs','cn','ad'];
var DATA = ['products','rr','dr','rs','cn','pending','ad','tf'];
/** TRANSFERS columns: id, no, date, dir (OUT or IN), branch (the other branch), code, qty, by, ts, note */
/** DR columns I and J: status ("VOID" when cancelled) and void_note. A void DR keeps its number but no longer reduces stock. */
var TF_HEAD = ['id','no','date','dir','branch','code','qty','by','ts','note'];
/** ACCOUNTS columns sent to the page: A-F plus I (branches). G-H (old password data) are never read. */
var ACC_COLS = [1,2,3,4,5,6,9];

/** Company-only access: the visitor's Google account must be @riteproducts.com.ph.
 *  Works with Deploy > Who has access: "Anyone within riteproducts.com.ph". */
var DOMAIN = 'riteproducts.com.ph';
function viewer(){ return String(Session.getActiveUser().getEmail() || '').toLowerCase(); }
function companyOk(){ var e = viewer(); return e.slice(-(DOMAIN.length + 1)) === '@' + DOMAIN; }
function denied(){
  var e = viewer();
  return HtmlService.createHtmlOutput(
    '<div style="font:16px system-ui,sans-serif;max-width:460px;margin:15vh auto;padding:24px;text-align:center">' +
    '<h2>Access restricted</h2><p>RPI Inventory is only for <b>@' + DOMAIN + '</b> accounts.</p>' +
    '<p style="color:#667085">' + (e ? 'You are signed in to Google as ' + e.replace(/[<>&"]/g, '') + '.' : 'You are not signed in with a company Google account.') +
    ' Switch to your company account and reload this page.</p></div>')
    .setTitle('Access restricted')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
/** Finds the page file even if it was named "Index" or "index.html" in the editor. */
function page(){
  var names = ['index', 'Index', 'index.html', 'Index.html', 'INDEX'];
  for (var i = 0; i < names.length; i++) {
    try { return HtmlService.createHtmlOutputFromFile(names[i]); } catch (e) {}
  }
  return HtmlService.createHtmlOutput(
    '<div style="font:16px system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:24px">' +
    '<h2>Setup needed: page file missing</h2>' +
    '<p>In the Apps Script editor, click <b>+</b> next to Files, choose <b>HTML</b>, and name it <b>index</b> ' +
    '(type only <code>index</code>, not <code>index.html</code>). Paste all of index.html into it and save.</p>' +
    '<p>Then go to <b>Deploy &rarr; Manage deployments &rarr; Edit &rarr; Version: New version &rarr; Deploy</b>.</p></div>');
}
function doGet(){
  if (!companyOk()) return denied();
  return page()
    .setTitle('RPI Inventory System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
/** Called from the page via google.script.run.api({a:..., br:'manila'|'cebu', ...}).
 *  No passwords or tokens: the user is the company Google account Apps Script reports. */
function api(q){
  if (!companyOk()) return {error: 'Access restricted to @' + DOMAIN + ' accounts.'};
  try { return go(q || {}); }
  catch (x) { return {error: String(x && x.message || x)}; }
}

/* ---------- sheets (one spreadsheet per branch) ---------- */
var TABS = {products:['products'], rr:['rr'], dr:['dr'], rs:['reservations','rs'], cn:['consumables','cn'], accounts:['accounts'], pending:['pending aproval','pending approval','pending'], ad:['assembly','assembled / disassembled','assembled-disassembled'], tf:['transfers','transfer']};
var _books = {};
function sheetsOf(b){ return _books[b] || (_books[b] = SpreadsheetApp.openById(BRANCHES[b].id).getSheets()); }
function sh(n, b){
  b = n === 'accounts' ? HOME : b;
  if (!BRANCHES[b]) throw 'Unknown branch: ' + b;
  var all = sheetsOf(b), names = TABS[n] || [String(n).toLowerCase()];
  for (var j=0;j<names.length;j++) for (var i=0;i<all.length;i++) if (all[i].getName().toLowerCase()===names[j]) return all[i];
  throw 'Sheet tab not found in ' + BRANCHES[b].name + ': ' + n;
}
function rd(n, b){
  var s = sh(n, b), l = s.getLastRow();
  if (!l) return [];
  if (n === 'accounts'){
    var v = s.getRange(1, 1, l, 9).getDisplayValues();
    return v.map(function(r, i){ var o = ACC_COLS.map(function(c){ return r[c-1]; }); if (i === 0) o[6] = 'branches'; return o; });
  }
  return s.getRange(1,1,l,W[n]).getDisplayValues();
}
function ck(n, b){ return 'd_' + (n === 'accounts' ? HOME : b) + '_' + n; }
function rdc(n, b){
  var c = CacheService.getScriptCache(), k = ck(n, b), j = c.get(k);
  if (j) return JSON.parse(j);
  var v = rd(n, b); try { c.put(k, JSON.stringify(v), 300); } catch (e) {}
  return v;
}
function dirty(n, b){ CacheService.getScriptCache().remove(ck(n, b)); }
function cell(v){ return typeof v === 'string' ? (v === '' ? '' : "'" + v) : v; }

/* ---------- users and branch access ---------- */
function acc(id){
  id = String(id||'').trim().toLowerCase();
  if (!id) return null;
  var v = sh('accounts').getDataRange().getValues();
  for (var i=1;i<v.length;i++){ var r=v[i];
    if (String(r[0]).toLowerCase()===id || String(r[1]).toLowerCase()===id)
      return {row:i+1,email:String(r[0]).toLowerCase(),username:String(r[1]),name:String(r[2]),role:String(r[3]),active:String(r[4]).toUpperCase(),branches:String(r[8]||'')}; }
  return null;
}
/** Branch keys a user may open. Admins: all. Others: the ACCOUNTS "branches" column
 *  (e.g. "manila", "cebu", "manila,cebu" or "all"); empty means the HOME branch. */
function userBranches(a){
  var all = Object.keys(BRANCHES);
  if (a.role === 'admin') return all;
  var raw = String(a.branches || '').toLowerCase();
  if (raw.indexOf('all') >= 0) return all;
  var list = raw.split(/[^a-z]+/).filter(function(k){ return BRANCHES[k]; });
  return list.length ? list.filter(function(k, i){ return list.indexOf(k) === i; }) : [HOME];
}
function pickBranch(u, want){
  var list = userBranches(u);
  return list.indexOf(want) >= 0 ? want : list[0];
}
function me(a, b){
  var o = {email:a.email, username:a.username, name:a.name, role:a.role, branch:b,
           branches: userBranches(a).map(function(k){ return {id:k, name:BRANCHES[k].name}; }),
           all: Object.keys(BRANCHES).map(function(k){ return {id:k, name:BRANCHES[k].name}; }),
           ver: APP_VER, url: appUrl()};
  if (a.role === 'admin' && b) o.sheet = 'https://docs.google.com/spreadsheets/d/' + BRANCHES[b].id + '/edit';
  return o;
}
function bundle(u, b, only){
  var o = {me: me(u, b)};
  (only || DATA.concat('accounts')).forEach(function(n){
    if (n==='accounts' && u.role!=='admin') { o[n]=[]; return; }
    if (n==='pending' && u.role==='viewer') { o[n]=[]; return; }
    try { o[n] = rdc(n, b); } catch (e) { if (n==='ad') o[n]=[]; else if (n==='tf') o[n]=[TF_HEAD]; else throw e; }
  });
  return o;
}
/** First visit by a company account: add it to ACCOUNTS (first account ever = admin, others = viewer, HOME branch). */
function enroll(e){
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var a = acc(e); if (a) return a;
    var local = e.split('@')[0], base = local.replace(/[^a-z0-9._]/g, '').slice(0, 17), n = 1;
    while (base.length < 3) base += '_';
    var un = base; while (acc(un)) un = base + (++n);
    var nm = local.split(/[._-]+/).filter(String).map(function(w){ return w[0].toUpperCase() + w.slice(1); }).join(' ') || local;
    var s = sh('accounts'), first = s.getLastRow() < 2;
    s.getRange(s.getLastRow()+1, 1, 1, 6).setValues([[e, un, nm, first ? 'admin' : 'viewer', 'TRUE', new Date().toISOString().slice(0,10)].map(cell)]);
    dirty('accounts');
    return acc(e);
  } finally { lock.releaseLock(); }
}
function need(){
  var e = viewer(), C = CacheService.getScriptCache(), k = 'u_' + e, j = C.get(k), a = j ? JSON.parse(j) : null;
  if (!a){ a = acc(e) || enroll(e); C.put(k, JSON.stringify(a), 120); }
  if (a.active === 'FALSE') throw 'Your account is disabled. Ask an admin to reactivate it.';
  return a;
}
/** ONE-TIME CLEANUP: run this once from the Apps Script editor (select it, click Run)
 *  to erase the old password salts and hashes (columns G and H of the ACCOUNTS tab). */
function wipePasswordHashes(){
  var s = sh('accounts'), l = s.getLastRow();
  if (l > 1) s.getRange(2, 7, l - 1, 2).clearContent();
  dirty('accounts');
  Logger.log('Cleared password data for ' + Math.max(l - 1, 0) + ' accounts.');
}

/* ---------- data helpers ---------- */
function delId(s, id){ var v = s.getRange(1,1,Math.max(s.getLastRow(),1),1).getValues(); for (var i=v.length-1;i>0;i--) if (String(v[i][0])===id) s.deleteRow(i+1); }
function insProducts(s, rows){
  var last = s.getLastRow(), cur = last>1 ? s.getRange(2,1,last-1,5).getValues() : [], seen = {}, added = 0;
  cur.forEach(function(r){ seen[String(r[1]).toUpperCase()] = 1; });
  rows.forEach(function(r){
    var row = r.map(function(x){ return typeof x==='string' ? x.trim() : x; }), br = String(row[0]).toUpperCase(), key = String(row[1]).toUpperCase();
    if (!br || !key || seen[key]) return;
    seen[key] = 1; added++;
    var idx = -1; for (var i=cur.length-1;i>=0;i--) if (String(cur[i][0]).toUpperCase()===br){ idx=i; break; }
    if (idx<0) cur.push(row); else cur.splice(idx+1,0,row);
  });
  if (added) s.getRange(2,1,cur.length,5).setValues(cur.map(function(r){ return r.map(cell); }));
  return added;
}

/* ---------- router ---------- */
function go(q){
  var a = q.a, c = CacheService.getScriptCache(), lock = LockService.getScriptLock();
  if (a==='warm'){
    var wb = BRANCHES[q.br] ? q.br : HOME;
    DATA.concat('accounts').forEach(function(n){ try { rdc(n, wb); } catch (e) {} });
    return {ok:1};
  }
  var u = need(), adm = u.role==='admin', wr = adm || u.role==='editor', b = pickBranch(u, q.br);
  if (a==='data'){
    if (q.fresh) DATA.concat('accounts').forEach(function(n){ dirty(n, b); });
    return bundle(u, b, q.only);
  }
  lock.waitLock(20000);
  try {
    if (a==='add'){
      var n=q.s; if (!(W[n] && n!=='ad' && n!=='tf' && wr)) throw 'Viewers cannot change data.';
      var rows=q.rows, added=rows.length;
      if (n==='pending' && !adm) rows.forEach(function(r){ r[8]='pending'; r[9]=''; });
      var s2=sh(n, b);
      if (n==='products') added=insProducts(s2,rows);
      else if (rows.length) s2.getRange(s2.getLastRow()+1,1,rows.length,W[n]).setValues(rows.map(function(r){return r.map(cell);}));
      dirty(n, b); return {ok:1, n:added};
    }
    if (a==='asm'){
      // Assembled: item +qty (new product is created if needed), components -qty.
      // Disassembled: item -qty, components +qty. Stock is the sum of these ledger rows.
      if (!wr) throw 'Not allowed';
      var ty=q.type, it=q.item||{}, comps=q.comps||[];
      if (ty!=='Assembled' && ty!=='Disassembled') throw 'Bad type';
      var icode=String(it.code||'').trim(), iq=Number(it.qty);
      if (!icode || !(iq>0)) throw 'Enter the item and a quantity above 0.';
      if (!comps.length) throw 'Add at least one component.';
      var ps=sh('products', b), pl=ps.getLastRow(), pv=pl>1 ? ps.getRange(2,1,pl-1,5).getValues() : [], have={};
      pv.forEach(function(r){ have[String(r[1]).toUpperCase()]=1; });
      if (q.mode==='new' && have[icode.toUpperCase()]) throw 'That product code already exists. Use Existing Product.';
      if (q.mode==='existing' && !have[icode.toUpperCase()]) throw 'Product not found. Use New Product to create it.';
      if (!have[icode.toUpperCase()]){
        if (ty!=='Assembled') throw 'The item being disassembled is not in the catalog.';
        if (!String(q.brand||'').trim()) throw 'Brand is required for a new item.';
        insProducts(ps,[[String(q.brand).trim().toUpperCase(), icode, String(q.unit||'pcs').trim()||'pcs', 0, 0]]);
        dirty('products', b); have[icode.toUpperCase()]=1;
      }
      comps.forEach(function(cp){
        var k=String(cp.code).trim().toUpperCase();
        if (!have[k]) throw 'Component not in catalog: '+cp.code;
        if (k===icode.toUpperCase()) throw 'The item cannot be its own component.';
        if (!(Number(cp.qty)>0)) throw 'Bad component quantity.';
      });
      var ts=new Date().getTime(), id='ad_'+ts+'_'+Utilities.getUuid().slice(0,4), no=String(q.no||'').trim(), dt=String(q.date||'').trim();
      var arows=[[id,no,dt,ty,'item',icode,iq,u.username,ts]];
      comps.forEach(function(cp){ arows.push([id,no,dt,ty,'component',String(cp.code).trim(),Number(cp.qty),u.username,ts]); });
      var sa=sh('ad', b); sa.getRange(sa.getLastRow()+1,1,arows.length,9).setValues(arows.map(function(r){return r.map(cell);}));
      dirty('ad', b); return {ok:1, id:id};
    }
    if (a==='xfer'){
      // Transfer stock from the current branch (b) to another branch (q.to).
      // Writes OUT rows to b's TRANSFERS tab and IN rows (same id) to q.to's TRANSFERS tab.
      if (!wr) throw 'Viewers cannot transfer stock.';
      var to=String(q.to||''), items=q.items||[], tdt=String(q.date||'').trim();
      if (!BRANCHES[to]) throw 'Choose the branch to transfer to.';
      if (to===b) throw 'Choose a different branch to transfer to.';
      if (!tdt) throw 'Enter a date.';
      if (!items.length) throw 'Add at least one item.';
      var sp=sh('products', b), sl=sp.getLastRow(), src={};
      (sl>1 ? sp.getRange(2,1,sl-1,5).getValues() : []).forEach(function(r){ src[String(r[1]).toUpperCase()]={brand:String(r[0]), code:String(r[1]), unit:String(r[2])}; });
      items.forEach(function(it){
        if (!src[String(it.code||'').trim().toUpperCase()]) throw 'Not in the ' + BRANCHES[b].name + ' catalog: ' + it.code;
        if (!(Number(it.qty)>0)) throw 'Bad quantity for ' + it.code;
      });
      var stf=sh('tf', b), dtf=sh('tf', to);
      // Products the receiving branch does not carry yet are added to its catalog with 0 opening stock.
      var newp=items.map(function(it){ var p=src[String(it.code).trim().toUpperCase()]; return [p.brand, p.code, p.unit, 0, 0]; });
      if (insProducts(sh('products', to), newp)) dirty('products', to);
      var tts=new Date().getTime(), tid='tf_'+tts+'_'+Utilities.getUuid().slice(0,4), tno=String(q.no||'').trim(), note=String(q.note||'').trim();
      var outR=[], inR=[];
      items.forEach(function(it){
        var code=src[String(it.code).trim().toUpperCase()].code, qty=Number(it.qty);
        outR.push([tid,tno,tdt,'OUT',BRANCHES[to].name,code,qty,u.username,tts,note]);
        inR.push([tid,tno,tdt,'IN',BRANCHES[b].name,code,qty,u.username,tts,note]);
      });
      stf.getRange(stf.getLastRow()+1,1,outR.length,W.tf).setValues(outR.map(function(r){return r.map(cell);}));
      dtf.getRange(dtf.getLastRow()+1,1,inR.length,W.tf).setValues(inR.map(function(r){return r.map(cell);}));
      dirty('tf', b); dirty('tf', to);
      return {ok:1, id:tid};
    }
    if (a==='xdel'){
      // Admins only: removes a transfer from every branch's TRANSFERS tab, so both sides stay matched.
      if (!adm) throw 'Admins only';
      var xid=String(q.id||'');
      if (!/^tf_/.test(xid)) throw 'Bad transfer id';
      Object.keys(BRANCHES).forEach(function(k){ try { delId(sh('tf', k), xid); dirty('tf', k); } catch (e) {} });
      return {ok:1};
    }
    if (a==='updp'){
      if (!adm) throw 'Admins only';
      var pp=sh('products', b), pl2=pp.getLastRow(), codes=pl2>1 ? pp.getRange(2,2,pl2-1,1).getValues() : [], target=String(q.code).toUpperCase(), prow=-1;
      for (var pi=0;pi<codes.length;pi++) if (String(codes[pi][0]).toUpperCase()===target){ prow=pi+2; break; }
      if (prow<0) throw 'Product not found: '+q.code;
      var pv2=q.v.map(cell), pc=q.c||1; if (pc+pv2.length-1>5) throw 'Not allowed';
      pp.getRange(prow,pc,1,pv2.length).setValues([pv2]); dirty('products', b); return {ok:1};
    }
    if (a==='upd'){
      if (!adm) throw 'Admins only';
      var n2=q.s;
      if (n2==='accounts'){
        // Page columns: 4 = role, 5 = active, 7 = branches (sheet column I).
        if (q.v.length!==1 || [4,5,7].indexOf(q.c)<0) throw 'Not allowed';
        var val=String(q.v[0]);
        if (q.c===4 && ['admin','editor','viewer'].indexOf(val)<0) throw 'Bad role';
        if (q.c===5) val = /^true$/i.test(val) ? 'TRUE' : 'FALSE';
        if (q.c===7) val = val.toLowerCase().split(/[^a-z]+/).filter(function(k){ return BRANCHES[k]; }).join(',');
        var as=sh('accounts'), row=Number(q.r); if (!(row>1 && row<=as.getLastRow())) throw 'Bad row';
        as.getRange(row, ACC_COLS[q.c-1]).setValue(cell(val));
        c.remove('u_' + String(as.getRange(row,1).getValue()).toLowerCase());
        dirty('accounts'); return {ok:1};
      }
      if (!W[n2] || n2==='tf') throw 'Bad sheet';
      var v=q.v.map(cell); if (q.c+v.length-1>W[n2]) throw 'Not allowed';
      sh(n2, b).getRange(q.r,q.c,1,v.length).setValues([v]); dirty(n2, b); return {ok:1};
    }
    if (a==='void'){
      // Admins only (editors go through Approvals): mark every row of a DR as VOID.
      if (!adm) throw 'Admins only';
      if (q.s!=='dr') throw 'Only DRs can be voided.';
      var vs=sh('dr', b), vl=vs.getLastRow(), vids=vl>1 ? vs.getRange(2,1,vl-1,1).getValues() : [], vid=String(q.id), hit=0;
      var vnote='Voided by '+u.username+' on '+Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')+(q.reason ? ': '+String(q.reason).trim() : '');
      for (var vi=0;vi<vids.length;vi++) if (String(vids[vi][0])===vid){ vs.getRange(vi+2,9,1,2).setValues([['VOID', cell(vnote)]]); hit++; }
      if (!hit) throw 'DR not found. It may have been deleted.';
      dirty('dr', b); return {ok:1, n:hit};
    }
    if (a==='del' || a==='rep'){
      if (!adm) throw 'Admins only';
      if (TX.indexOf(q.s)<0) throw 'Bad sheet';
      var s3=sh(q.s, b);
      if (a==='rep' && q.s==='dr'){ var dv=s3.getRange(1,1,Math.max(s3.getLastRow(),1),9).getValues(); for (var di=1;di<dv.length;di++) if (String(dv[di][0])===String(q.id) && String(dv[di][8]).toUpperCase()==='VOID') throw 'This DR is void and cannot be edited.'; }
      delId(s3,String(q.id));
      if (a==='rep'){ var rr=q.rows.map(function(r){return r.map(cell);}); s3.getRange(s3.getLastRow()+1,1,rr.length,W[q.s]).setValues(rr); }
      dirty(q.s, b); return {ok:1};
    }
    if (a==='profile'){
      if (q.username!==undefined){
        var un2=String(q.username).toLowerCase().trim(), nm2=String(q.name||'').trim();
        if (!nm2) throw 'Enter your full name.';
        if (!/^[a-z0-9._]{3,20}$/.test(un2)) throw 'Username: 3-20 letters, numbers, dot or underscore.';
        var ex=acc(un2); if (ex && ex.email!==u.email) throw 'Username already taken.';
        sh('accounts').getRange(u.row,2,1,2).setValues([[un2,nm2].map(cell)]);
      }
      c.remove('u_'+u.email); dirty('accounts'); return {me:me(acc(u.email), b)};
    }
    throw 'Unknown action';
  } finally { lock.releaseLock(); }
}
