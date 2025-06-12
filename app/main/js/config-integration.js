// js/config-integration.js
// Integration layer for config editor functionality in main interface

// Global variables for config integration
window.configIntegration = {
    initialized: false,
    selectedPDFForConfig: null
};

// Initialize config integration when configuration tab is first accessed
function initializeConfigIntegration() {
    if (window.configIntegration.initialized) {
        return;
    }
    
    console.log('🔧 Initializing config integration...');
    
    // Populate PDF selector with available PDFs
    populateConfigPDFSelector();
    
    // Check if we have direct save capability
    checkDirectSaveCapability();
    
    window.configIntegration.initialized = true;
    console.log('✓ Config integration initialized');
}

// Populate the config PDF selector with available PDFs
function populateConfigPDFSelector() {
    const selector = document.getElementById('configPdfSelector');
    if (!selector) return;
    
    // Clear existing options except the first one
    while (selector.children.length > 1) {
        selector.removeChild(selector.lastChild);
    }
    
    // Add available PDFs
    if (window.availablePDFs && window.availablePDFs.length > 0) {
        window.availablePDFs.forEach(pdf => {
            const option = document.createElement('option');
            option.value = pdf.name;
            option.textContent = pdf.name;
            selector.appendChild(option);
        });
    }
}

// Check if direct save is available
function checkDirectSaveCapability() {
    fetch('/app/config.yaml')
        .then(response => response.text())
        .then(data => {
            const config = jsyaml.load(data);
            const saveDirectBtn = document.getElementById('saveDirectBtn');
            if (config && config.allowConfigWrite === true && saveDirectBtn) {
                saveDirectBtn.style.display = 'inline-flex';
            }
        })
        .catch(error => {
            console.log('Direct save not available:', error);
        });
}

// Load PDF config when PDF is selected in config tab
async function loadPDFConfig() {
    const selector = document.getElementById('configPdfSelector');
    const selectedPDF = selector.value;
    
    if (!selectedPDF) {
        hideConfigEditor();
        return;
    }
    
    window.configIntegration.selectedPDFForConfig = selectedPDF;
    
    try {
        console.log(`📄 Loading config for: ${selectedPDF}`);
        
        // Find the PDF info
        const pdfInfo = window.availablePDFs.find(pdf => pdf.name === selectedPDF);
        if (!pdfInfo) {
            throw new Error('PDF nicht gefunden');
        }
        
        // Update the global currentPDF for config editor
        window.currentPDF = pdfInfo;
        
        // Load or create config
        await loadConfigForPDF(selectedPDF);
        
        // Show the config editor
        showConfigEditor();
        
        // Show the button group
        const buttonGroup = document.getElementById('configButtonGroup');
        if (buttonGroup) {
            buttonGroup.style.display = 'flex';
        }
        
    } catch (error) {
        console.error('Fehler beim Laden der PDF-Konfiguration:', error);
        showStatus('Fehler beim Laden der PDF-Konfiguration: ' + error.message, 'error');
    }
}

// Show config editor
function showConfigEditor() {
    const editor = document.getElementById('configEditor');
    if (editor) {
        editor.style.display = 'block';
    }
}

// Hide config editor
function hideConfigEditor() {
    const editor = document.getElementById('configEditor');
    if (editor) {
        editor.style.display = 'none';
    }
    
    const buttonGroup = document.getElementById('configButtonGroup');
    if (buttonGroup) {
        buttonGroup.style.display = 'none';
    }
}

// Load or create config for a specific PDF
async function loadConfigForPDF(pdfName) {
    try {
        // Try to load existing YAML config
        const yamlPath = `formulare/${pdfName.replace('.pdf', '.yaml')}`;
        const response = await fetch(yamlPath);
        
        if (response.ok) {
            const yamlText = await response.text();
            const config = jsyaml.load(yamlText);
            
            // Load the config into the editor
            window.currentConfig = config;
            await loadConfigIntoEditor(config);
            
            console.log(`✓ Loaded existing config for ${pdfName}`);
            showStatus(`Konfiguration für ${pdfName} geladen`);
        } else {
            // Create new config from PDF fields
            console.log(`📝 Creating new config for ${pdfName}`);
            await createNewConfigFromPDF();
            showStatus(`Neue Konfiguration für ${pdfName} erstellt`);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Konfiguration:', error);
        // Create new config as fallback
        await createNewConfigFromPDF();
        showStatus(`Neue Konfiguration für ${pdfName} erstellt (Fallback)`);
    }
}

// Create new config from PDF fields
async function createNewConfigFromPDF() {
    if (!window.currentPDF) return;
    
    const newConfig = {
        groups: {
            'Allgemein': {
                title: '📝 Allgemeine Felder',
                description: 'Standard-Felder des PDF-Formulars'
            }
        },
        fields: {}
    };
    
    // Add all PDF fields to the general group
    window.currentPDF.fields.forEach(fieldName => {
        newConfig.fields[fieldName] = {
            group: 'Allgemein'
        };
    });
    
    window.currentConfig = newConfig;
    await loadConfigIntoEditor(newConfig);
}

// Load config into the editor UI (reuse from config-core.js)
async function loadConfigIntoEditor(config) {
    if (typeof window.loadGroupsIntoUI === 'function') {
        window.loadGroupsIntoUI(config.groups || {});
    }
    
    if (typeof window.loadFieldsIntoUI === 'function') {
        window.loadFieldsIntoUI(config.fields || {});
    }
}

// Save and download config (integrated version)
function saveAndDownloadConfig() {
    if (!window.configIntegration.selectedPDFForConfig) {
        showStatus('Bitte wählen Sie zuerst ein PDF aus', 'error');
        return;
    }
    
    try {
        const config = generateConfigFromEditor();
        const yamlString = jsyaml.dump(config, { indent: 2 });
        
        // Create filename
        const filename = window.configIntegration.selectedPDFForConfig.replace('.pdf', '.yaml');
        
        // Download the file
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
        console.error('Fehler beim Speichern der Konfiguration:', error);
        showStatus('Fehler beim Speichern der Konfiguration: ' + error.message, 'error');
    }
}

// Direct save config (integrated version)
async function saveConfigDirect() {
    if (!window.configIntegration.selectedPDFForConfig) {
        showStatus('Bitte wählen Sie zuerst ein PDF aus', 'error');
        return;
    }
    
    try {
        const config = generateConfigFromEditor();
        const yamlString = jsyaml.dump(config, { indent: 2 });
        const filename = window.configIntegration.selectedPDFForConfig.replace('.pdf', '.yaml');
        
        const response = await fetch(`/app/backend/save-config.php?filename=${encodeURIComponent(filename)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-yaml'
            },
            body: yamlString
        });
        
        if (response.ok) {
            showStatus(`✅ Konfiguration ${filename} erfolgreich gespeichert`);
            
            // Refresh PDF configs to include the new/updated one
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

// Generate config from current editor state
function generateConfigFromEditor() {
    const config = {
        groups: {},
        fields: {}
    };
    
    // Collect groups
    if (typeof window.collectGroupsFromUI === 'function') {
        config.groups = window.collectGroupsFromUI();
    }
    
    // Collect fields
    if (typeof window.collectFieldsFromUI === 'function') {
        config.fields = window.collectFieldsFromUI();
    }
    
    return config;
}

// Preview config
function previewConfig() {
    try {
        const config = generateConfigFromEditor();
        const yamlString = jsyaml.dump(config, { indent: 2 });
        
        // Open preview in new window
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(`
            <html>
                <head>
                    <title>Konfiguration Vorschau - ${window.configIntegration.selectedPDFForConfig}</title>
                    <style>
                        body { font-family: monospace; margin: 20px; background: #f5f5f5; }
                        pre { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        h1 { color: #333; }
                    </style>
                </head>
                <body>
                    <h1>Konfiguration: ${window.configIntegration.selectedPDFForConfig}</h1>
                    <pre>${yamlString}</pre>
                </body>
            </html>
        `);
        previewWindow.document.close();
        
    } catch (error) {
        showStatus('Fehler bei der Vorschau: ' + error.message, 'error');
    }
}

// Open signature position tool
function openSignaturePositionTool() {
    window.open('../config/signature-position.html', '_blank');
}

// Extend the switchTab function to initialize config when needed
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    // Call original function
    if (originalSwitchTab) {
        originalSwitchTab(tabName);
    }
    
    // Initialize config integration if switching to configuration tab
    if (tabName === 'configuration') {
        initializeConfigIntegration();
    }
};