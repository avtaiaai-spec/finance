"""Profile UI with the real SDK and an intercepted Supabase Auth/Storage server."""
import io,os,re
from PIL import Image,PngImagePlugin
from playwright.sync_api import sync_playwright,expect
import browser_cloud as server

def fixture(color):
 image=Image.new('RGB',(900,600),color);buffer=io.BytesIO();meta=PngImagePlugin.PngInfo();meta.add_text('Private source metadata','must not be uploaded');image.save(buffer,format='PNG',pnginfo=meta);return {'name':'profile.png','mimeType':'image/png','buffer':buffer.getvalue()}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 ca=b.new_context(viewport={'width':1440,'height':1000});cb=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 server.install(ca,'a');server.install(cb,'b');a=ca.new_page();c=cb.new_page();errors=[]
 for page in [a,c]:page.on('pageerror',lambda e:errors.append(str(e)));page.goto(server.URL)
 uid=server.IDS['one@test.example'];server.login(a,'one@test.example');server.account(a)
 expect(a.locator('.page-heading h1')).to_have_text('Личный кабинет')
 assert a.locator('.cloud-strip').count()==0 and a.locator('.local-note').count()==0
 a.get_by_label('Ваше имя',exact=True).fill('Анна Иванова');a.get_by_role('button',name='Сохранить профиль',exact=True).click()
 expect(a.locator('.profile-form')).to_contain_text('Профиль сохранён.')
 expect(a.locator('.topbar .avatar')).to_have_text('АИ')
 a.get_by_label('Фото профиля',exact=True).set_input_files(fixture('#aa6688'))
 expect(a.get_by_alt_text('Предпросмотр фото',exact=True)).to_be_visible()
 assert server.photos=={}
 a.get_by_role('button',name='Сохранить профиль',exact=True).click()
 expect(a.locator('.profile-form')).to_contain_text('Профиль сохранён.')
 expect(a.locator('.topbar img')).to_be_visible()
 path=server.profiles[uid]['avatar_path'];assert path.startswith(uid+'/')
 stored=Image.open(io.BytesIO(server.photos[path]));assert stored.size==(512,512);assert stored.format=='JPEG';assert not stored.getexif();assert 'Private source metadata' not in stored.info
 assert '/object/sign/' in a.locator('.topbar img').get_attribute('src')
 server.login(c,'one@test.example');server.account(c)
 expect(c.get_by_label('Ваше имя',exact=True)).to_have_value('Анна Иванова');expect(c.locator('.topbar img')).to_be_visible()
 server.settings(c);assert c.locator('.profile-form').count()==0
 server.account(c);expect(c.get_by_label('Ваше имя',exact=True)).to_have_value('Анна Иванова')
 c.reload();server.account(c);expect(c.get_by_label('Ваше имя',exact=True)).to_have_value('Анна Иванова');expect(c.locator('.topbar img')).to_be_visible()
 # Cancelled drafts never upload or change profile metadata.
 c.get_by_label('Ваше имя',exact=True).fill('Не сохранять');c.get_by_role('button',name='Отмена изменений',exact=True).click()
 expect(c.get_by_label('Ваше имя',exact=True)).to_have_value('Анна Иванова')
 # A failed Auth update must leave the old photo and clean up the unused new file.
 server.fail_metadata=True
 a.get_by_label('Фото профиля',exact=True).set_input_files(fixture('#448866'));expect(a.get_by_alt_text('Предпросмотр фото',exact=True)).to_be_visible()
 a.get_by_role('button',name='Сохранить профиль',exact=True).click()
 expect(a.locator('.profile-form')).to_contain_text('Не удалось сохранить профиль')
 assert server.profiles[uid]['avatar_path']==path and set(server.photos)=={path}
 server.fail_metadata=False;a.get_by_role('button',name='Отмена изменений',exact=True).click()
 server.fail_metadata='abort'
 a.get_by_label('Фото профиля',exact=True).set_input_files(fixture('#448866'));expect(a.get_by_alt_text('Предпросмотр фото',exact=True)).to_be_visible()
 a.get_by_role('button',name='Сохранить профиль',exact=True).click()
 expect(a.locator('.profile-form')).to_contain_text('Не удалось подтвердить сохранение профиля')
 assert server.profiles[uid]['avatar_path']==path and set(server.photos)=={path}
 server.fail_metadata=False;a.get_by_role('button',name='Отмена изменений',exact=True).click()

 # Replacing a photo removes its predecessor only after metadata is saved.
 a.get_by_label('Фото профиля',exact=True).set_input_files(fixture('#448866'));expect(a.get_by_alt_text('Предпросмотр фото',exact=True)).to_be_visible()
 a.get_by_role('button',name='Сохранить профиль',exact=True).click();expect(a.locator('.profile-form')).to_contain_text('Профиль сохранён.')
 new_path=server.profiles[uid]['avatar_path'];assert new_path!=path;assert path not in server.photos and new_path in server.photos
 assert server.profiles[uid]['display_name']=='Анна Иванова'
 a.get_by_label('Фото профиля',exact=True).set_input_files({'name':'bad.svg','mimeType':'image/svg+xml','buffer':b'<svg/>'})
 expect(a.locator('.profile-form')).to_contain_text('Выберите фото JPEG');assert set(server.photos)=={new_path}
 c.evaluate("window.dispatchEvent(new Event('focus'))")
 expect(c.locator('.topbar img')).to_have_attribute('src',re.compile(re.escape(new_path)))
 a.get_by_role('button',name='Удалить фото',exact=True).click();a.get_by_role('button',name='Сохранить профиль',exact=True).click()
 expect(a.locator('.profile-form')).to_contain_text('Профиль сохранён.');expect(a.locator('.topbar img')).to_have_count(0);expect(a.locator('.topbar .avatar')).to_have_text('АИ');assert new_path not in server.photos
 assert server.profiles[uid]['avatar_path'] is None
 c.evaluate("window.dispatchEvent(new Event('focus'))");expect(c.locator('.topbar img')).to_have_count(0)
 assert c.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS: name, initials, JPEG conversion and metadata removal, private signed avatar, two-device refresh/reload, cancellation, failed update cleanup, replacement, invalid format, deletion and mobile.')
 b.close()
