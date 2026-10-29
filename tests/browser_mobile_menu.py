"""Validate mobile safe-area geometry and navigation after page scrolling.
Chromium simulates a 59px top inset; this does not replace a real iPhone test.
"""
import os
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('APP_URL','http://127.0.0.1:4175/finance/'))
 # Inject only the safe-area variable; app header/menu rules must do the positioning.
 page.evaluate("document.documentElement.style.setProperty('--mobile-safe-top','59px')")
 button=page.get_by_role('button',name='Открыть меню',exact=True)
 assert button.bounding_box()['y']>=59
 for scroll in [0,500,1100]:
  page.evaluate('(y)=>window.scrollTo(0,y)',scroll)
  assert button.bounding_box()['y']>=59
  assert button.bounding_box()['y']+button.bounding_box()['height']<=135
  button.click();expect(button).to_have_attribute('aria-expanded','true')
  menu=page.locator('.more-menu');expect(menu).to_be_visible()
  assert menu.bounding_box()['y']>=124
  page.locator('.more-menu').get_by_role('button',name='Настройки',exact=True).click()
  expect(menu).to_have_count(0)
  expect(page.get_by_role('heading',name='Настройки',exact=True)).to_be_visible()
  with page.expect_file_chooser() as chooser:page.get_by_role('button',name='Импорт CSV',exact=True).click()
  chooser.value.set_files({'name':'test.csv','mimeType':'text/csv','buffer':b'Date,Type,Category,Amount,Currency,Note\n2026-10-27,expense,Test,5.00,RUB,\n'})
  expect(page.get_by_role('dialog')).to_contain_text('Импорт CSV')
  page.get_by_role('button',name='Закрыть',exact=True).click()
  page.locator('.bottom-nav').get_by_role('button',name='Главная',exact=True).click()
 button.click();page.keyboard.press('Escape');expect(page.locator('.more-menu')).to_have_count(0)
 button.click();page.locator('.mobile-menu-backdrop').click(position={'x':5,'y':500});expect(page.locator('.more-menu')).to_have_count(0)
 for width,height in [(320,568),(390,844),(667,375)]:
  page.set_viewport_size({'width':width,'height':height})
  button.click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  menu=page.locator('.more-menu');assert menu.bounding_box()['y']>=124
  page.locator('.more-menu').get_by_role('button',name='Настройки',exact=True).click()
  expect(page.get_by_role('heading',name='Настройки',exact=True)).to_be_visible()
 page.set_viewport_size({'width':390,'height':844});button.click()
 page.screenshot(path='/tmp/finance-mobile-safe-menu.png',full_page=False)
 assert not errors,errors
 print('PASS: simulated 59px safe area, sticky header, menu after scrolling, settings, native CSV picker, preview, Escape/backdrop close, 320/390px and landscape.')
 b.close()
