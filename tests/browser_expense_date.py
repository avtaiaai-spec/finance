"""Remember the date of the last successfully added expense, across refreshes."""
import os
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('APP_URL','http://127.0.0.1:4175/finance/'))
 assert page.locator('.sidebar-note').count()==0
 assert 'Шаг за шагом к большему' not in page.locator('body').inner_text()
 now=page.evaluate("new Date().toLocaleDateString('sv-SE')")
 yesterday=page.evaluate("(()=>{let d=new Date();d.setDate(d.getDate()-1);return d.toLocaleDateString('sv-SE')})()")
 older=page.evaluate("(()=>{let d=new Date();d.setDate(d.getDate()-3);return d.toLocaleDateString('sv-SE')})()")
 def open_editor(kind='Расход'):page.locator('.heading-actions').get_by_role('button',name=kind,exact=True).click()
 def state():return page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
 def complete(cat='Продукты'):
  page.get_by_label('Сумма, ₽',exact=True).fill('100')
  page.get_by_role('dialog').get_by_role('button',name=cat,exact=True).click()
  page.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
 open_editor();expect(page.get_by_label('Дата',exact=True)).to_have_value(now)
 page.get_by_label('Дата',exact=True).fill(yesterday);complete()
 assert state()['settings']['lastExpenseDate']==yesterday
 open_editor();expect(page.get_by_label('Дата',exact=True)).to_have_value(yesterday);complete()
 assert [t['date'] for t in state()['transactions']]==[yesterday,yesterday]
 page.reload();open_editor();expect(page.get_by_label('Дата',exact=True)).to_have_value(yesterday)
 page.get_by_label('Дата',exact=True).fill(older)
 page.get_by_role('button',name='Отмена',exact=True).click()
 open_editor();expect(page.get_by_label('Дата',exact=True)).to_have_value(yesterday)
 page.get_by_role('dialog').get_by_role('button',name='Доход',exact=True).click()
 expect(page.get_by_label('Дата',exact=True)).to_have_value(now)
 page.get_by_role('dialog').get_by_role('button',name='Расход',exact=True).click()
 expect(page.get_by_label('Дата',exact=True)).to_have_value(yesterday)
 page.get_by_role('button',name='Отмена',exact=True).click()
 open_editor('Доход');page.get_by_label('Дата',exact=True).fill(older);complete('Зарплата')
 assert state()['settings']['lastExpenseDate']==yesterday
 page.locator('.transaction').filter(has_text='Продукты').first.click()
 page.get_by_label('Дата',exact=True).fill(older);complete()
 assert state()['settings']['lastExpenseDate']==yesterday
 open_editor();expect(page.get_by_label('Дата',exact=True)).to_have_value(yesterday)
 page.get_by_label('Дата',exact=True).fill(older);complete()
 assert state()['settings']['lastExpenseDate']==older
 page.locator('.sidebar nav').get_by_role('button',name='Настройки',exact=True).click()
 page.get_by_role('button',name='Розовая',exact=True).click()
 assert state()['settings']['lastExpenseDate']==older
 with page.expect_download() as dl:page.get_by_role('button',name='Скачать резервную копию JSON',exact=True).click()
 import json
 assert json.load(open(dl.value.path()))['settings']['lastExpenseDate']==older
 page.set_viewport_size({'width':390,'height':844})
 page.locator('.bottom-nav').get_by_role('button',name='Добавить',exact=True).click()
 expect(page.get_by_label('Дата',exact=True)).to_have_value(older)
 assert not errors,errors
 print('PASS: default today, last saved expense date, multiple entries, reload, cancel, income/type switch, edit isolation, theme/backup preservation, mobile quick add.')
 b.close()
