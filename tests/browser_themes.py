"""Check all color/brightness combinations, persistence, import and marked text removal."""
import os,json
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000},color_scheme='light');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('APP_URL','http://127.0.0.1:4175/finance/'))
 def nav(name):page.locator('.sidebar nav').get_by_role('button',name=name,exact=True).click()
 assert page.locator('.brand small').count()==0
 assert page.locator('.hero-footnote').count()==0
 assert 'Меньше тревоги' not in page.locator('footer').inner_text()
 for name in ['Операции','Категории','Настройки']:
  nav(name);assert page.locator('.page-heading p').count()==0
 colors={}
 for key,label in [('green','Зелёная'),('pink','Розовая'),('yellow','Жёлтая'),('burgundy','Бордовая'),('brown','Коричневая')]:
  for mode,text in [('light','Светлая'),('dark','Тёмная'),('system','Системная')]:
   page.get_by_role('button',name=label,exact=True).click()
   page.get_by_role('button',name=text,exact=True).click()
   assert page.locator('html').get_attribute('data-palette')==key
   assert page.locator('html').get_attribute('data-theme')==('light' if mode=='system' else mode)
   values=page.evaluate("(()=>{const s=getComputedStyle(document.documentElement);return {background:s.backgroundColor,text:s.color,bg:s.getPropertyValue('--bg').trim(),accent:s.getPropertyValue('--accent').trim(),hero:s.getPropertyValue('--hero').trim(),onAccent:s.getPropertyValue('--on-accent').trim()};})()")
   colors[(key,mode)]=values
   assert values['background']!='rgba(0, 0, 0, 0)'
   page.reload();nav('Настройки')
   expect(page.get_by_role('button',name=label,exact=True)).to_have_attribute('aria-pressed','true')
   assert page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1')).settings.theme")==mode
  assert colors[(key,'light')]['background']!=colors[(key,'dark')]['background']
 assert len(set(colors[(k,'light')]['accent'] for k in ['green','pink','yellow','burgundy','brown']))==5
 page.get_by_role('button',name='Розовая',exact=True).click()
 page.get_by_role('button',name='Системная',exact=True).click()
 page.emulate_media(color_scheme='dark');expect(page.locator('html')).to_have_attribute('data-theme','dark')
 expect(page.locator('html')).to_have_attribute('data-palette','pink')
 page.emulate_media(color_scheme='light');expect(page.locator('html')).to_have_attribute('data-theme','light')
 with page.expect_download() as dl:page.get_by_role('button',name='Скачать резервную копию JSON',exact=True).click()
 page.get_by_role('button',name='Копия сохранена',exact=True).click()
 saved=json.load(open(dl.value.path()));assert saved['settings']['palette']=='pink'
 page.get_by_role('button',name='Коричневая',exact=True).click()
 page.locator('input[type=file][accept=".json,application/json"]').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(saved).encode()})
 page.get_by_role('button',name='Заменить данные',exact=True).click()
 expect(page.locator('html')).to_have_attribute('data-palette','pink')
 for width in [320,390]:
  page.set_viewport_size({'width':width,'height':844})
  for label in ['Розовая','Жёлтая','Бордовая','Коричневая']:
   page.get_by_role('button',name=label,exact=True).click()
   for mode in ['Светлая','Тёмная']:
    page.get_by_role('button',name=mode,exact=True).click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,label,mode)
 page.get_by_role('button',name='Розовая',exact=True).click()
 page.screenshot(path='/tmp/finance-pink-settings.png',full_page=True)
 page.locator('.bottom-nav').get_by_role('button',name='Главная',exact=True).click()
 page.screenshot(path='/tmp/finance-pink-home.png',full_page=True)
 assert not errors,errors
 print('PASS: 15 palette/mode combinations, persistence, system changes, unique colors, JSON restore, 320/390px and removed marked text.')
 b.close()
