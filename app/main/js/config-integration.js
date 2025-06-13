// js/config-integration.js
// Vereinfachte Config-Integration für unified interface

// Global config state
window.configState = {
    selectedPDF: null,
    currentConfig: null,
    selectedGroup: null,
    selectedField: null
};

// Initialize config when tab is activated
function initializeConfigTab() {
    console.log('🔧 Initializing config tab...');
    
    // Populate PDF selector
    const selector = document.getElementById('configPdfSelector');
    if (!selector) return;
    
    // Clear existing options
    selector.innerHTML = '<option value="">-- PDF auswählen --</option>';
    
    // Add available PDFs
    if (window.availablePDFs && window.availablePDFs.length > 0) {
        window.availablePDFs.forEach(pdf => {
            const option = document.createElement('option');
            option.value = pdf.name;
            option.textContent = pdf.name;
            selector.appendChild(option);
        });
    }
    
    // Check direct save capability
    checkDirectSaveCapability();
    
    // Setup auto-save listeners
    setupAutoSaveListeners();
}

// Load config for selected PDF
async function loadConfigForPDF() {
    const selector = document.getElementById('configPdfSelector');
    const selectedPDF = selector.value;
    
    if (!selectedPDF) {
        hideConfigWorkspace();
        return;
    }
    
    window.configState.selectedPDF = selectedPDF;
    
    try {
        console.log(`📄 Loading config for: ${selectedPDF}`);
        
        // Find PDF info
        const pdfInfo = window.availablePDFs.find(pdf => pdf.name === selectedPDF);
        if (!pdfInfo) {
            throw new Error('PDF nicht gefunden');
        }
        
        // Try to load existing YAML config
        const yamlPath = `formulare/${selectedPDF.replace('.pdf', '.yaml')}`;
        let config;
        
        try {
            const response = await fetch(yamlPath);
            if (response.ok) {
                const yamlText = await response.text();
                config = jsyaml.load(yamlText);
                console.log('✓ Existing config loaded');
            } else {
                throw new Error('No existing config');
            }
        } catch (error) {
            // Create new config
            config = createNewConfig(pdfInfo);
            console.log('📝 New config created');
        }
        
        window.configState.currentConfig = config;
        loadConfigIntoUI(config, pdfInfo);
        showConfigWorkspace();
        
        showStatus(`Konfiguration für ${selectedPDF} geladen`);
        
    } catch (error) {
        console.error('Fehler beim Laden der Konfiguration:', error);
        showStatus('Fehler beim Laden der Konfiguration: ' + error.message, 'error');
    }
}

// Create new config from PDF fields
function createNewConfig(pdfInfo) {
    const config = {
        groups: {
            'Allgemein': {
                title: '📝 Allgemeine Felder',
                description: 'Standard-Felder des PDF-Formulars'
            }
        },
        fields: {}
    };
    
    // Add all PDF fields to general group
    pdfInfo.fields.forEach(fieldName => {
        config.fields[fieldName] = {
            group: 'Allgemein'
        };
    });
    
    return config;
}

// Load config into UI
function loadConfigIntoUI(config, pdfInfo) {
    loadGroupsIntoUI(config.groups || {});
    loadFieldsIntoUI(config.fields || {}, pdfInfo.fields);
}

// Load groups into UI
function loadGroupsIntoUI(groups) {
    const container = document.getElementById('configGroupsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(groups).forEach(([groupKey, groupData]) => {
        const groupItem = document.createElement('div');
        groupItem.className = 'config-item';
        groupItem.textContent = `${groupData.title || groupKey}`;
        groupItem.onclick = () => selectConfigGroup(groupKey);
        container.appendChild(groupItem);
    });
}

// Load fields into UI
function loadFieldsIntoUI(fields, pdfFields) {
    const container = document.getElementById('configFieldsList');
    const unassignedContainer = document.getElementById('configUnassignedFieldsList');
    if (!container || !unassignedContainer) return;
    
    container.innerHTML = '';
    unassignedContainer.innerHTML = '';
    
    const assignedFields = new Set();
    
    // Show fields for selected group
    if (window.configState.selectedGroup) {
        Object.entries(fields).forEach(([fieldName, fieldData]) => {
            if (fieldData.group === window.configState.selectedGroup) {
                const fieldItem = document.createElement('div');
                fieldItem.className = 'config-item';
                fieldItem.textContent = fieldData.title || fieldName;
                fieldItem.onclick = () => selectConfigField(fieldName);
                container.appendChild(fieldItem);
                assignedFields.add(fieldName);
            }
        });
    }
    
    // Show unassigned fields
    const unassignedFields = pdfFields.filter(field => !assignedFields.has(field));
    if (unassignedFields.length > 0) {
        document.getElementById('configUnassignedFields').style.display = 'block';
        unassignedFields.forEach(fieldName => {
            const fieldItem = document.createElement('div');
            fieldItem.className = 'config-item';
            fieldItem.textContent = fieldName;
            fieldItem.onclick = () => selectConfigField(fieldName);
            unassignedContainer.appendChild(fieldItem);
        });
    } else {
        document.getElementById('configUnassignedFields').style.display = 'none';
    }
}

// Select group
function selectConfigGroup(groupKey) {
    window.configState.selectedGroup = groupKey;
    window.configState.selectedField = null;
    
    // Update UI
    document.querySelectorAll('#configGroupsList .config-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.getElementById('configSelectedGroupName').textContent = `(${window.configState.currentConfig.groups[groupKey].title})`;
    
    // Reload fields for this group
    const pdfInfo = window.availablePDFs.find(pdf => pdf.name === window.configState.selectedPDF);
    loadFieldsIntoUI(window.configState.currentConfig.fields, pdfInfo.fields);
    
    // Show group properties
    showGroupProperties(groupKey);
}

// Select field
function selectConfigField(fieldName) {
    window.configState.selectedField = fieldName;
    
    // Update UI
    document.querySelectorAll('#configFieldsList .config-item, #configUnassignedFieldsList .config-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show field properties
    showFieldProperties(fieldName);
}

// Show group properties
function showGroupProperties(groupKey) {
    const groupData = window.configState.currentConfig.groups[groupKey];
    
    document.getElementById('configGroupTitle').value = groupData.title || '';
    document.getElementById('configGroupDescription').value = groupData.description || '';
    
    // Show group properties panel
    document.getElementById('configGroupProperties').style.display = 'block';
    document.getElementById('configFieldProperties').style.display = 'none';
}

// Show field properties
function showFieldProperties(fieldName) {
    const fieldData = window.configState.currentConfig.fields[fieldName] || {};
    
    document.getElementById('configFieldTitle').value = fieldData.title || '';
    document.getElementById('configFieldDescription').value = fieldData.description || '';
    document.getElementById('configFieldType').value = fieldData.type || 'text';
    document.getElementById('configFieldMapping').value = fieldData.mapping || '';
    document.getElementById('configFieldCalculation').value = fieldData.calculation || '';
    document.getElementById('configFieldHidden').checked = fieldData.hidden || false;
    
    // Add event listener for field type changes
    const fieldTypeSelect = document.getElementById('configFieldType');
    fieldTypeSelect.onchange = function() {
        if (this.value === 'signature') {
            document.getElementById('configSignatureSettings').style.display = 'block';
        } else {
            document.getElementById('configSignatureSettings').style.display = 'none';
        }
    };
    
    // Handle signature fields
    if (fieldData.type === 'signature') {
        document.getElementById('configSignatureSettings').style.display = 'block';
        document.getElementById('configSignatureWidth').value = fieldData.signature_width || '';
        document.getElementById('configSignatureHeight').value = fieldData.signature_height || '';
        document.getElementById('configSignatureX').value = fieldData.signature_x || '';
        document.getElementById('configSignatureY').value = fieldData.signature_y || '';
        document.getElementById('configSignaturePage').value = fieldData.signature_page || '';
    } else {
        document.getElementById('configSignatureSettings').style.display = 'none';
    }
    
    // Show field properties panel
    document.getElementById('configFieldProperties').style.display = 'block';
    document.getElementById('configGroupProperties').style.display = 'none';
}

// Add new group
function addNewConfigGroup() {
    const groupName = prompt('Name der neuen Gruppe:');
    if (!groupName) return;
    
    const groupKey = groupName.replace(/\s+/g, '_');
    window.configState.currentConfig.groups[groupKey] = {
        title: groupName,
        description: ''
    };
    
    loadGroupsIntoUI(window.configState.currentConfig.groups);
}

// Delete group
function deleteConfigGroup() {
    if (!window.configState.selectedGroup) return;
    
    if (confirm('Gruppe wirklich löschen?')) {
        delete window.configState.currentConfig.groups[window.configState.selectedGroup];
        window.configState.selectedGroup = null;
        loadGroupsIntoUI(window.configState.currentConfig.groups);
        document.getElementById('configGroupProperties').style.display = 'none';
    }
}

// Save and download config
function saveAndDownloadConfig() {
    if (!window.configState.selectedPDF) {
        showStatus('Bitte wählen Sie zuerst ein PDF aus', 'error');
        return;
    }
    
    try {
        updateConfigFromUI();
        const yamlString = jsyaml.dump(window.configState.currentConfig, { indent: 2 });
        const filename = window.configState.selectedPDF.replace('.pdf', '.yaml');
        
        // Download
        const blob = new Blob([yamlString], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus(`Konfiguration ${filename} erfolgreich heruntergeladen`);
        
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showStatus('Fehler beim Speichern: ' + error.message, 'error');
    }
}

// Direct save config
async function saveConfigDirect() {
    if (!window.configState.selectedPDF) {
        showStatus('Bitte wählen Sie zuerst ein PDF aus', 'error');
        return;
    }
    
    try {
        updateConfigFromUI();
        const yamlString = jsyaml.dump(window.configState.currentConfig, { indent: 2 });
        const filename = window.configState.selectedPDF.replace('.pdf', '.yaml');
        
        const response = await fetch(`/app/backend/save-config.php?filename=${encodeURIComponent(filename)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-yaml'
            },
            body: yamlString
        });
        
        if (response.ok) {
            showStatus(`✅ Konfiguration ${filename} erfolgreich gespeichert`);
            // Refresh PDFs
            if (typeof window.loadPDFsFromDirectory === 'function') {
                await window.loadPDFsFromDirectory();
            }
        } else {
            const errorText = await response.text();
            throw new Error(`Server-Antwort: ${response.status} ${response.statusText}\n${errorText}`);
        }
        
    } catch (error) {
        console.error('Fehler beim direkten Speichern:', error);
        showStatus('⚠️ Direktes Speichern nicht möglich: ' + error.message, 'error');
    }
}

// Update config from UI
function updateConfigFromUI() {
    // Update current group if selected
    if (window.configState.selectedGroup) {
        const groupData = window.configState.currentConfig.groups[window.configState.selectedGroup];
        groupData.title = document.getElementById('configGroupTitle').value;
        groupData.description = document.getElementById('configGroupDescription').value;
    }
    
    // Update current field if selected
    if (window.configState.selectedField) {
        const fieldData = window.configState.currentConfig.fields[window.configState.selectedField] || {};
        
        fieldData.title = document.getElementById('configFieldTitle').value;
        fieldData.description = document.getElementById('configFieldDescription').value;
        fieldData.type = document.getElementById('configFieldType').value;
        fieldData.mapping = document.getElementById('configFieldMapping').value;
        fieldData.calculation = document.getElementById('configFieldCalculation').value;
        fieldData.hidden = document.getElementById('configFieldHidden').checked;
        
        if (fieldData.type === 'signature') {
            fieldData.signature_width = parseInt(document.getElementById('configSignatureWidth').value) || undefined;
            fieldData.signature_height = parseInt(document.getElementById('configSignatureHeight').value) || undefined;
            fieldData.signature_x = parseInt(document.getElementById('configSignatureX').value) || undefined;
            fieldData.signature_y = parseInt(document.getElementById('configSignatureY').value) || undefined;
            fieldData.signature_page = parseInt(document.getElementById('configSignaturePage').value) || undefined;
        }
        
        window.configState.currentConfig.fields[window.configState.selectedField] = fieldData;
    }
}

// Setup auto-save event listeners for form fields
function setupAutoSaveListeners() {
    const inputs = [
        'configGroupTitle', 'configGroupDescription',
        'configFieldTitle', 'configFieldDescription', 'configFieldType', 
        'configFieldMapping', 'configFieldCalculation', 'configFieldHidden',
        'configSignatureWidth', 'configSignatureHeight', 'configSignatureX', 
        'configSignatureY', 'configSignaturePage'
    ];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateConfigFromUI);
            element.addEventListener('change', updateConfigFromUI);
        }
    });
}

// Preview config
function previewConfig() {
    if (!window.configState.selectedPDF) {
        showStatus('Bitte wählen Sie zuerst ein PDF aus', 'error');
        return;
    }
    
    try {
        updateConfigFromUI();
        const yamlString = jsyaml.dump(window.configState.currentConfig, { indent: 2 });
        
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(`
            <html>
                <head>
                    <title>Konfiguration Vorschau - ${window.configState.selectedPDF}</title>
                    <style>
                        body { font-family: monospace; margin: 20px; background: #f5f5f5; }
                        pre { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        h1 { color: #333; }
                    </style>
                </head>
                <body>
                    <h1>Konfiguration: ${window.configState.selectedPDF}</h1>
                    <pre>${yamlString}</pre>
                </body>
            </html>
        `);
        previewWindow.document.close();
        
    } catch (error) {
        showStatus('Fehler bei der Vorschau: ' + error.message, 'error');
    }
}

// Show/hide workspace
function showConfigWorkspace() {
    document.getElementById('configWorkspace').style.display = 'block';
    document.getElementById('configActions').style.display = 'block';
}

function hideConfigWorkspace() {
    document.getElementById('configWorkspace').style.display = 'none';
    document.getElementById('configActions').style.display = 'none';
}

// Check direct save capability
function checkDirectSaveCapability() {
    fetch('/app/config.yaml')
        .then(response => response.text())
        .then(data => {
            const config = jsyaml.load(data);
            if (config && config.allowConfigWrite === true) {
                document.getElementById('configSaveDirectBtn').style.display = 'inline-flex';
            }
        })
        .catch(error => {
            console.log('Direct save not available:', error);
        });
}

// Extend switchTab function to initialize config
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    if (originalSwitchTab) {
        originalSwitchTab(tabName);
    }
    
    if (tabName === 'configuration') {
        setTimeout(initializeConfigTab, 100);
    }
};

console.log('✅ Config integration loaded');