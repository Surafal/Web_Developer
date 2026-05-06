// UI Tester - Renderer Script
document.addEventListener('DOMContentLoaded', () => {
  // State
  let selectedFolder = null;
  let documents = [];
  let initialSteps = [];      // Run once at the start
  let perUploadSteps = [];    // Run before each file upload
  let postUploadSteps = [];   // Run after each file upload (verification)
  let currentStepType = null; // Track which step type we're adding/editing
  let editingStepIndex = null; // Track which step is being edited (null = adding new)
  let isRunning = false;
  let currentConfigFile = null; // Track the currently loaded config file

  // DOM Elements
  const elements = {
    // Config
    targetUrl: document.getElementById('targetUrl'),
    uploadSelector: document.getElementById('uploadSelector'),
    submitSelector: document.getElementById('submitSelector'),
    waitAfterUpload: document.getElementById('waitAfterUpload'),
    waitAfterSubmit: document.getElementById('waitAfterSubmit'),
    headless: document.getElementById('headless'),
    loopMode: document.getElementById('loopMode'),
    keepBrowserOpen: document.getElementById('keepBrowserOpen'),
    dataDrivenMode: document.getElementById('dataDrivenMode'),
    
    // Folder
    selectFolderBtn: document.getElementById('selectFolderBtn'),
    folderPath: document.getElementById('folderPath'),
    documentsContainer: document.getElementById('documentsContainer'),
    documentsList: document.getElementById('documentsList'),
    docCount: document.getElementById('docCount'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    uncheckAllBtn: document.getElementById('uncheckAllBtn'),
    filterJson: document.getElementById('filterJson'),
    filterCsv: document.getElementById('filterCsv'),
    filterTxt: document.getElementById('filterTxt'),
    folderPanel: document.getElementById('folderPanel'),
    perUploadPanel: document.getElementById('perUploadPanel'),
    postUploadPanel: document.getElementById('postUploadPanel'),
    
    // Steps
    initialStepsContainer: document.getElementById('initialSteps'),
    perUploadStepsContainer: document.getElementById('perUploadSteps'),
    postUploadStepsContainer: document.getElementById('postUploadSteps'),
    addInitialStepBtn: document.getElementById('addInitialStepBtn'),
    importInitialStepsBtn: document.getElementById('importInitialStepsBtn'),
    addPerUploadStepBtn: document.getElementById('addPerUploadStepBtn'),
    importPerUploadStepsBtn: document.getElementById('importPerUploadStepsBtn'),
    addPostUploadStepBtn: document.getElementById('addPostUploadStepBtn'),
    importPostUploadStepsBtn: document.getElementById('importPostUploadStepsBtn'),
    
    // Step Modal
    stepModal: document.getElementById('stepModal'),
    closeStepBtn: document.getElementById('closeStepBtn'),
    stepAction: document.getElementById('stepAction'),
    stepSelector: document.getElementById('stepSelector'),
    stepSelectorGroup: document.getElementById('stepSelectorGroup'),
    stepValue: document.getElementById('stepValue'),
    stepValueGroup: document.getElementById('stepValueGroup'),
    stepIsSecret: document.getElementById('stepIsSecret'),
    toggleValueVisibility: document.getElementById('toggleValueVisibility'),
    stepDuration: document.getElementById('stepDuration'),
    stepDurationGroup: document.getElementById('stepDurationGroup'),
    stepUrl: document.getElementById('stepUrl'),
    stepUrlGroup: document.getElementById('stepUrlGroup'),
    stepKey: document.getElementById('stepKey'),
    stepKeyGroup: document.getElementById('stepKeyGroup'),
    stepSelectorType: document.getElementById('stepSelectorType'),
    stepForce: document.getElementById('stepForce'),
    stepForceGroup: document.getElementById('stepForceGroup'),
    stepInfinite: document.getElementById('stepInfinite'),
    stepInfiniteGroup: document.getElementById('stepInfiniteGroup'),
    stepDescription: document.getElementById('stepDescription'),
    stepModalTitle: document.getElementById('stepModalTitle'),
    stepValidationError: document.getElementById('stepValidationError'),
    saveStepBtn: document.getElementById('saveStepBtn'),
    
    // Control
    startBtn: document.getElementById('startBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    stopBtn: document.getElementById('stopBtn'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    currentFile: document.getElementById('currentFile'),
    
    // Logs
    logsContainer: document.getElementById('logsContainer'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    
    // Preview Modal
    previewModal: document.getElementById('previewModal'),
    previewTitle: document.getElementById('previewTitle'),
    previewContent: document.getElementById('previewContent'),
    closePreviewBtn: document.getElementById('closePreviewBtn'),
    
    // Save/Load Config
    saveConfigBtn: document.getElementById('saveConfigBtn'),
    loadConfigBtn: document.getElementById('loadConfigBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    currentConfigName: document.getElementById('currentConfigName'),
    
    // Locator Assistant
    htmlInput: document.getElementById('htmlInput'),
    generateLocatorsBtn: document.getElementById('generateLocatorsBtn'),
    locatorResults: document.getElementById('locatorResults'),
    locatorsList: document.getElementById('locatorsList')
  };

  // Initialize event listeners
  function init() {
    // Folder selection
    elements.selectFolderBtn.addEventListener('click', handleFolderSelect);
    
    // Filters
    elements.filterJson.addEventListener('change', renderDocuments);
    elements.filterCsv.addEventListener('change', renderDocuments);
    elements.filterTxt.addEventListener('change', renderDocuments);
    
    // Selection
    elements.selectAllBtn.addEventListener('click', () => toggleAllDocuments(true));
    elements.uncheckAllBtn.addEventListener('click', () => toggleAllDocuments(false));
    
    // Steps - Initial
    elements.addInitialStepBtn.addEventListener('click', () => showStepModal('initial'));
    elements.importInitialStepsBtn.addEventListener('click', () => handleImportSteps('initial'));
    // Steps - Per Upload
    elements.addPerUploadStepBtn.addEventListener('click', () => showStepModal('perUpload'));
    elements.importPerUploadStepsBtn.addEventListener('click', () => handleImportSteps('perUpload'));
    // Steps - Post Upload
    elements.addPostUploadStepBtn.addEventListener('click', () => showStepModal('postUpload'));
    elements.importPostUploadStepsBtn.addEventListener('click', () => handleImportSteps('postUpload'));
    
    elements.closeStepBtn.addEventListener('click', () => hideModal(elements.stepModal));
    elements.stepAction.addEventListener('change', updateStepModalFields);
    elements.saveStepBtn.addEventListener('click', saveStep);
    
    // Clear validation error when user types in step modal inputs
    elements.stepSelector.addEventListener('input', hideStepValidationError);
    elements.stepValue.addEventListener('input', hideStepValidationError);
    elements.stepUrl.addEventListener('input', hideStepValidationError);
    elements.stepKey.addEventListener('input', hideStepValidationError);
    
    // Secret field behavior - toggle input type and visibility
    elements.stepIsSecret.addEventListener('change', handleSecretCheckboxChange);
    elements.toggleValueVisibility.addEventListener('click', toggleValueVisibility);
    
    // Control
    elements.startBtn.addEventListener('click', startAutomation);
    elements.stopBtn.addEventListener('click', stopAutomation);
    elements.resumeBtn.addEventListener('click', handleResume);
    
    // Logs
    elements.clearLogsBtn.addEventListener('click', clearLogs);
    
    // Preview Modal
    elements.closePreviewBtn.addEventListener('click', () => hideModal(elements.previewModal));
    
    // Save/Load Config
    elements.saveConfigBtn.addEventListener('click', handleSaveConfig);
    elements.loadConfigBtn.addEventListener('click', handleLoadConfig);
    elements.clearAllBtn.addEventListener('click', handleClearAll);
    
    // Locator Assistant
    elements.generateLocatorsBtn.addEventListener('click', generateLocators);
    
    // Close modals on background click
    elements.stepModal.addEventListener('click', (e) => {
      if (e.target === elements.stepModal) hideModal(elements.stepModal);
    });
    elements.previewModal.addEventListener('click', (e) => {
      if (e.target === elements.previewModal) hideModal(elements.previewModal);
    });
    
    // Set up IPC listeners
    window.electronAPI.onProgress(handleProgress);
    window.electronAPI.onLog(handleLog);
    
    // Load saved config if any
    loadConfig();
  }

  // Locator Assistant Generator
  function generateLocators() {
    const html = elements.htmlInput.value.trim();
    if (!html) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const element = doc.body.firstElementChild;

      if (!element) {
        addLog('Invalid HTML snippet', 'error');
        return;
      }

      const suggestions = [];
      const tag = element.tagName.toLowerCase();

      // 1. ID
      if (element.id) {
        suggestions.push({ type: 'ID', value: `id=${element.id}`, description: 'Direct ID' });
        suggestions.push({ type: 'CSS', value: `#${element.id}`, description: 'CSS ID selector' });
      }

      // 2. Name
      if (element.getAttribute('name')) {
        const name = element.getAttribute('name');
        suggestions.push({ type: 'XPath', value: `//${tag}[@name='${name}']`, description: 'Attribute: name' });
      }

      // 3. Data Test IDs
      ['data-testid', 'data-test', 'data-qa'].forEach(attr => {
        if (element.getAttribute(attr)) {
          const val = element.getAttribute(attr);
          suggestions.push({ type: 'XPath', value: `//${tag}[@${attr}='${val}']`, description: `Attribute: ${attr}` });
        }
      });

      // 4. Placeholder
      if (element.getAttribute('placeholder')) {
        const ph = element.getAttribute('placeholder');
        suggestions.push({ type: 'XPath', value: `//${tag}[@placeholder='${ph}']`, description: 'Attribute: placeholder' });
      }

      // 5. Text Content (for buttons, links, labels)
      const text = element.textContent.trim();
      if (text && text.length < 50) {
        suggestions.push({ type: 'XPath', value: `//${tag}[contains(text(), '${text}')]`, description: 'Contains text' });
        suggestions.push({ type: 'XPath', value: `//${tag}[text()='${text}']`, description: 'Exact text' });
      }

      // 6. Generic Type
      if (element.getAttribute('type')) {
        const type = element.getAttribute('type');
        suggestions.push({ type: 'XPath', value: `//${tag}[@type='${type}']`, description: `Type attribute: ${type}` });
      }

      renderLocatorSuggestions(suggestions);
    } catch (err) {
      addLog(`Error parsing HTML: ${err.message}`, 'error');
    }
  }

  function renderLocatorSuggestions(suggestions) {
    if (suggestions.length === 0) {
      elements.locatorsList.innerHTML = '<div style="color: var(--text-secondary);">No strong locators found. Try including more attributes.</div>';
    } else {
      elements.locatorsList.innerHTML = suggestions.map(s => `
        <div class="locator-item" style="background: var(--bg-primary); padding: 10px; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <div style="flex: 1; overflow: hidden;">
            <div style="font-size: 0.75rem; color: var(--accent-secondary); margin-bottom: 3px;">${s.type} - ${s.description}</div>
            <code style="font-family: monospace; font-size: 0.9rem; color: var(--text-primary); word-break: break-all;">${s.value}</code>
          </div>
          <button class="btn btn-small btn-secondary copy-locator-btn" data-value="${s.value}">Copy</button>
        </div>
      `).join('');

      // Add copy functionality
      elements.locatorsList.querySelectorAll('.copy-locator-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const val = e.target.dataset.value;
          navigator.clipboard.writeText(val);
          
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          btn.classList.add('btn-success');
          
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('btn-success');
          }, 2000);
        });
      });
    }

    elements.locatorResults.classList.remove('hidden');
  }

  // Folder Selection
  async function handleFolderSelect() {
    const result = await window.electronAPI.selectFolder();
    
    if (result.success) {
      selectedFolder = result.path;
      elements.folderPath.textContent = selectedFolder;
      
      // Scan for documents
      const scanResult = await window.electronAPI.scanFolder(selectedFolder);
      
      if (scanResult.success) {
        documents = scanResult.documents;
        renderDocuments();
        elements.documentsContainer.classList.remove('hidden');
        updateStartButton();
      } else {
        addLog(`Error scanning folder: ${scanResult.error}`, 'error');
      }
    }
  }

  // Render Documents List
  function renderDocuments() {
    const showJson = elements.filterJson.checked;
    const showCsv = elements.filterCsv.checked;
    const showTxt = elements.filterTxt.checked;
    
    const filtered = documents.filter(doc => {
      if (doc.extension === '.json' && showJson) return true;
      if (doc.extension === '.csv' && showCsv) return true;
      if (['.txt', '.ach', '.xml', '.dat'].includes(doc.extension) && showTxt) return true;
      return false;
    });
    
    elements.docCount.textContent = filtered.length;
    
    if (filtered.length === 0) {
      elements.documentsList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
          No documents found matching the filters
        </div>
      `;
      return;
    }
    
    elements.documentsList.innerHTML = filtered.map((doc, index) => `
      <div class="document-item" data-index="${index}">
        <input type="checkbox" class="doc-checkbox" data-path="${doc.path}" checked />
        <div class="document-info">
          <span class="document-name">${doc.name}</span>
          <span class="document-ext ${doc.extension.slice(1)}">${doc.extension.slice(1)}</span>
          <span class="document-size">${formatFileSize(doc.size)}</span>
        </div>
        <button class="document-preview-btn" data-path="${doc.path}" data-name="${doc.name}">
          Preview
        </button>
      </div>
    `).join('');
    
    // Add preview button listeners
    elements.documentsList.querySelectorAll('.document-preview-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const path = e.target.dataset.path;
        const name = e.target.dataset.name;
        await showFilePreview(path, name);
      });
    });
    
    // Add checkbox listeners
    elements.documentsList.querySelectorAll('.doc-checkbox').forEach(cb => {
      cb.addEventListener('change', updateStartButton);
    });
    
    updateStartButton();
  }

  // File Size Formatter
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Show File Preview
  async function showFilePreview(filePath, fileName) {
    const result = await window.electronAPI.previewFile(filePath);
    
    if (result.success) {
      elements.previewTitle.textContent = fileName;
      
      // Format JSON nicely
      if (result.extension === '.json') {
        try {
          const parsed = JSON.parse(result.content);
          elements.previewContent.textContent = JSON.stringify(parsed, null, 2);
        } catch {
          elements.previewContent.textContent = result.content;
        }
      } else {
        elements.previewContent.textContent = result.content;
      }
      
      elements.previewModal.classList.remove('hidden');
    } else {
      addLog(`Error previewing file: ${result.error}`, 'error');
    }
  }

  // Custom Steps
  function showStepModal(stepType, editIndex = null) {
    currentStepType = stepType;
    editingStepIndex = editIndex;
    
    const isEditing = editIndex !== null;
    let steps;
    if (stepType === 'initial') steps = initialSteps;
    else if (stepType === 'perUpload') steps = perUploadSteps;
    else steps = postUploadSteps;

    const stepToEdit = isEditing ? steps[editIndex] : null;
    
    // Update modal title based on step type and mode
    if (elements.stepModalTitle) {
      if (isEditing) {
        if (stepType === 'initial') elements.stepModalTitle.textContent = 'Edit Initial Step';
        else if (stepType === 'perUpload') elements.stepModalTitle.textContent = 'Edit Per-Upload Step';
        else elements.stepModalTitle.textContent = 'Edit Verification Step';
      } else {
        if (stepType === 'initial') elements.stepModalTitle.textContent = 'Add Initial Step (Run Once)';
        else if (stepType === 'perUpload') elements.stepModalTitle.textContent = 'Add Per-Upload Step (Run BEFORE Each File)';
        else elements.stepModalTitle.textContent = 'Add Verification Step (Run AFTER Submit)';
      }
    }
    
    // Update save button text
    elements.saveStepBtn.textContent = isEditing ? 'Save Changes' : 'Add Step';
    
    // Reset or populate form
    if (isEditing && stepToEdit) {
      elements.stepAction.value = stepToEdit.action || 'click';
      elements.stepSelector.value = stepToEdit.selector || '';
      elements.stepSelectorType.value = stepToEdit.selectorType || 'css';
      elements.stepValue.value = stepToEdit.value || '';
      elements.stepIsSecret.checked = stepToEdit.isSecret || false;
      elements.stepDuration.value = stepToEdit.duration || '1000';
      elements.stepUrl.value = stepToEdit.url || '';
      elements.stepKey.value = stepToEdit.key || '';
      elements.stepDescription.value = stepToEdit.description || '';
    } else {
      elements.stepAction.value = 'click';
      elements.stepSelector.value = '';
      elements.stepSelectorType.value = 'css';
      elements.stepValue.value = '';
      elements.stepIsSecret.checked = false;
      elements.stepDuration.value = '1000';
      elements.stepUrl.value = '';
      elements.stepKey.value = '';
      elements.stepDescription.value = '';
    }
    
    updateStepModalFields();
    handleSecretCheckboxChange(); // Initialize value input type based on secret checkbox
    hideStepValidationError(); // Clear any previous validation errors
    elements.stepModal.classList.remove('hidden');
  }

  function updateStepModalFields() {
    const action = elements.stepAction.value;
    
    // Hide all optional fields first
    elements.stepSelectorGroup.classList.add('hidden');
    elements.stepValueGroup.classList.add('hidden');
    elements.stepDurationGroup.classList.add('hidden');
    elements.stepUrlGroup.classList.add('hidden');
    elements.stepKeyGroup.classList.add('hidden');
    elements.stepForceGroup.classList.add('hidden');
    elements.stepInfiniteGroup.classList.add('hidden');
    
    // Show relevant fields based on action
    switch (action) {
      case 'click':
      case 'check':
      case 'uncheck':
      case 'dblclick':
      case 'rightclick':
      case 'hover':
      case 'waitForSelector':
      case 'assertVisible':
      case 'scrollIntoView':
        elements.stepSelectorGroup.classList.remove('hidden');
        elements.stepForceGroup.classList.remove('hidden');
        break;
      case 'attachFile':
        elements.stepSelectorGroup.classList.remove('hidden');
        elements.stepForceGroup.classList.remove('hidden');
        elements.stepValueGroup.classList.remove('hidden');
        break;
      case 'fill':
      case 'type':
      case 'clear':
      case 'select':
      case 'assertText':
        elements.stepSelectorGroup.classList.remove('hidden');
        elements.stepValueGroup.classList.remove('hidden');
        break;
      case 'wait':
      case 'reloadUntil':
        elements.stepDurationGroup.classList.remove('hidden');
        if (action === 'reloadUntil') {
          elements.stepSelectorGroup.classList.remove('hidden');
          elements.stepValueGroup.classList.remove('hidden');
          elements.stepInfiniteGroup.classList.remove('hidden');
        }
        break;
      case 'navigate':
        elements.stepUrlGroup.classList.remove('hidden');
        break;
      case 'press':
        elements.stepKeyGroup.classList.remove('hidden');
        break;
      case 'screenshot':
      case 'refresh':
        // No extra fields needed
        break;
    }
  }

  // Handle secret checkbox change - toggle input type
  function handleSecretCheckboxChange() {
    const isSecret = elements.stepIsSecret.checked;
    if (isSecret) {
      elements.stepValue.type = 'password';
      elements.toggleValueVisibility.classList.add('hidden-value');
    } else {
      elements.stepValue.type = 'text';
      elements.toggleValueVisibility.classList.remove('hidden-value');
    }
  }

  // Toggle visibility of the value field
  function toggleValueVisibility() {
    if (elements.stepValue.type === 'password') {
      elements.stepValue.type = 'text';
      elements.toggleValueVisibility.classList.remove('hidden-value');
    } else {
      elements.stepValue.type = 'password';
      elements.toggleValueVisibility.classList.add('hidden-value');
    }
  }

  function saveStep() {
    const action = elements.stepAction.value;
    const step = {
      action,
      description: elements.stepDescription.value || getDefaultDescription(action),
      enabled: true // Default for new steps
    };
    
    // Add relevant properties based on action
    switch (action) {
      case 'click':
      case 'dblclick':
      case 'rightclick':
      case 'hover':
      case 'waitForSelector':
      case 'assertVisible':
      case 'scrollIntoView':
      case 'attachFile':
        step.selector = elements.stepSelector.value;
        step.selectorType = elements.stepSelectorType.value;
        step.force = elements.stepForce.checked;
        if (!step.selector) {
          showStepValidationError('Please enter a selector');
          elements.stepSelector.focus();
          return;
        }
        break;
      case 'fill':
      case 'type':
      case 'clear':
      case 'select':
      case 'assertText':
        step.selector = elements.stepSelector.value;
        step.selectorType = elements.stepSelectorType.value;
        step.value = elements.stepValue.value;
        step.isSecret = elements.stepIsSecret.checked;
        if (!step.selector) {
          showStepValidationError('Please enter a selector');
          elements.stepSelector.focus();
          return;
        }
        break;
      case 'wait':
        step.duration = parseInt(elements.stepDuration.value) || 1000;
        break;
      case 'reloadUntil':
        step.selector = elements.stepSelector.value;
        step.selectorType = elements.stepSelectorType.value;
        step.value = elements.stepValue.value;
        step.duration = parseInt(elements.stepDuration.value) || 5000;
        step.infiniteTimeout = elements.stepInfinite.checked;
        if (!step.selector) {
          showStepValidationError('Please enter a selector');
          elements.stepSelector.focus();
          return;
        }
        break;
      case 'navigate':
        step.url = elements.stepUrl.value;
        if (!step.url) {
          showStepValidationError('Please enter a URL');
          elements.stepUrl.focus();
          return;
        }
        break;
      case 'press':
        step.key = elements.stepKey.value;
        if (!step.key) {
          showStepValidationError('Please enter a key');
          elements.stepKey.focus();
          return;
        }
        break;
      case 'screenshot':
        // Uses default name
        break;
    }
    
    // Add or update the step based on whether we're editing
    if (editingStepIndex !== null) {
      // Editing existing step
      let steps;
      if (currentStepType === 'initial') steps = initialSteps;
      else if (currentStepType === 'perUpload') steps = perUploadSteps;
      else steps = postUploadSteps;

      // Preserve enabled state if editing
      step.enabled = steps[editingStepIndex].enabled !== false;

      if (currentStepType === 'initial') {
        initialSteps[editingStepIndex] = step;
        renderSteps('initial');
      } else if (currentStepType === 'perUpload') {
        perUploadSteps[editingStepIndex] = step;
        renderSteps('perUpload');
      } else {
        postUploadSteps[editingStepIndex] = step;
        renderSteps('postUpload');
      }
    } else {
      // Adding new step
      if (currentStepType === 'initial') {
        initialSteps.push(step);
        renderSteps('initial');
      } else if (currentStepType === 'perUpload') {
        perUploadSteps.push(step);
        renderSteps('perUpload');
      } else {
        postUploadSteps.push(step);
        renderSteps('postUpload');
      }
    }
    
    editingStepIndex = null; // Reset editing state
    hideModal(elements.stepModal);
  }

  function getDefaultDescription(action) {
    const descriptions = {
      click: 'Click element',
      fill: 'Fill input field',
      type: 'Type text',
      select: 'Select from dropdown',
      wait: 'Wait',
      waitForSelector: 'Wait for element',
      navigate: 'Navigate to URL',
      press: 'Press key',
      screenshot: 'Take screenshot',
      pause: 'Manual pause',
      assertVisible: 'Verify element is visible',
      assertText: 'Verify element contains text'
    };
    return descriptions[action] || action;
  }

  function renderSteps(stepType) {
    let steps, container;
    if (stepType === 'initial') {
      steps = initialSteps;
      container = elements.initialStepsContainer;
    } else if (stepType === 'perUpload') {
      steps = perUploadSteps;
      container = elements.perUploadStepsContainer;
    } else {
      steps = postUploadSteps;
      container = elements.postUploadStepsContainer;
    }
    
    if (steps.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = steps.map((step, index) => `
      <div class="step-item ${step.enabled === false ? 'step-disabled' : ''}" data-index="${index}" data-type="${stepType}">
        <div class="step-enable-toggle">
          <input type="checkbox" class="step-enabled-checkbox" data-index="${index}" data-type="${stepType}" ${step.enabled !== false ? 'checked' : ''} title="Enable/Disable step" />
        </div>
        <div class="step-reorder-buttons">
          <button class="step-move-up" data-index="${index}" data-type="${stepType}" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button class="step-move-down" data-index="${index}" data-type="${stepType}" ${index === steps.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <span class="step-number">${index + 1}</span>
        <div class="step-details step-clickable" data-index="${index}" data-type="${stepType}">
          <span class="step-action">${step.action}</span>
          <span class="step-description">${step.description}</span>
          ${step.isSecret ? '<span class="step-secret-badge">🔒 Secret</span>' : ''}
          <span class="step-edit-hint">✎ click to edit</span>
        </div>
        <button class="step-remove" data-index="${index}" data-type="${stepType}">&times;</button>
      </div>
    `).join('');
    
    // Add click to edit listeners
    container.querySelectorAll('.step-clickable').forEach(el => {
      el.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        const type = e.currentTarget.dataset.type;
        showStepModal(type, index);
      });
    });
    
    // Add enable/disable toggle listeners
    container.querySelectorAll('.step-enabled-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const type = e.target.dataset.type;
        const enabled = e.target.checked;
        toggleStepEnabled(type, index, enabled);
      });
    });
    
    // Add move up button listeners
    container.querySelectorAll('.step-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        const type = e.target.dataset.type;
        moveStep(type, index, -1);
      });
    });
    
    // Add move down button listeners
    container.querySelectorAll('.step-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        const type = e.target.dataset.type;
        moveStep(type, index, 1);
      });
    });
    
    // Add remove button listeners
    container.querySelectorAll('.step-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering edit
        const index = parseInt(e.target.dataset.index);
        const type = e.target.dataset.type;
        if (type === 'initial') {
          initialSteps.splice(index, 1);
          renderSteps('initial');
        } else if (type === 'perUpload') {
          perUploadSteps.splice(index, 1);
          renderSteps('perUpload');
        } else {
          postUploadSteps.splice(index, 1);
          renderSteps('postUpload');
        }
      });
    });
  }

  // Move step up or down
  function moveStep(stepType, index, direction) {
    let steps;
    if (stepType === 'initial') steps = initialSteps;
    else if (stepType === 'perUpload') steps = perUploadSteps;
    else steps = postUploadSteps;

    const newIndex = index + direction;
    
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    // Swap the steps
    const temp = steps[index];
    steps[index] = steps[newIndex];
    steps[newIndex] = temp;
    
    renderSteps(stepType);
  }

  // Toggle step enabled state
  function toggleStepEnabled(stepType, index, enabled) {
    let steps;
    if (stepType === 'initial') steps = initialSteps;
    else if (stepType === 'perUpload') steps = perUploadSteps;
    else steps = postUploadSteps;

    if (steps[index]) {
      steps[index].enabled = enabled;
      renderSteps(stepType);
    }
  }

  // Show validation error in step modal
  function showStepValidationError(message) {
    if (elements.stepValidationError) {
      elements.stepValidationError.textContent = message;
      elements.stepValidationError.classList.remove('hidden');
    }
  }

  // Hide validation error in step modal
  function hideStepValidationError() {
    if (elements.stepValidationError) {
      elements.stepValidationError.textContent = '';
      elements.stepValidationError.classList.add('hidden');
    }
  }

  // Hide Modal
  function hideModal(modal) {
    modal.classList.add('hidden');
    // Clear any validation errors when closing
    hideStepValidationError();
  }

  // Update Start Button State
  function updateStartButton() {
    elements.startBtn.disabled = isRunning;
  }

  // Get Selected Documents
  function getSelectedDocuments() {
    const checkboxes = elements.documentsList.querySelectorAll('.doc-checkbox:checked');
    return Array.from(checkboxes).map(cb => {
      const docPath = cb.dataset.path;
      return documents.find(d => d.path === docPath);
    }).filter(Boolean);
  }

  // Toggle all documents selection
  function toggleAllDocuments(checked) {
    const checkboxes = elements.documentsList.querySelectorAll('.doc-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = checked;
    });
    updateStartButton();
  }

  // Start Automation
  async function startAutomation() {
    isRunning = true;
    elements.startBtn.classList.add('hidden');
    elements.stopBtn.classList.remove('hidden');
    elements.progressContainer.classList.remove('hidden');
    updateStartButton();
    
    saveConfig();
    
    const config = {
      targetUrl: elements.targetUrl.value,
      uploadSelector: elements.uploadSelector.value,
      submitSelector: elements.submitSelector.value,
      waitAfterUpload: parseInt(elements.waitAfterUpload.value) || 2000,
      waitAfterSubmit: parseInt(elements.waitAfterSubmit.value) || 3000,
      headless: elements.headless.checked,
      loopMode: elements.loopMode.value,
      keepBrowserOpen: elements.keepBrowserOpen.checked,
      dataDrivenMode: elements.dataDrivenMode.checked,
      documents: getSelectedDocuments(),
      initialSteps: initialSteps,
      perUploadSteps: perUploadSteps,
      postUploadSteps: postUploadSteps
    };
    
    addLog('Starting automation...', 'info');
    
    const result = await window.electronAPI.startAutomation(config);
    
    if (result.success) {
      const { successful, failed } = result.result;
      addLog(`Automation completed: ${successful.length} successful, ${failed.length} failed`, 
        failed.length > 0 ? 'warning' : 'success');
    } else {
      addLog(`Automation error: ${result.error}`, 'error');
    }
    
    isRunning = false;
    elements.startBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    updateStartButton();
  }

  // Stop Automation
  async function stopAutomation() {
    addLog('Stopping automation...', 'warning');
    await window.electronAPI.stopAutomation();
    isRunning = false;
    elements.startBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    elements.resumeBtn.classList.add('hidden');
    updateStartButton();
  }

  async function handleResume() {
    elements.resumeBtn.classList.add('hidden');
    await window.electronAPI.resumeAutomation();
  }

  // Handle Progress Updates
  function handleProgress(progress) {
    elements.progressFill.style.width = `${progress.percentage}%`;
    elements.progressText.textContent = `${progress.current}/${progress.total} (${progress.percentage}%)`;
    elements.currentFile.textContent = progress.currentFile ? `Uploading: ${progress.currentFile}` : '';
  }

  // Handle Log Messages
  function handleLog(log) {
    addLog(log.message, log.type);
    
    // Show resume button if automation is paused
    if (log.message.includes('Automation paused')) {
      elements.resumeBtn.classList.remove('hidden');
    }
  }

  // Add Log Entry
  function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-message">${message}</span>
    `;
    elements.logsContainer.appendChild(entry);
    elements.logsContainer.scrollTop = elements.logsContainer.scrollHeight;
  }

  // Clear Logs
  function clearLogs() {
    elements.logsContainer.innerHTML = '';
  }

  // Save/Load Config to localStorage (auto-save)
  function saveConfig() {
    const config = {
      targetUrl: elements.targetUrl.value,
      uploadSelector: elements.uploadSelector.value,
      submitSelector: elements.submitSelector.value,
      waitAfterUpload: elements.waitAfterUpload.value,
      waitAfterSubmit: elements.waitAfterSubmit.value,
      headless: elements.headless.checked,
      loopMode: elements.loopMode.value,
      keepBrowserOpen: elements.keepBrowserOpen.checked,
      dataDrivenMode: elements.dataDrivenMode.checked,
      initialSteps: initialSteps,
      perUploadSteps: perUploadSteps,
      postUploadSteps: postUploadSteps,
      folderPath: selectedFolder
    };
    localStorage.setItem('uiTesterConfig', JSON.stringify(config));
  }

  function loadConfig() {
    const saved = localStorage.getItem('uiTesterConfig');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        applyConfig(config);
      } catch (e) {
        console.error('Error loading config:', e);
      }
    }
  }

  // Apply config to the UI
  function applyConfig(config) {
    elements.targetUrl.value = config.targetUrl || '';
    elements.uploadSelector.value = config.uploadSelector || "input[type='file']";
    elements.submitSelector.value = config.submitSelector || '';
    elements.waitAfterUpload.value = config.waitAfterUpload || '2000';
    elements.waitAfterSubmit.value = config.waitAfterSubmit || '3000';
    elements.headless.checked = config.headless || false;
    elements.loopMode.value = config.loopMode || 'all';
    elements.keepBrowserOpen.checked = config.keepBrowserOpen || false;
    elements.dataDrivenMode.checked = config.dataDrivenMode || false;
    initialSteps = config.initialSteps || [];
    perUploadSteps = config.perUploadSteps || [];
    postUploadSteps = config.postUploadSteps || [];
    renderSteps('initial');
    renderSteps('perUpload');
    renderSteps('postUpload');
    
    // If a folder path is saved, try to load it
    if (config.folderPath) {
      selectedFolder = config.folderPath;
      elements.folderPath.textContent = selectedFolder;
      // Rescan the folder
      window.electronAPI.scanFolder(selectedFolder).then(scanResult => {
        if (scanResult.success) {
          documents = scanResult.documents;
          renderDocuments();
          elements.documentsContainer.classList.remove('hidden');
          updateStartButton();
        }
      });
    }
    
    updateStartButton();
  }

  // Filter out secret values from steps for saving to file
  function filterSecretValues(steps) {
    return steps.map(step => {
      if (step.isSecret) {
        // Create a copy without the value
        const { value, ...stepWithoutValue } = step;
        return stepWithoutValue;
      }
      return step;
    });
  }

  // Get current config object (with secrets filtered out for file saving)
  function getCurrentConfig(filterSecrets = true) {
    const config = {
      targetUrl: elements.targetUrl.value,
      uploadSelector: elements.uploadSelector.value,
      submitSelector: elements.submitSelector.value,
      waitAfterUpload: elements.waitAfterUpload.value,
      waitAfterSubmit: elements.waitAfterSubmit.value,
      headless: elements.headless.checked,
      loopMode: elements.loopMode.value,
      keepBrowserOpen: elements.keepBrowserOpen.checked,
      dataDrivenMode: elements.dataDrivenMode.checked,
      initialSteps: filterSecrets ? filterSecretValues(initialSteps) : initialSteps,
      perUploadSteps: filterSecrets ? filterSecretValues(perUploadSteps) : perUploadSteps,
      postUploadSteps: filterSecrets ? filterSecretValues(postUploadSteps) : postUploadSteps,
      folderPath: selectedFolder
    };
    return config;
  }

  // Clear All Configuration and Steps
  function handleClearAll() {
    if (!confirm('Are you sure you want to clear all configuration and steps? This cannot be undone.')) {
      return;
    }
    
    // Reset State
    selectedFolder = null;
    documents = [];
    initialSteps = [];
    perUploadSteps = [];
    postUploadSteps = [];
    currentConfigFile = null;
    
    // Reset UI Elements
    elements.targetUrl.value = '';
    elements.uploadSelector.value = "input[type='file']";
    elements.submitSelector.value = '';
    elements.waitAfterUpload.value = '2000';
    elements.waitAfterSubmit.value = '3000';
    elements.headless.checked = false;
    elements.loopMode.value = 'all';
    elements.keepBrowserOpen.checked = false;
    elements.dataDrivenMode.checked = false;
    
    elements.folderPath.textContent = 'No folder selected';
    elements.documentsContainer.classList.add('hidden');
    elements.documentsList.innerHTML = '';
    elements.docCount.textContent = '0';
    
    renderSteps('initial');
    renderSteps('perUpload');
    renderSteps('postUpload');
    
    updateConfigFileDisplay(null);
    updateStartButton();
    
    // Clear Locator Assistant
    elements.htmlInput.value = '';
    elements.locatorResults.classList.add('hidden');
    elements.locatorsList.innerHTML = '';
    
    // Clear localStorage
    localStorage.removeItem('uiTesterConfig');
    
    addLog('All configuration and steps cleared', 'info');
  }

  // Update the displayed config file name
  function updateConfigFileDisplay(filePath) {
    currentConfigFile = filePath;
    if (filePath && elements.currentConfigName) {
      // Extract just the filename from the full path
      const fileName = filePath.split(/[/\\]/).pop();
      elements.currentConfigName.textContent = `📄 ${fileName}`;
      elements.currentConfigName.title = filePath; // Show full path on hover
    } else if (elements.currentConfigName) {
      elements.currentConfigName.textContent = '';
    }
  }

  // Save config to file
  async function handleSaveConfig() {
    const config = getCurrentConfig();
    const result = await window.electronAPI.saveConfig(config);
    
    if (result.success) {
      updateConfigFileDisplay(result.filePath);
      addLog(`Configuration saved to: ${result.filePath}`, 'success');
    } else if (!result.canceled) {
      addLog(`Failed to save configuration: ${result.error}`, 'error');
    }
  }

  // Import steps for a specific section
  async function handleImportSteps(stepType) {
    const result = await window.electronAPI.loadConfig();
    
    if (result.success) {
      const config = result.config;
      let importedSteps = [];
      
      // Determine which steps to import from the loaded config
      // It looks for steps in the same section type first, then falls back to any steps it finds
      if (stepType === 'initial') {
        importedSteps = config.initialSteps || config.perUploadSteps || config.postUploadSteps || [];
      } else if (stepType === 'perUpload') {
        importedSteps = config.perUploadSteps || config.initialSteps || config.postUploadSteps || [];
      } else if (stepType === 'postUpload') {
        importedSteps = config.postUploadSteps || config.perUploadSteps || config.initialSteps || [];
      }

      if (importedSteps.length === 0) {
        addLog(`No steps found in the selected file to import into ${stepType} section`, 'warning');
        return;
      }

      const shouldAppend = confirm(`Found ${importedSteps.length} steps. \n\nClick OK to APPEND these steps to your current list. \nClick CANCEL to REPLACE your current list with these steps.`);
      
      if (shouldAppend) {
        if (stepType === 'initial') initialSteps = [...initialSteps, ...importedSteps];
        else if (stepType === 'perUpload') perUploadSteps = [...perUploadSteps, ...importedSteps];
        else if (stepType === 'postUpload') postUploadSteps = [...postUploadSteps, ...importedSteps];
      } else {
        if (stepType === 'initial') initialSteps = importedSteps;
        else if (stepType === 'perUpload') perUploadSteps = importedSteps;
        else if (stepType === 'postUpload') postUploadSteps = importedSteps;
      }

      renderSteps(stepType);
      addLog(`Successfully imported ${importedSteps.length} steps into ${stepType} section`, 'success');
    }
  }

  // Load config from file
  async function handleLoadConfig() {
    const result = await window.electronAPI.loadConfig();
    
    if (result.success) {
      applyConfig(result.config);
      updateConfigFileDisplay(result.filePath);
      addLog(`Configuration loaded from: ${result.filePath}`, 'success');
    } else if (!result.canceled) {
      addLog(`Failed to load configuration: ${result.error}`, 'error');
    }
  }

  // Add input listener for URL
  elements.targetUrl.addEventListener('input', updateStartButton);

  // Initialize
  init();
});
