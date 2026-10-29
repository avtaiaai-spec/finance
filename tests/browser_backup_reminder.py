"""Weekly local reminder, snooze, explicit file confirmation and opt-out."""
import os,json
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.clock.install(time=datetime(2026,10,29,12,tzinfo=timezone.utc))
 page.goto(os.environ.get('APP_URL','http://127.0.0.1:4175/finance/'))
 assert page.evaluate("localStorage.getItem('calm-finance-v1')") is None
 page.locator('.bottom-nav').get_by_role('button',name='Добавить',exact=True).click()
 page.get_by_label('Сумма, ₽',exact=True).fill('230')
 page.get_by_role('dialog').get_by_role('button',name='Продукты',exact=True).click()
 page.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
 def state():return page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
 assert state()['settings']['backupReminder']['startedOn']=='2026-10-29'
 expect(page.locator('.backup-reminder')).to_have_count(0)
 page.evaluate("(()=>{let d=JSON.parse(localStorage.getItem('calm-finance-v1'));d.settings.backupReminder.startedOn='2026-10-22';localStorage.setItem('calm-finance-v1',JSON.stringify(d));})()")
 page.reload();expect(page.locator('.backup-reminder')).to_be_visible()
 with page.expect_download() as dl:page.locator('.backup-reminder').get_by_role('button',name='Скачать копию',exact=True).click()
 exported=json.load(open(dl.value.path()));assert len(exported['transactions'])==1
 assert 'lastBackupOn' not in state()['settings']['backupReminder']
 page.get_by_role('button',name='Позже',exact=True).click()
 expect(page.locator('.backup-reminder')).to_be_visible()
 page.get_by_role('button',name='Напомнить завтра',exact=True).click()
 expect(page.locator('.backup-reminder')).to_have_count(0)
 page.reload();expect(page.locator('.backup-reminder')).to_have_count(0)
 page.clock.set_system_time(datetime(2026,10,30,12,tzinfo=timezone.utc));page.evaluate("window.dispatchEvent(new Event('focus'))")
 expect(page.locator('.backup-reminder')).to_be_visible()
 with page.expect_download() as dl:page.get_by_role('button',name='Скачать копию',exact=True).click()
 exported=json.load(open(dl.value.path()));assert exported['settings']['backupReminder']['lastBackupOn']=='2026-10-30'
 page.get_by_role('button',name='Копия сохранена',exact=True).click()
 expect(page.locator('.backup-reminder')).to_have_count(0)
 assert state()['settings']['backupReminder']['lastBackupOn']=='2026-10-30'
 assert len(state()['transactions'])==1
 page.clock.set_system_time(datetime(2026,11,6,12,tzinfo=timezone.utc));page.evaluate("window.dispatchEvent(new Event('focus'))")
 expect(page.locator('.backup-reminder')).to_be_visible()
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.get_by_role('button',name='Открыть меню',exact=True).click()
 page.locator('.more-menu').get_by_role('button',name='Настройки',exact=True).click()
 page.get_by_label('Напоминать раз в неделю',exact=True).uncheck()
 expect(page.locator('.backup-reminder')).to_have_count(0)
 page.reload();assert state()['settings']['backupReminder']['enabled'] is False
 assert not errors,errors
 print('PASS: one-week scheduling, no empty-profile nag, local reminder, actual JSON download, confirmation, snooze, next week, opt-out, reload and mobile.')
 b.close()
