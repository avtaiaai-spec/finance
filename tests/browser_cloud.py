"""Real Supabase SDK against an intercepted test server; no personal accounts or external calls.
SQL/RLS is tested separately with PostgreSQL in cloud-sql.test.ts.
"""
import os,json,time,base64
from urllib.parse import urlsplit,parse_qs,unquote
from email.parser import BytesParser
from email import policy
from copy import deepcopy
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('APP_URL','http://127.0.0.1:4175/finance/')
HOST='https://dshtycqngfqqvnensvlb.supabase.co'
IDS={'one@test.example':'11111111-1111-4111-8111-111111111111','two@test.example':'22222222-2222-4222-8222-222222222222'}
rows={};history={};offline=set();errors=[];profiles={};photos={};signed={};fail_metadata=False
def user(uid):return {'id':uid,'aud':'authenticated','role':'authenticated','email':next(k for k,v in IDS.items() if v==uid),'created_at':'2026-01-01T00:00:00Z','app_metadata':{},'user_metadata':deepcopy(profiles.get(uid,{})),'identities':[]}
def token(uid):
 enc=lambda obj:base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip('=')
 return enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'exp':int(time.time())+3600,'iat':int(time.time()),'role':'authenticated','aud':'authenticated'})+'.test_signature'
def session(uid):return {'access_token':token(uid),'refresh_token':'refresh-'+uid,'expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user(uid)}
def install(context,label):
 def handler(route):
  req=route.request;path=req.url[len(HOST):].split('?')[0];headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Content-Type':'application/json'}
  def reply(data,status=200):route.fulfill(status=status,headers=headers,body=json.dumps(data))
  if req.method=='OPTIONS':return reply({})
  if label in offline and '/rest/' in path:return route.abort('internetdisconnected')
  body=req.post_data_json if 'json' in req.headers.get('content-type','') and req.post_data_buffer else {}
  if path=='/auth/v1/token':
   if body.get('grant_type')=='refresh_token':uid=body['refresh_token'].replace('refresh-','')
   else:uid=IDS.get(body.get('email'))
   if not uid:return reply({'error':'invalid_credentials','msg':'Invalid login credentials'},400)
   return reply(session(uid))
  if path in ['/auth/v1/signup','/auth/v1/recover']:return reply({'user':None,'session':None} if path.endswith('signup') else {})
  auth=req.headers.get('authorization','').replace('Bearer ','');uid=next((v for v in IDS.values() if token(v).split('.')[1]==auth.split('.')[1] if len(auth.split('.'))==3),None) if len(auth.split('.'))==3 else None
  # Token timestamps may differ between calls; decode the stable subject.
  try:uid=json.loads(base64.urlsafe_b64decode(auth.split('.')[1]+'==='))['sub']
  except Exception:uid=None
  if path=='/auth/v1/logout':return reply({})
  if path=='/auth/v1/user':
   if req.method=='PUT':
    if fail_metadata:return reply({'message':'temporary update failure'},500)
    profiles.setdefault(uid,{}).update(body.get('data',{}))
   return reply(user(uid))
  sign_prefix='/storage/v1/object/sign/finance-avatars/'
  if path.startswith(sign_prefix) and req.method=='GET':
   key=unquote(path[len(sign_prefix):]);sig=parse_qs(urlsplit(req.url).query).get('token',[''])[0]
   if signed.get(sig)!=key or key not in photos:return reply({'message':'not found'},404)
   return route.fulfill(status=200,headers={**headers,'Content-Type':'image/jpeg'},body=photos[key])

  if not uid:return reply({'code':'401'},401)
  if path.startswith(sign_prefix) and req.method=='POST':
   key=unquote(path[len(sign_prefix):])
   if not key.startswith(uid+'/'):return reply({'message':'denied'},403)
   if key not in photos:return reply({'message':'not found'},404)
   sig='signed-'+str(len(signed)+1);signed[sig]=key
   return reply({'signedURL':'/object/sign/finance-avatars/'+key+'?token='+sig})
  upload_prefix='/storage/v1/object/finance-avatars/'
  if path.startswith(upload_prefix) and req.method=='POST':
   key=unquote(path[len(upload_prefix):])
   if not key.startswith(uid+'/'):return reply({'message':'denied'},403)
   content=req.post_data_buffer or b''
   if req.headers.get('content-type','').startswith('multipart/'):
    msg=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+req.headers['content-type']+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+content)
    content=next(part.get_payload(decode=True) for part in msg.iter_parts() if part.get_filename() is not None)
   photos[key]=content;return reply({'Key':'finance-avatars/'+key,'Id':key.split('/')[-1].replace('.jpg','')})
  if path=='/storage/v1/object/finance-avatars' and req.method=='DELETE':
   keys=body.get('prefixes',[])
   if any(not k.startswith(uid+'/') for k in keys):return reply({'message':'denied'},403)
   for key in keys:photos.pop(key,None)
   return reply([{'name':key} for key in keys])

  if path=='/rest/v1/finance_state':return reply([deepcopy(rows[uid])] if uid in rows else [])
  if path=='/rest/v1/finance_history':
   entries=history.get(uid,[])
   if 'revision=eq.' in req.url:
    rev=int(req.url.split('revision=eq.')[1].split('&')[0]);return reply([{'payload':deepcopy(h['payload'])} for h in entries if h['revision']==rev])
   return reply([{'revision':h['revision'],'created_at':h['updated_at']} for h in reversed(entries)])
  if path=='/rest/v1/rpc/save_finance_state':
   current=rows.get(uid);rev=current['revision'] if current else 0
   if body['p_expected_revision']!=rev:return reply({'code':'40001','message':'conflict'},409)
   if current:history.setdefault(uid,[]).append(deepcopy(current))
   rows[uid]={'revision':rev+1,'payload':deepcopy(body['p_data']),'updated_at':'2026-10-29T12:00:00Z'}
   return reply(rows[uid])
  return reply({'path':path},404)
 context.route(HOST+'/**',handler)
def settings(pg):
 if pg.viewport_size['width']>680:pg.locator('.sidebar nav').get_by_role('button',name='Настройки',exact=True).click()
 else:
  pg.get_by_role('button',name='Открыть меню',exact=True).click();pg.locator('.more-menu').get_by_role('button',name='Настройки',exact=True).click()
def home(pg):
 if pg.viewport_size['width']>680:pg.locator('.sidebar nav').get_by_role('button',name='Главная',exact=True).click()
 else:pg.locator('.bottom-nav').get_by_role('button',name='Главная',exact=True).click()
def login(pg,email):
 settings(pg);pg.get_by_label('Электронная почта',exact=True).fill(email);pg.get_by_label('Пароль',exact=True).fill('Test-password-123');pg.get_by_role('button',name='Войти',exact=True).click()
 expect(pg.locator('.cloud-strip')).to_be_visible(timeout=10000)
def synced(pg):expect(pg.locator('.cloud-strip')).to_contain_text('Все изменения в облаке',timeout=15000)
def sync(pg):settings(pg);pg.get_by_role('button',name='Синхронизировать',exact=True).click();synced(pg)
def add(pg,kind,amount):
 home(pg)
 if pg.viewport_size['width']>680:pg.locator('.heading-actions').get_by_role('button',name=kind,exact=True).click()
 else:
  pg.locator('.bottom-nav').get_by_role('button',name='Добавить',exact=True).click()
  if kind=='Доход':pg.get_by_role('dialog').get_by_role('button',name='Доход',exact=True).click()
 pg.get_by_label('Сумма, ₽',exact=True).fill(str(amount));pg.get_by_role('dialog').get_by_role('button',name='Зарплата' if kind=='Доход' else 'Продукты',exact=True).click();pg.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
if __name__=='__main__':
    with sync_playwright() as p:
     b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
     ca=b.new_context(viewport={'width':1440,'height':1000});cb=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
     install(ca,'a');install(cb,'b');a=ca.new_page();c=cb.new_page()
     for pg in [a,c]:pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(URL)
     add(a,'Расход',100);guest=a.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
     login(a,'one@test.example');settings(a)
     a.once('dialog',lambda d:d.accept());a.get_by_role('button',name='Перенести мои данные в облако',exact=True).click();synced(a)
     assert len(rows[IDS['one@test.example']]['payload']['transactions'])==1
     assert a.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")==guest
     login(c,'one@test.example');synced(c)
     add(a,'Расход',200);synced(a);sync(c)
     assert len(rows[IDS['one@test.example']]['payload']['transactions'])==2
     offline.add('a');add(a,'Расход',300)
     add(c,'Доход',2000);synced(c)
     offline.remove('a');sync(a);sync(c)
     assert len(rows[IDS['one@test.example']]['payload']['transactions'])==4
     assert sum(t['amount']*(1 if t['type']=='income' else -1) for t in rows[IDS['one@test.example']]['payload']['transactions'])==140000
     # Remove an operation, then recover the previous cloud version through the UI.
     home(a);a.locator('.transaction').filter(has_text='Продукты').first.click()
     a.once('dialog',lambda d:d.accept());a.get_by_role('button',name='Удалить операцию',exact=True).click();synced(a)
     assert len(rows[IDS['one@test.example']]['payload']['transactions'])==3
     settings(a);a.get_by_text('Восстановление из облачной истории',exact=True).click()
     a.get_by_role('button',name='Показать последние версии',exact=True).click()
     a.locator('.account-card details .setting-link').first.click()
     a.once('dialog',lambda d:d.accept());a.get_by_role('button',name='Восстановить эту версию',exact=True).click();synced(a)
     assert len(rows[IDS['one@test.example']]['payload']['transactions'])==4
     assert a.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")==guest
     sync(c)
     settings(c);c.get_by_role('button',name='Выйти',exact=True).click();expect(c.locator('.cloud-strip')).to_have_count(0)
     login(c,'two@test.example');add(c,'Расход',900);synced(c)
     assert len(rows[IDS['two@test.example']]['payload']['transactions'])==1
     assert len(rows[IDS['one@test.example']]['payload']['transactions'])==4
     c.reload();synced(c)
     # Two tabs in the same browser must not overwrite one offline queue.
     second=ca.new_page();second.on('pageerror',lambda e:errors.append(str(e)));second.goto(URL)
     expect(second.locator('.cloud-strip')).to_contain_text('другом окне',timeout=10000)
     home(second);second.locator('.heading-actions').get_by_role('button',name='Расход',exact=True).click()
     second.get_by_label('Сумма, ₽',exact=True).fill('400')
     second.get_by_role('dialog').get_by_role('button',name='Продукты',exact=True).click()
     second.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
     expect(second.get_by_role('dialog')).to_be_visible()
     assert len(rows[IDS['one@test.example']]['payload']['transactions'])==4
     second.get_by_role('button',name='Отмена',exact=True).click()
     a.close();synced(second);add(second,'Расход',400);synced(second)
     assert len(rows[IDS['one@test.example']]['payload']['transactions'])==5
     assert not errors,errors
     print('PASS: real auth SDK login, explicit local migration, original preserved, two device sync, offline merge, correct totals, cloud history recovery, logout, account isolation and session reload, same-browser tab lock and handover (intercepted server).')
     b.close()
