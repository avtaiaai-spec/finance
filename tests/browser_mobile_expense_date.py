"""Reproduce 29 October -> save cigarettes 230 on 28 October -> new expense 28 October."""
import os
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.clock.install(time=datetime(2026,10,29,12,tzinfo=timezone.utc))
 page.goto(os.environ.get('APP_URL','http://127.0.0.1:4175/finance/'))
 assert page.locator('.hero-period-net').count()==0
 page.get_by_role('button',name='Открыть меню',exact=True).click()
 page.locator('.more-menu').get_by_role('button',name='Категории',exact=True).click()
 page.locator('.heading-actions').get_by_role('button',name='Категория',exact=True).click()
 page.get_by_label('Название',exact=True).fill('Сигареты')
 page.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
 def add():page.locator('.bottom-nav').get_by_role('button',name='Добавить',exact=True).click()
 def fill():
  page.get_by_label('Сумма, ₽',exact=True).fill('230')
  page.get_by_role('dialog').get_by_role('button',name='Сигареты',exact=True).click()
 def save():page.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
 def state():return page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
 add();expect(page.get_by_label('Дата',exact=True)).to_have_value('2026-10-29')
 fill();page.get_by_label('Дата',exact=True).fill('2026-10-28')
 # Re-selecting the already active type must never reset the chosen date.
 page.get_by_role('dialog').get_by_role('button',name='Расход',exact=True).click()
 expect(page.get_by_label('Дата',exact=True)).to_have_value('2026-10-28');save()
 assert state()['transactions'][0]['amount']==23000
 assert state()['transactions'][0]['date']=='2026-10-28'
 add();expect(page.get_by_label('Дата',exact=True)).to_have_value('2026-10-28');fill();save()
 assert [t['date'] for t in state()['transactions']]==['2026-10-28','2026-10-28']
 add();fill()
 # Some native pickers send input before a final change/blur event.
 page.get_by_label('Дата',exact=True).evaluate("el=>{el.value='2026-10-27';el.dispatchEvent(new Event('input',{bubbles:true}));}")
 save();assert state()['settings']['lastExpenseDate']=='2026-10-27'
 page.reload();add();expect(page.get_by_label('Дата',exact=True)).to_have_value('2026-10-27')
 page.get_by_role('button',name='Отмена',exact=True).click()
 assert not errors,errors
 print('PASS: mobile 29.10 -> cigarettes 230 on 28.10 -> next expense on 28.10; active type preserves date; native input event, save and reload retain 27.10; summary line removed.')
 b.close()
