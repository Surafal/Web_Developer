const { chromium } = require('playwright');
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
    
    this.browser = null;
    this.context = null;
    this.page = null;
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
    if (!selector) return selector;
    
    // If type is explicitly provided (from custom steps)
    if (type === 'xpath' && !selector.startsWith('xpath=') && !selector.startsWith('//')) {
      return `xpath=${selector}`;
    }
    if (type === 'id' && !selector.startsWith('id=')) {
      return `id=${selector}`;
    }
    
    // Auto-detect XPath if it starts with //
    if ((selector.startsWith('//') || selector.startsWith('(//')) && !selector.startsWith('xpath=')) {
      return `xpath=${selector}`;
    }
    
    // Auto-detect ID if it starts with id=
    if (selector.startsWith('id=')) {
      return selector;
    }

    return selector;
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
      this.log('Starting automation engine...');
      
      // Launch browser
      this.browser = await chromium.launch({
        headless: this.config.headless,
        slowMo: 100 // Slow down for visibility
      });
      
      this.context = await this.browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1280, height: 720 }
      });
      
      this.page = await this.context.newPage();
      
      // Navigate to target URL if provided
      if (this.config.targetUrl) {
        this.log(`Navigating to ${this.config.targetUrl}`);
        await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
        this.log('Page loaded successfully');
      } else {
        this.log('No target URL provided, starting with blank page', 'warning');
      }
      
      // Execute initial steps ONCE at the start (e.g., login, setup, etc.)
      if (this.config.initialSteps && this.config.initialSteps.length > 0) {
        this.log('Running initial steps (login, setup, etc.)...');
        await this.executeCustomSteps(this.config.initialSteps);
      }
      
      const loopMode = this.config.loopMode || 'all';
      
      // If loop mode is 'none', we are done after initial steps
      if (loopMode === 'none') {
        this.log('Execution mode is "None" - finished after initial steps', 'success');
        this.emitProgress(1, 1, 'completed');
        return results;
      }
      
      // If loop mode is 'once', run all sections exactly one time
      if (loopMode === 'once') {
        this.log('Execution mode is "Once" - running all sections one time');
        
        try {
          // 1. Per-Upload Steps
          if (this.config.perUploadSteps && this.config.perUploadSteps.length > 0) {
            this.log('Running Per-Upload steps (once)');
            await this.executeCustomSteps(this.config.perUploadSteps);
          }

          // 2. Main Upload (if a document is available)
          if (this.config.documents && this.config.documents.length > 0) {
            this.log(`Uploading first document: ${this.config.documents[0].name}`);
            await this.uploadDocument(this.config.documents[0]);
          } else {
            this.log('No documents selected, skipping main upload part of "Once" flow', 'warning');
          }

          // 3. Post-Upload Steps
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
        
        // Parse all data sets from the file (e.g., all rows of CSV)
        const dataSets = await this.parseDocumentContent(doc);
        const totalRows = dataSets.length;
        
        for (let j = 0; j < dataSets.length; j++) {
          if (!this.isRunning) break;
          
          const docData = dataSets[j];
          const rowInfo = this.config.dataDrivenMode ? ` (Row ${j+1}/${totalRows})` : '';
          this.emitProgress(i + 1, totalDocs, 'processing', `${doc.name}${rowInfo}`);
          
          try {
            // A. Per-Upload Steps (Include in 'all', 'perUpload', 'initial' loop modes)
            if (loopMode === 'all' || loopMode === 'perUpload') {
              if (this.config.perUploadSteps && this.config.perUploadSteps.length > 0) {
                this.log(`Running Per-Upload steps for: ${doc.name}${rowInfo}`);
                await this.executeCustomSteps(this.config.perUploadSteps, docData);
              }
            } else if (loopMode === 'initial') {
              // Special case: loop the initial steps for each file if requested
              if (this.config.initialSteps && this.config.initialSteps.length > 0) {
                this.log(`Running Initial steps for: ${doc.name}${rowInfo}`);
                await this.executeCustomSteps(this.config.initialSteps, docData);
              }
            }

            // B. Main Upload (Only in 'all' mode)
            if (loopMode === 'all') {
              await this.uploadDocument(doc, docData);
            }

            // C. Post-Upload Steps (Include in 'all' or 'postUpload' loop modes)
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
              this.isRunning = false; // Stop further processing to allow debug
              break;
            }
          }
        }
        
        // Wait between documents
        if (i < documents.length - 1 && this.isRunning) {
          await this.page.waitForTimeout(this.config.waitAfterUpload);
        }
      }
      
    } catch (error) {
      this.log(`Automation error: ${error.message}`, 'error');
      throw error;
    } finally {
      results.endTime = new Date();
      
      if (this.browser && !this.config.keepBrowserOpen) {
        await this.browser.close();
        this.browser = null;
      } else if (this.browser && this.config.keepBrowserOpen) {
        this.log('Automation finished. Keeping browser open as requested.', 'info');
      }
      
      this.isRunning = false;
      this.log('Automation completed');
      
      // Final progress update
      this.emitProgress(results.successful.length, this.config.documents.length || 1, 'completed');
    }
    
    return results;
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
        
        // If data driven, loop all rows; otherwise just the first data row
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

      // For other types (txt, ach, etc.)
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
    // Wait for upload input to be available
    const selector = this.getSelector(this.config.uploadSelector);
    this.log(`Attempting to set file in: ${selector}`);
    
    try {
      const uploadInput = await this.page.waitForSelector(selector, {
        state: 'attached',
        timeout: 10000
      });

      const info = await uploadInput.evaluate(el => ({
        tagName: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        id: el.id,
        name: el.getAttribute('name'),
        isVisible: el.offsetWidth > 0 && el.offsetHeight > 0
      }));

      this.log(`Found element: <${info.tagName} id="${info.id}" type="${info.type}"> (Visible: ${info.isVisible})`);

      if (info.tagName !== 'input' || info.type !== 'file') {
        this.log('Warning: Target element is not an <input type="file">. Upload might fail.', 'warning');
      }

      // Set the file input directly
      await uploadInput.setInputFiles(doc.path);
      
      // Manually trigger events for frameworks like Knockout/jQuery
      await uploadInput.evaluate(el => {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      this.log(`✓ File attached: ${doc.name}`);
      
      // Wait for any dynamic updates after file selection
      await this.page.waitForTimeout(1000);
      
      // Click submit button if specified
      if (this.config.submitSelector) {
        const submitSelector = this.getSelector(this.config.submitSelector);
        this.log(`Clicking submit button: ${submitSelector}`);
        
        // Wait for it to be ready
        const submitBtn = await this.page.waitForSelector(submitSelector, { state: 'visible', timeout: 5000 });
        await submitBtn.click();
        
        await this.page.waitForTimeout(this.config.waitAfterSubmit);
        await this.page.waitForLoadState('networkidle').catch(() => {});
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
      
      switch (step.action) {
        case 'click':
          await this.page.click(selector, { force: step.force || false });
          break;

        case 'check':
          await this.page.check(selector, { force: step.force || false });
          break;

        case 'uncheck':
          await this.page.uncheck(selector, { force: step.force || false });
          break;

        case 'dblclick':
          await this.page.dblclick(selector, { force: step.force || false });
          break;

        case 'rightclick':
          await this.page.click(selector, { button: 'right', force: step.force || false });
          break;

        case 'hover':
          await this.page.hover(selector, { force: step.force || false });
          break;

        case 'clear':
          await this.page.fill(selector, '');
          break;

        case 'scrollIntoView':
          const scrollEl = await this.page.waitForSelector(selector);
          await scrollEl.scrollIntoViewIfNeeded();
          break;
          
        case 'fill':
          await this.page.fill(selector, value);
          break;
          
        case 'type':
          await this.page.type(selector, value, { delay: 50 });
          break;
          
        case 'select':
          this.log(`Selecting option "${value}" in dropdown "${selector}"`);
          await this.page.selectOption(selector, value);
          break;
          
        case 'wait':
          await this.page.waitForTimeout(step.duration || 1000);
          break;
          
        case 'waitForSelector':
          await this.page.waitForSelector(selector, { timeout: step.timeout || 10000 });
          break;
          
        case 'press':
          await this.page.keyboard.press(step.key);
          break;
          
        case 'navigate':
          await this.page.goto(url, { waitUntil: 'networkidle' });
          break;
          
        case 'refresh':
          await this.page.reload({ waitUntil: 'networkidle' });
          break;
          
        case 'screenshot':
          const screenshotPath = step.path || `screenshot-${Date.now()}.png`;
          const fullPath = path.resolve(screenshotPath);
          await this.page.screenshot({ path: fullPath });
          this.log(`Screenshot saved to: ${fullPath}`, 'success');
          break;

        case 'attachFile':
          const customPath = value || data.filePath;
          this.log(`Attaching file: ${customPath}`);
          const fileInput = await this.page.waitForSelector(selector, { state: 'attached', timeout: 10000 });
          await fileInput.setInputFiles(customPath);
          // Trigger events for frameworks
          await fileInput.evaluate(el => {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          });
          break;

        case 'pause':
          await this.waitForResume();
          break;

        case 'assertVisible':
          await this.page.waitForSelector(selector, { state: 'visible', timeout: step.timeout || 5000 });
          break;

        case 'assertText':
          const element = await this.page.waitForSelector(selector, { timeout: step.timeout || 5000 });
          const text = await element.textContent();
          if (!text.includes(value)) {
            throw new Error(`Assertion failed: Expected text "${value}" not found in element. Actual: "${text}"`);
          }
          break;

        case 'reloadUntil':
          const targetText = value;
          const interval = step.duration || 5000;
          let timeout = step.timeout || 300000; // 5 minute default
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
            
            await this.page.reload({ waitUntil: 'networkidle' }).catch(() => {});
            
            try {
              const el = await this.page.waitForSelector(selector, { timeout: 5000 });
              const currentText = await el.textContent();
              this.log(`Current status: ${currentText.trim()}`);
              
              if (currentText.includes(targetText)) {
                this.log(`✓ Target status "${targetText}" reached!`, 'success');
                break; // Exit while loop
              }
            } catch (e) {
              this.log(`Status element not found, refreshing again...`);
            }
            
            await this.page.waitForTimeout(interval);
          }
          
          if (Date.now() - loopStartTime >= timeout) {
            throw new Error(`Timed out waiting for "${targetText}" after ${timeout/1000}s`);
          }
          break;
          
        default:
          this.log(`Unknown action: ${step.action}`, 'warning');
      }
      
      if (step.waitAfter) {
        await this.page.waitForTimeout(step.waitAfter);
      }
    }
  }
  
  async stop() {
    this.isRunning = false;
    this.log('Stopping automation...', 'warning');
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { AutomationEngine };
