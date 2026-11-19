  /** RPI Inventory v1.2 - Google Apps Script web app (serves index.html + server API).
   *  Deploy: Deploy > New deployment > Web app > Execute as: Me,
   *          Who has access: Anyone within riteproducts.com.ph. See DEPLOY.md. */
  var SID = '1l2tvgEsEHUN8--eFF3tT-MncJ2SKct6YZdyHN8cBoLs';
  var W = {products:5, rr:10, dr:8, rs:8, cn:8, pending:10, accounts:6, ad:9};
  var TX = ['rr','dr','rs','cn','ad'];
  
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
      .setTitle('RPI Inventory System v1.2')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }
  /** Called from the page via google.script.run.api({a:..., ...}).
   *  No passwords or tokens: the user is the company Google account Apps Script reports. */
  function api(q){
    if (!companyOk()) return {error: 'Access restricted to @' + DOMAIN + ' accounts.'};
    try { return go(q || {}); }
    catch (x) { return {error: String(x && x.message || x)}; }
  }
  var TABS = {products:['products'], rr:['rr'], dr:['dr'], rs:['reservations','rs'], cn:['consumables','cn'], accounts:['accounts'], pending:['pending aproval','pending approval','pending'], ad:['assembly','assembled / disassembled','assembled-disassembled']};
  var _sh;
  function sheets(){ return _sh || (_sh = SpreadsheetApp.openById(SID).getSheets()); }
  function sh(n){
    var all = sheets(), names = TABS[n] || [String(n).toLowerCase()];
    for (var j=0;j<names.length;j++) for (var i=0;i<all.length;i++) if (all[i].getName().toLowerCase()===names[j]) return all[i];
    throw 'Sheet tab not found: ' + n;
  }
  function rd(n){ var s = sh(n), l = s.getLastRow(); return l ? s.getRange(1,1,l,W[n]).getDisplayValues() : []; }
  function rdc(n){
    var c = CacheService.getScriptCache(), k = 'd_'+n, j = c.get(k);
    if (j) return JSON.parse(j);
    var v = rd(n); try { c.put(k, JSON.stringify(v), 300); } catch (e) {}
    return v;
  }
  function dirty(n){ CacheService.getScriptCache().remove('d_'+n); }
  function bundle(u, only){
    var o = {me: me(u)};
    (only || ['products','rr','dr','rs','cn','pending','accounts','ad']).forEach(function(n){
      if (n==='accounts' && u.role!=='admin') { o[n]=[]; return; }
      if (n==='pending' && u.role==='viewer') { o[n]=[]; return; }
      try { o[n] = rdc(n); } catch (e) { if (n==='ad') o[n]=[]; else throw e; }
    });
    return o;
  }
  function cell(v){ return typeof v === 'string' ? (v === '' ? '' : "'" + v) : v; }
  function acc(id){
    id = String(id||'').trim().toLowerCase();
    if (!id) return null;
    var v = sh('accounts').getDataRange().getValues();
    for (var i=1;i<v.length;i++){ var r=v[i];
      if (String(r[0]).toLowerCase()===id || String(r[1]).toLowerCase()===id)
        return {row:i+1,email:String(r[0]).toLowerCase(),username:String(r[1]),name:String(r[2]),role:String(r[3]),active:String(r[4]).toUpperCase()}; }
    return null;
  }
  function me(a){ return {email:a.email,username:a.username,name:a.name,role:a.role}; }
  /** First visit by a company account: add it to the accounts tab (first account ever = admin, others = viewer). */
  function enroll(e){
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var a = acc(e); if (a) return a;
      var local = e.split('@')[0], base = local.replace(/[^a-z0-9._]/g, '').slice(0, 17), un = base, n = 1;
      while (base.length < 3) base += '_';
      un = base; while (acc(un)) un = base + (++n);
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
   *  to erase the old password salts and hashes (columns G and H of the accounts tab). */
  function wipePasswordHashes(){
    var s = sh('accounts'), l = s.getLastRow();
    if (l > 1) s.getRange(2, 7, l - 1, 2).clearContent();
    CacheService.getScriptCache().removeAll(['d_accounts']);
    Logger.log('Cleared password data for ' + Math.max(l - 1, 0) + ' accounts.');
  }
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
  function go(q){
    var a = q.a, c = CacheService.getScriptCache(), lock = LockService.getScriptLock();
    if (a==='warm'){ ['products','rr','dr','rs','cn','pending','accounts','ad'].forEach(function(n){ try { rdc(n); } catch (e) {} }); return {ok:1}; }
    var u = need(), adm = u.role==='admin', wr = adm || u.role==='editor';
    if (a==='data'){
      if (q.fresh) ['products','rr','dr','rs','cn','pending','accounts','ad'].forEach(dirty);
      return bundle(u, q.only);
    }
    lock.waitLock(20000);
    try {
      if (a==='add'){
        var n=q.s; if (!(W[n] && n!=='accounts' && n!=='ad' && wr)) throw 'Viewers cannot change data.';
        var rows=q.rows, added=rows.length;
        if (n==='pending' && !adm) rows.forEach(function(r){ r[8]='pending'; r[9]=''; });
        var s2=sh(n);
        if (n==='products') added=insProducts(s2,rows);
        else if (rows.length) s2.getRange(s2.getLastRow()+1,1,rows.length,W[n]).setValues(rows.map(function(r){return r.map(cell);}));
        dirty(n); return {ok:1, n:added};
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
        var ps=sh('products'), pl=ps.getLastRow(), pv=pl>1 ? ps.getRange(2,1,pl-1,5).getValues() : [], have={};
        pv.forEach(function(r){ have[String(r[1]).toUpperCase()]=1; });
        if (q.mode==='new' && have[icode.toUpperCase()]) throw 'That product code already exists. Use Existing Product.';
        if (q.mode==='existing' && !have[icode.toUpperCase()]) throw 'Product not found. Use New Product to create it.';
        if (!have[icode.toUpperCase()]){
          if (ty!=='Assembled') throw 'The item being disassembled is not in the catalog.';
          if (!String(q.brand||'').trim()) throw 'Brand is required for a new item.';
          insProducts(ps,[[String(q.brand).trim().toUpperCase(), icode, String(q.unit||'pcs').trim()||'pcs', 0, 0]]);
          dirty('products'); have[icode.toUpperCase()]=1;
        }
        comps.forEach(function(c){
          var k=String(c.code).trim().toUpperCase();
          if (!have[k]) throw 'Component not in catalog: '+c.code;
          if (k===icode.toUpperCase()) throw 'The item cannot be its own component.';
          if (!(Number(c.qty)>0)) throw 'Bad component quantity.';
        });
        var ts=new Date().getTime(), id='ad_'+ts+'_'+Utilities.getUuid().slice(0,4), no=String(q.no||'').trim(), dt=String(q.date||'').trim();
        var rows=[[id,no,dt,ty,'item',icode,iq,u.username,ts]];
        comps.forEach(function(c){ rows.push([id,no,dt,ty,'component',String(c.code).trim(),Number(c.qty),u.username,ts]); });
        var sa=sh('ad'); sa.getRange(sa.getLastRow()+1,1,rows.length,9).setValues(rows.map(function(r){return r.map(cell);}));
        dirty('ad'); return {ok:1, id:id};
      }
      if (a==='updp'){
        if (!adm) throw 'Admins only';
        var pp=sh('products'), pl2=pp.getLastRow(), codes=pl2>1 ? pp.getRange(2,2,pl2-1,1).getValues() : [], target=String(q.code).toUpperCase(), prow=-1;
        for (var pi=0;pi<codes.length;pi++) if (String(codes[pi][0]).toUpperCase()===target){ prow=pi+2; break; }
        if (prow<0) throw 'Product not found: '+q.code;
        var pv2=q.v.map(cell), pc=q.c||1; if (pc+pv2.length-1>5) throw 'Not allowed';
        pp.getRange(prow,pc,1,pv2.length).setValues([pv2]); dirty('products'); return {ok:1};
      }
      if (a==='upd'){
        if (!adm) throw 'Admins only';
        var n2=q.s; if (!W[n2]) throw 'Bad sheet';
        var v=q.v.map(cell); if (q.c+v.length-1>W[n2]) throw 'Not allowed';
        sh(n2).getRange(q.r,q.c,1,v.length).setValues([v]); dirty(n2); return {ok:1};
      }
      if (a==='del' || a==='rep'){
        if (!adm) throw 'Admins only';
        if (TX.indexOf(q.s)<0) throw 'Bad sheet';
        var s3=sh(q.s); delId(s3,String(q.id));
        if (a==='rep'){ var rr=q.rows.map(function(r){return r.map(cell);}); s3.getRange(s3.getLastRow()+1,1,rr.length,W[q.s]).setValues(rr); }
        dirty(q.s); return {ok:1};
      }
      if (a==='profile'){
        var upd={};
        if (q.username!==undefined){
          var un2=String(q.username).toLowerCase().trim(), nm2=String(q.name||'').trim();
          if (!nm2) throw 'Enter your full name.';
          if (!/^[a-z0-9._]{3,20}$/.test(un2)) throw 'Username: 3-20 letters, numbers, dot or underscore.';
          var ex=acc(un2); if (ex && ex.email!==u.email) throw 'Username already taken.';
          sh('accounts').getRange(u.row,2,1,2).setValues([[un2,nm2]]);
        }
        c.remove('u_'+u.email); dirty('accounts'); return {me:me(acc(u.email))};
      }
      throw 'Unknown action';
    } finally { lock.releaseLock(); }
  }
