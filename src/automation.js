const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const fs = require('fs');

class AutomationEngine {
  constructor(config) {
    this.config = {
      targetUrl: config.targetUrl || '',
      uploadSelector: config.uploadSelector || 'input[type="file"]',
      submitSelector: config.submitSelector || '',
      waitAfterUpload: config.waitAfterUpload || 2000,
      waitAfterSubmit: config.waitAfterSubmit || 3000,
      headless: config.headless !== undefined ? config.headless : false,
      loopMode: config.loopMode || 'all',
      documents: config.documents || [],
      initialSteps: config.initialSteps || [],      // Run once at start
      perUploadSteps: config.perUploadSteps || [],  // Run before each upload
      postUploadSteps: config.postUploadSteps || [], // Run after each upload
      ...config
    };
    
    this.driver = null;
    this.isRunning = false;
    this.isPaused = false;
    this.resumeResolver = null;
    this.progressCallback = null;
    this.logCallback = null;
  }
  
  resume() {
    if (this.isPaused && this.resumeResolver) {
      this.isPaused = false;
      this.resumeResolver();
      this.resumeResolver = null;
      this.log('Automation resumed', 'info');
    }
  }

  async waitForResume() {
    this.isPaused = true;
    this.log('Automation paused. Please perform manual actions and click Resume.', 'warning');
    return new Promise(resolve => {
      this.resumeResolver = resolve;
    });
  }
  
  onProgress(callback) {
    this.progressCallback = callback;
  }
  
  onLog(callback) {
    this.logCallback = callback;
  }
  
  log(message, type = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type
    };
    
    if (this.logCallback) {
      this.logCallback(logEntry);
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
  
  getSelector(selector, type) {
    if (!selector) return null;
    
    // If type is explicitly provided
    if (type === 'xpath') return By.xpath(selector);
    if (type === 'id') return By.id(selector);
    if (type === 'css') return By.css(selector);
    if (type === 'name') return By.name(selector);
    
    // Auto-detect
    if (selector.startsWith('//') || selector.startsWith('(//')) {
      return By.xpath(selector);
    }
    
    if (selector.startsWith('id=')) {
      return By.id(selector.substring(3));
    }
    
    if (selector.startsWith('xpath=')) {
      return By.xpath(selector.substring(6));
    }

    if (selector.startsWith('css=')) {
      return By.css(selector.substring(4));
    }

    // Default to CSS selector if it looks like one, or just try CSS
    return By.css(selector);
  }
  
  emitProgress(current, total, status, currentFile = '') {
    if (this.progressCallback) {
      this.progressCallback({
        current,
        total,
        percentage: Math.round((current / total) * 100),
        status,
        currentFile
      });
    }
  }
  
  async run() {
    this.isRunning = true;
    const results = {
      successful: [],
      failed: [],
      startTime: new Date(),
      endTime: null
    };
    
    try {
      this.log('Starting automation engine (Selenium)...');
      
      const options = new chrome.Options();
      if (this.config.headless) {
        options.addArguments('--headless=new');
      }
      options.addArguments('--window-size=1280,720');
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      
      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
      
      // Navigate to target URL if provided
      if (this.config.targetUrl) {
        this.log(`Navigating to ${this.config.targetUrl}`);
        await this.driver.get(this.config.targetUrl);
        // Wait for page load (Selenium's get() waits for document.readyState === 'complete' by default)
        this.log('Page loaded successfully');
      } else {
        this.log('No target URL provided, starting with blank page', 'warning');
      }
      
      // Execute initial steps ONCE at the start
      if (this.config.initialSteps && this.config.initialSteps.length > 0) {
        this.log('Running initial steps (login, setup, etc.)...');
        await this.executeCustomSteps(this.config.initialSteps);
      }
      
      const loopMode = this.config.loopMode || 'all';
      
      if (loopMode === 'none') {
        this.log('Execution mode is "None" - finished after initial steps', 'success');
        this.emitProgress(1, 1, 'completed');
        return results;
      }
      
      if (loopMode === 'once') {
        this.log('Execution mode is "Once" - running all sections one time');
        
        try {
          if (this.config.perUploadSteps && this.config.perUploadSteps.length > 0) {
            this.log('Running Per-Upload steps (once)');
            await this.executeCustomSteps(this.config.perUploadSteps);
          }

          if (this.config.documents && this.config.documents.length > 0) {
            this.log(`Uploading first document: ${this.config.documents[0].name}`);
            await this.uploadDocument(this.config.documents[0]);
          } else {
            this.log('No documents selected, skipping main upload part of "Once" flow', 'warning');
          }

          if (this.config.postUploadSteps && this.config.postUploadSteps.length > 0) {
            this.log('Running Verification steps (once)');
            await this.executeCustomSteps(this.config.postUploadSteps);
          }

          results.successful.push('Once-Run');
          this.log('✓ "Once" execution completed successfully', 'success');
        } catch (error) {
          results.failed.push({ name: 'Once-Run', error: error.message });
          this.log(`✗ "Once" execution failed: ${error.message}`, 'error');
        }

        this.emitProgress(1, 1, 'completed');
        return results;
      }
      
      const documents = this.config.documents || [];
      const totalDocs = documents.length;
      
      if (totalDocs === 0) {
        this.log('No documents selected for looping', 'warning');
        this.emitProgress(1, 1, 'completed');
        return results;
      }

      this.log(`Starting loop for ${totalDocs} documents in mode: ${loopMode}`);

      for (let i = 0; i < documents.length; i++) {
        if (!this.isRunning) break;
        
        const doc = documents[i];
        const dataSets = await this.parseDocumentContent(doc);
        const totalRows = dataSets.length;
        
        for (let j = 0; j < dataSets.length; j++) {
          if (!this.isRunning) break;
          
          const docData = dataSets[j];
          const rowInfo = this.config.dataDrivenMode ? ` (Row ${j+1}/${totalRows})` : '';
          this.emitProgress(i + 1, totalDocs, 'processing', `${doc.name}${rowInfo}`);
          
          try {
            if (loopMode === 'all' || loopMode === 'perUpload') {
              if (this.config.perUploadSteps && this.config.perUploadSteps.length > 0) {
                this.log(`Running Per-Upload steps for: ${doc.name}${rowInfo}`);
                await this.executeCustomSteps(this.config.perUploadSteps, docData);
              }
            } else if (loopMode === 'initial') {
              if (this.config.initialSteps && this.config.initialSteps.length > 0) {
                this.log(`Running Initial steps for: ${doc.name}${rowInfo}`);
                await this.executeCustomSteps(this.config.initialSteps, docData);
              }
            }

            if (loopMode === 'all') {
              await this.uploadDocument(doc, docData);
            }

            if (loopMode === 'all' || loopMode === 'postUpload') {
              if (this.config.postUploadSteps && this.config.postUploadSteps.length > 0) {
                this.log(`Running Verification steps for: ${doc.name}${rowInfo}`);
                await this.executeCustomSteps(this.config.postUploadSteps, docData);
              }
            }
            
            results.successful.push({ doc, row: j });
            if (this.config.dataDrivenMode) {
              this.log(`✓ Completed row ${j+1} of ${doc.name}`, 'success');
            } else {
              this.log(`✓ Successfully processed: ${doc.name}`, 'success');
            }
          } catch (error) {
            results.failed.push({ document: doc, row: j, error: error.message });
            this.log(`✗ Failed on ${doc.name}${rowInfo}: ${error.message}`, 'error');
            
            if (this.config.keepBrowserOpen) {
              this.log('Keeping browser open for debugging as requested', 'warning');
              this.isRunning = false;
              break;
            }
          }
        }
        
        if (i < documents.length - 1 && this.isRunning) {
          await this.sleep(this.config.waitAfterUpload);
        }
      }
      
    } catch (error) {
      this.log(`Automation error: ${error.message}`, 'error');
      throw error;
    } finally {
      results.endTime = new Date();
      
      if (this.driver && !this.config.keepBrowserOpen) {
        await this.driver.quit();
        this.driver = null;
      } else if (this.driver && this.config.keepBrowserOpen) {
        this.log('Automation finished. Keeping browser open as requested.', 'info');
      }
      
      this.isRunning = false;
      this.log('Automation completed');
      this.emitProgress(results.successful.length, this.config.documents.length || 1, 'completed');
    }
    
    return results;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async parseDocumentContent(doc) {
    let baseData = {
      fileName: doc.name,
      filePath: doc.path,
      extension: doc.extension
    };

    try {
      const content = fs.readFileSync(doc.path, 'utf8');
      
      if (doc.extension === '.json') {
        const parsed = JSON.parse(content);
        if (this.config.dataDrivenMode && Array.isArray(parsed)) {
          return parsed.map(item => Object.assign({}, baseData, item));
        }
        return [Object.assign({}, baseData, parsed)];
      } 
      
      if (doc.extension === '.csv') {
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return [baseData];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const rowDatas = [];
        
        const rowsToProcess = this.config.dataDrivenMode ? lines.slice(1) : [lines[1]];
        
        for (const row of rowsToProcess) {
          const values = row.split(',').map(v => v.trim());
          const itemData = Object.assign({}, baseData);
          headers.forEach((h, i) => {
            if (values[i] !== undefined) itemData[h] = values[i];
          });
          rowDatas.push(itemData);
        }
        return rowDatas;
      }

      return [Object.assign({}, baseData, { content: content.trim() })];
      
    } catch (e) {
      this.log(`Warning: Failed to parse ${doc.name}: ${e.message}`, 'warning');
    }
    return [baseData];
  }

  resolveVariables(text, data) {
    if (typeof text !== 'string' || !data) return text;
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return data[trimmedKey] !== undefined ? data[trimmedKey] : match;
    });
  }
  
  async uploadDocument(doc, docData = null) {
    const selector = this.getSelector(this.config.uploadSelector);
    this.log(`Attempting to set file in: ${this.config.uploadSelector}`);
    
    try {
      const uploadInput = await this.driver.wait(until.elementLocated(selector), 10000);

      const info = await this.driver.executeScript(el => ({
        tagName: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        id: el.id,
        name: el.getAttribute('name'),
        isVisible: el.offsetWidth > 0 && el.offsetHeight > 0
      }), uploadInput);

      this.log(`Found element: <${info.tagName} id="${info.id}" type="${info.type}"> (Visible: ${info.isVisible})`);

      if (info.tagName !== 'input' || info.type !== 'file') {
        this.log('Warning: Target element is not an <input type="file">. Upload might fail.', 'warning');
      }

      // In Selenium, we send the absolute path to the file input
      await uploadInput.sendKeys(path.resolve(doc.path));
      
      // Manually trigger events for frameworks like Knockout/jQuery
      await this.driver.executeScript(el => {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, uploadInput);

      this.log(`✓ File attached: ${doc.name}`);
      
      await this.sleep(1000);
      
      if (this.config.submitSelector) {
        const submitSelector = this.getSelector(this.config.submitSelector);
        this.log(`Clicking submit button: ${this.config.submitSelector}`);
        
        const submitBtn = await this.driver.wait(until.elementLocated(submitSelector), 5000);
        await this.driver.wait(until.elementIsVisible(submitBtn), 5000);
        await submitBtn.click();
        
        await this.sleep(this.config.waitAfterSubmit);
      }
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }
  
  async executeCustomSteps(steps, data = null) {
    const enabledSteps = steps.filter(step => step.enabled !== false);
    
    for (const step of enabledSteps) {
      if (!this.isRunning) break;
      
      const description = this.resolveVariables(step.description || step.action, data);
      this.log(`Executing step: ${description}`);
      
      const rawSelector = step.selector || '';
      const selector = this.getSelector(this.resolveVariables(rawSelector, data), step.selectorType);
      const value = this.resolveVariables(step.value || '', data);
      const url = this.resolveVariables(step.url || '', data);
      
      let element;
      if (selector && step.action !== 'navigate' && step.action !== 'wait' && step.action !== 'refresh' && step.action !== 'press' && step.action !== 'screenshot' && step.action !== 'pause') {
        element = await this.driver.wait(until.elementLocated(selector), step.timeout || 10000);
      }

      switch (step.action) {
        case 'click':
          await this.driver.wait(until.elementIsVisible(element), 5000);
          await element.click();
          break;

        case 'check':
          if (!(await element.isSelected())) {
            await element.click();
          }
          break;

        case 'uncheck':
          if (await element.isSelected()) {
            await element.click();
          }
          break;

        case 'dblclick':
          const actions = this.driver.actions({async: true});
          await actions.doubleClick(element).perform();
          break;

        case 'rightclick':
          const rightClickActions = this.driver.actions({async: true});
          await rightClickActions.contextClick(element).perform();
          break;

        case 'hover':
          const hoverActions = this.driver.actions({async: true});
          await hoverActions.move({origin: element}).perform();
          break;

        case 'clear':
          await element.clear();
          break;

        case 'scrollIntoView':
          await this.driver.executeScript("arguments[0].scrollIntoView(true);", element);
          break;
          
        case 'fill':
          await element.clear();
          await element.sendKeys(value);
          break;
          
        case 'type':
          await element.sendKeys(value);
          break;
          
        case 'select':
          this.log(`Selecting option "${value}" in dropdown "${rawSelector}"`);
          // Basic select implementation
          await element.findElement(By.xpath(`.//option[text()="${value}" or @value="${value}"]`)).click();
          break;
          
        case 'wait':
          await this.sleep(step.duration || 1000);
          break;
          
        case 'waitForSelector':
          await this.driver.wait(until.elementLocated(selector), step.timeout || 10000);
          break;
          
        case 'press':
          const key = Key[step.key.toUpperCase()] || step.key;
          await this.driver.switchTo().activeElement().sendKeys(key);
          break;
          
        case 'navigate':
          await this.driver.get(url);
          break;
          
        case 'refresh':
          await this.driver.navigate().refresh();
          break;
          
        case 'screenshot':
          const screenshotPath = step.path || `screenshot-${Date.now()}.png`;
          const fullPath = path.resolve(screenshotPath);
          const data = await this.driver.takeScreenshot();
          fs.writeFileSync(fullPath, data, 'base64');
          this.log(`Screenshot saved to: ${fullPath}`, 'success');
          break;

        case 'attachFile':
          const customPath = value || data.filePath;
          this.log(`Attaching file: ${customPath}`);
          await element.sendKeys(path.resolve(customPath));
          await this.driver.executeScript(el => {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }, element);
          break;

        case 'pause':
          await this.waitForResume();
          break;

        case 'assertVisible':
          await this.driver.wait(until.elementIsVisible(element), step.timeout || 5000);
          break;

        case 'assertText':
          await this.driver.wait(until.elementTextContains(element, value), step.timeout || 5000);
          break;

        case 'reloadUntil':
          const targetText = value;
          const interval = step.duration || 5000;
          let timeout = step.timeout || 300000;
          const isInfinite = step.infiniteTimeout || false;
          const loopStartTime = Date.now();
          
          if (isInfinite) {
            this.log(`Waiting FOREVER for status "${targetText}"...`);
            timeout = Infinity;
          } else {
            this.log(`Waiting for status "${targetText}" (Timeout: ${timeout/1000}s)...`);
          }
          
          while (Date.now() - loopStartTime < timeout) {
            if (!this.isRunning) break;
            
            await this.driver.navigate().refresh();
            
            try {
              const el = await this.driver.wait(until.elementLocated(selector), 5000);
              const currentText = await el.getText();
              this.log(`Current status: ${currentText.trim()}`);
              
              if (currentText.includes(targetText)) {
                this.log(`✓ Target status "${targetText}" reached!`, 'success');
                break;
              }
            } catch (e) {
              this.log(`Status element not found, refreshing again...`);
            }
            
            await this.sleep(interval);
          }
          
          if (Date.now() - loopStartTime >= timeout) {
            throw new Error(`Timed out waiting for "${targetText}" after ${timeout/1000}s`);
          }
          break;
          
        default:
          this.log(`Unknown action: ${step.action}`, 'warning');
      }
      
      if (step.waitAfter) {
        await this.sleep(step.waitAfter);
      }
    }
  }
  
  async stop() {
    this.isRunning = false;
    this.log('Stopping automation...', 'warning');
    
    if (this.driver) {
      try {
        await this.driver.quit();
      } catch (e) {}
      this.driver = null;
    }
  }
}

module.exports = { AutomationEngine };
