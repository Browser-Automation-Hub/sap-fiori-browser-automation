/**
 * actions.js — Core automation actions for SAP Fiori
 *
 * Each function accepts a Puppeteer Page instance and options.
 * All actions use retry() + humanDelay() for reliability.
 */
'use strict';

require('dotenv').config();

/**
 * login_fiori — Authenticate to SAP Fiori Launchpad with SSO
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function login_fiori(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: login_fiori', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      const BASE_URL = process.env.SAP_FIORI_URL;
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' }); // Redirects to SAP IAS or Azure AD
    await page.waitForSelector('input[name="loginfmt"], input[id*="username"], input[type="email"]', { timeout: 20000 });
    await humanType(page, 'input[name="loginfmt"], input[id*="username"], input[type="email"]', process.env.SAP_FIORI_USERNAME);
    await page.click('input[type="submit"], button[type="submit"]');
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await humanType(page, 'input[type="password"]', process.env.SAP_FIORI_PASSWORD);
    await page.click('input[type="submit"], button[type="submit"]');
    // Handle MFA if prompted
    const mfaInput = await page.$('input[name="otc"], #idTxtBx_SAOTCC_OTC').catch(() => null);
    if (mfaInput) {
      const code = generateTOTP(process.env.MFA_SECRET);
      await mfaInput.type(code);
      await page.click('input[type="submit"]');
    }
    await page.waitForSelector('.sapUshellShellHead, #shell-header', { timeout: 30000 });
    return { status: 'logged_in' };
    } catch (err) {
      await page.screenshot({ path: `error-login_fiori-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * create_purchase_order — Create and submit purchase orders
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function create_purchase_order(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: create_purchase_order', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      const appName = 'Manage Purchase Orders';
    await page.waitForSelector('.sapUshellTile, .sapUshellContainerCell', { timeout: 20000 });
    // Search for the app in the Fiori launchpad
    const searchBtn = await page.$('#sf, .sapMSF input, [placeholder*="Search"]');
    if (searchBtn) {
      await searchBtn.click();
      await page.keyboard.type(appName);
      await page.waitForSelector('.sapUshellContainerCell[title*="Purchase"]', { timeout: 10000 }).catch(() => {});
    }
    // Find and click the tile
    const tile = await page.evaluateHandle((name) =>
      Array.from(document.querySelectorAll('.sapUshellTileContainerContent, .sapUshellTile')).find(el => el.textContent.includes(name)),
      appName
    );
    if (tile) {
      await tile.asElement()?.click();
    } else {
      throw new Error(`SAP Fiori app tile not found: ${appName}`);
    }
    await page.waitForSelector('[id*="Supplier-inner"], [id*="supplier-input"]', { timeout: 20000 });
    if (opts.supplier) {
      await page.type('[id*="Supplier-inner"]', opts.supplier);
      await page.waitForSelector('.sapMLIB', { timeout: 5000 }).catch(() => {});
      await page.click('.sapMLIB:first-child').catch(() => {});
    }
    return { status: 'navigated', screen: 'create_po' };
    } catch (err) {
      await page.screenshot({ path: `error-create_purchase_order-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * approve_workflow — Approve pending workflow items in bulk
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function approve_workflow(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: approve_workflow', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      await page.waitForSelector('.sapUshellTile[title*="My Inbox"], [title*="Notifications"]', { timeout: 20000 });
    await page.click('.sapUshellTile[title*="My Inbox"]');
    await page.waitForSelector('.sapMList .sapMListItem, .sapMFlexBox .sapMLIBContent', { timeout: 15000 });
    const tasks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.sapMList .sapMListItem, .sapMFlexBox .sapMLIBContent')).map(el => ({
        title: el.querySelector('.sapMSLITitle, .title')?.textContent?.trim(),
        description: el.querySelector('.sapMSLIDescription, .description')?.textContent?.trim(),
      }))
    );
    // Approve first pending task
    if (tasks.length > 0) {
      await page.click('.sapMList .sapMListItem:first-child');
      await page.waitForSelector('button[id*="Approve"], button[title*="Approve"]', { timeout: 10000 });
      await page.click('button[id*="Approve"], button[title*="Approve"]');
      await page.waitForSelector('.sapMDialogScrollCont, [id*="Accept"]', { timeout: 10000 }).catch(() => {});
      const okBtn = await page.$('.sapMDialogScrollCont button[id*="OK"], [id*="Accept"]');
      if (okBtn) await okBtn.click();
    }
    return { status: 'ok', tasksFound: tasks.length };
    } catch (err) {
      await page.screenshot({ path: `error-approve_workflow-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * extract_financial_data — Download financial reports and GL entries
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function extract_financial_data(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: extract_financial_data', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      // TODO: Replace with actual SAP Fiori selectors
    // await page.goto(`${process.env.SAP_FIORI_URL}/path/to/extract-financial-data`);
    // await page.waitForSelector('.main-content, #content, [data-testid="loaded"]', { timeout: 15000 });
    const result = await page.evaluate(() => {
      return { status: 'ok', data: null };
    });
    log('extract_financial_data complete', result);
    return result;
    } catch (err) {
      await page.screenshot({ path: `error-extract_financial_data-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * manage_invoices — Process and match vendor invoices
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function manage_invoices(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: manage_invoices', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      // TODO: Replace with actual SAP Fiori selectors
    // await page.goto(`${process.env.SAP_FIORI_URL}/path/to/manage-invoices`);
    // await page.waitForSelector('.main-content, #content, [data-testid="loaded"]', { timeout: 15000 });
    const result = await page.evaluate(() => {
      return { status: 'ok', data: null };
    });
    log('manage_invoices complete', result);
    return result;
    } catch (err) {
      await page.screenshot({ path: `error-manage_invoices-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

module.exports = {
  login_fiori,
  create_purchase_order,
  approve_workflow,
  extract_financial_data,
  manage_invoices,
};
