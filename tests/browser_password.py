"""Recovery URL initialization with real Auth SDK and intercepted synthetic server."""
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright, expect
import browser_cloud as server
import json

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':390,'height':844});server.install(ctx,'password')
 pg=ctx.new_page();updates=[];recoveries=[]
 pg.on('request',lambda r: updates.append(r.post_data_json) if r.method=='PUT' and '/auth/v1/user' in r.url else None)
 pg.on('request',lambda r: recoveries.append(r.post_data_json) if '/auth/v1/recover' in r.url else None)
 uid=server.IDS['one@test.example'];sess=server.session(uid)
 # No PKCE verifier or previous session: email opened in a different browser.
 pg.goto(server.URL+'#'+urlencode({**{k:sess[k] for k in ['access_token','refresh_token','expires_in','token_type']},'type':'recovery'}))
 expect(pg.locator('.page-heading h1')).to_have_text('Личный кабинет')
 expect(pg.get_by_role('heading',name='Новый пароль',exact=True)).to_be_visible()
 pg.reload();expect(pg.get_by_role('heading',name='Новый пароль',exact=True)).to_be_visible()
 pg.get_by_label('Пароль',exact=True).fill('Changed-password-123');pg.get_by_role('button',name='Сохранить пароль',exact=True).click()
 expect(pg.locator('.account-message')).to_contain_text('Пароль обновлён')
 assert updates[-1]['password']=='Changed-password-123'
 pg.reload();server.account(pg);expect(pg.get_by_role('button',name='Изменить пароль',exact=True)).to_be_visible()
 pg.get_by_role('button',name='Изменить пароль',exact=True).click();pg.get_by_label('Пароль',exact=True).fill('Changed-password-456');pg.get_by_role('button',name='Сохранить пароль',exact=True).click()
 expect(pg.locator('.account-message')).to_contain_text('Пароль обновлён')
 assert updates[-1]['password']=='Changed-password-456'
 assert pg.locator('.topbar .avatar').bounding_box()['width']==56
 ctx.close()
 ctx=b.new_context();server.install(ctx,'legacy');pg=ctx.new_page()
 pg.add_init_script("localStorage.setItem('sb-dshtycqngfqqvnensvlb-auth-token-code-verifier', JSON.stringify('test-verifier/recovery'))")
 ctx.route(server.HOST+'/auth/v1/token?grant_type=pkce',lambda route: route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(sess)))
 pg.goto(server.URL+'?code=synthetic-old-recovery-code')
 expect(pg.get_by_role('heading',name='Новый пароль',exact=True)).to_be_visible()
 ctx.close()
 ctx=b.new_context();server.install(ctx,'expired');pg=ctx.new_page()
 pg.goto(server.URL+'#error=access_denied&error_code=otp_expired&error_description=Expired')
 expect(pg.locator('.page-heading h1')).to_have_text('Личный кабинет')
 expect(pg.get_by_role('heading',name='Восстановление пароля',exact=True)).to_be_visible()
 expect(pg.locator('.form-error')).to_contain_text('новое письмо')
 pg.get_by_label('Электронная почта',exact=True).fill('one@test.example')
 pg.on('request',lambda r: recoveries.append(r.post_data_json) if '/auth/v1/recover' in r.url else None)
 pg.get_by_role('button',name='Отправить письмо',exact=True).click()
 expect(pg.locator('.account-message')).to_contain_text('письмо')
 assert recoveries and not recoveries[-1].get('code_challenge')
 ctx.close();b.close()
 print('PASS: cross-browser recovery URL, reload before save, password update, signed-in change, expired link and new reset request without browser-bound verifier; 56px mobile avatar.')
