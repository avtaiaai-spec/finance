"""APP_URL=http://127.0.0.1:4175/finance/ python tests/browser_balance.py"""
import os,re
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('APP_URL','http://127.0.0.1:4175/finance/'))
 expect(page.locator('.hero-number')).to_contain_text('—')
 def add(kind,amount,cat):
  page.locator('.heading-actions').get_by_role('button',name=kind,exact=True).click()
  page.get_by_label('Сумма, ₽',exact=True).fill(amount)
  page.get_by_role('dialog').get_by_role('button',name=cat,exact=True).click()
  page.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
 def balance(n):
  expect(page.locator('.hero-number')).to_have_text(re.compile(''.join(c+r'\s*' for c in str(n))+'₽'))
 def state():return page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
 add('Расход','1000','Продукты')
 page.get_by_role('button',name='Указать, сколько денег сейчас',exact=True).click()
 page.get_by_label('Денег сейчас, ₽',exact=True).fill('5000')
 page.get_by_role('button',name='Сохранить остаток',exact=True).click();balance(5000)
 assert state()['cash']['opening']==600000
 assert len(state()['transactions'])==1
 add('Расход','200','Продукты');balance(4800)
 add('Доход','1000','Зарплата');balance(5800)
 page.get_by_role('button',name='Предыдущий период',exact=True).click();balance(5800)
 page.get_by_role('button',name='Сегодня',exact=True).click()
 page.reload();balance(5800)
 page.locator('.sidebar nav').get_by_role('button',name='Настройки',exact=True).click()
 page.get_by_role('button',name='Тёмная',exact=True).click()
 assert state()['cash']['opening']==600000
 with page.expect_download() as dl:page.get_by_role('button',name='Скачать резервную копию JSON',exact=True).click()
 import json
 assert json.load(open(dl.value.path()))['cash']==state()['cash']
 page.locator('.sidebar nav').get_by_role('button',name='Главная',exact=True).click()
 page.get_by_role('button',name='Настроить остаток',exact=True).click()
 page.get_by_label('Денег сейчас, ₽',exact=True).fill('0');page.get_by_role('button',name='Сохранить остаток',exact=True).click();balance(0)
 assert len(state()['transactions'])==3
 page.set_viewport_size({'width':390,'height':844})
 page.get_by_role('button',name='Настроить остаток',exact=True).click()
 page.get_by_role('button',name='На начало даты',exact=True).click()
 page.get_by_label('Остаток на начало даты, ₽',exact=True).fill('2000')
 page.get_by_role('button',name='Сохранить остаток',exact=True).click();balance(1800)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/finance-balance-mobile.png',full_page=True)
 assert not errors,errors
 print('PASS: unknown balance, actual balance without double-counting, new expenses/income, period independence, reload, theme, backup, zero, opening date and mobile layout.')
 b.close()
