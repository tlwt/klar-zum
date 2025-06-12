// js/ui-manager.js
// UI-Management für Email-Client-Layout

// Email-Client Navigation System
function showView(viewName) {
    console.log(`🔄 Switching to view: ${viewName}`);
    
    // Remove active from all menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active to selected menu item
    const menuItem = document.querySelector(`[data-view="${viewName}"]`);
    if (menuItem) {
        menuItem.classList.add('active');
    }
    
    // Hide all content views
    document.querySelectorAll('.content-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Initialize view-specific functionality
    initializeView(viewName);
}

// Initialize view-specific functionality
function initializeView(viewName) {
    switch (viewName) {
        case 'configuration':
            if (typeof initializeConfigTab === 'function') {
                setTimeout(initializeConfigTab, 100);
            }
            break;
        case 'form-fields':
            // Update live preview if active
            if (window.livePreview && window.livePreview.isActive) {
                setTimeout(() => {
                    if (typeof updateLivePreview === 'function') {
                        updateLivePreview();
                    }
                }, 100);
            }
            break;
    }
}

// Legacy function compatibility
function switchTab(tabName) {
    // Map old tab names to new view names
    const viewMap = {
        'pdf-selection': 'pdf-selection',
        'form-fields': 'form-fields',
        'configuration': 'configuration',
        'settings': 'settings'
    };
    
    const viewName = viewMap[tabName] || tabName;
    showView(viewName);
}

// Go to form fields view (called from PDF selection)
function goToFormFields() {
    console.log('=== goToFormFields() aufgerufen ===');
    console.log('Ausgewählte PDFs:', Array.from(window.selectedPDFs));
    console.log('window.selectedPDFs.size:', window.selectedPDFs.size);
    
    if (window.selectedPDFs.size === 0) {
        console.error('FEHLER: Keine PDFs ausgewählt beim Wechsel zu Formularfeldern');
        showStatus('Bitte wählen Sie zuerst ein PDF aus!', 'error');
        return;
    }
    
    // Enable the form fields menu item
    const formFieldsMenuItem = document.getElementById('formFieldsMenuItem');
    if (formFieldsMenuItem) {
        formFieldsMenuItem.classList.remove('disabled');
    }
    
    console.log('Rufe generateFormForSelectedPDFs() auf...');
    generateFormForSelectedPDFs();
    console.log('generateFormForSelectedPDFs() beendet');
    
    console.log('Wechsle zu form-fields view...');
    showView('form-fields');
    console.log('View-Wechsel abgeschlossen');
}

function generatePDFSelection() {
    const container = document.getElementById('pdfSelection');
    container.innerHTML = '';
    
    window.availablePDFs.forEach((pdf, index) => {
        const fieldsPreview = generateFieldsPreview(pdf.fields);
        const configStatus = pdf.hasConfig ? 
            '<div class="config-status config-found">✅ Konfiguration gefunden</div>' :
            '<div class="config-status config-missing">⚠️ Keine Konfiguration</div>';
        
        const div = document.createElement('div');
        div.className = 'pdf-checkbox';
        div.innerHTML = `
            <input type="checkbox" id="pdf_${index}" value="${pdf.name}" onchange="onPDFSelectionChange()">
            <div class="pdf-info">
                <h4>${pdf.name}</h4>
                <div class="pdf-path">${pdf.path}</div>
                ${configStatus}
                <div class="fields-preview">
                    <div class="fields-short">Felder (${pdf.fields.length}): ${fieldsPreview.short}</div>
                    <div class="fields-full">Felder (${pdf.fields.length}): ${fieldsPreview.full}</div>
                    ${pdf.fields.length > 3 ? `<div class="fields-toggle" onclick="toggleFields(this)">Alle anzeigen</div>` : ''}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function generateFieldsPreview(fields) {
    const short = fields.slice(0, 3).join(', ') + (fields.length > 3 ? '...' : '');
    const full = fields.join(', ');
    return { short, full };
}

function toggleFields(element) {
    const parent = element.closest('.fields-preview');
    const shortDiv = parent.querySelector('.fields-short');
    const fullDiv = parent.querySelector('.fields-full');
    
    if (shortDiv.style.display === 'none') {
        shortDiv.style.display = 'block';
        fullDiv.style.display = 'none';
        element.textContent = 'Alle anzeigen';
    } else {
        shortDiv.style.display = 'none';
        fullDiv.style.display = 'block';
        element.textContent = 'Weniger anzeigen';
    }
}

function onPDFSelectionChange() {
    console.log('=== onPDFSelectionChange() aufgerufen ===');
    
    window.selectedPDFs.clear();
    const checkedBoxes = document.querySelectorAll('input[type="checkbox"]:checked');
    console.log('Gefundene aktivierte Checkboxen:', checkedBoxes.length);
    
    checkedBoxes.forEach(checkbox => {
        console.log('Aktivierte Checkbox:', checkbox.value);
        window.selectedPDFs.add(checkbox.value);
        checkbox.closest('.pdf-checkbox').classList.add('selected');
    });
    
    document.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach(checkbox => {
        checkbox.closest('.pdf-checkbox').classList.remove('selected');
    });
    
    console.log('Neue Auswahl - selectedPDFs:', Array.from(window.selectedPDFs));
    console.log('selectedPDFs.size:', window.selectedPDFs.size);
    
    updateSelectionSummary();
    updateNextButton();
    
    console.log('onPDFSelectionChange() beendet');
}

function updateSelectionSummary() {
    const summaryDiv = document.getElementById('selectionSummary');
    const listDiv = document.getElementById('selectedPDFsList');
    
    if (window.selectedPDFs.size === 0) {
        summaryDiv.style.display = 'none';
    } else {
        const pdfList = Array.from(window.selectedPDFs).map(pdfName => `<li>${pdfName}</li>`).join('');
        listDiv.innerHTML = `<ul>${pdfList}</ul>`;
        summaryDiv.style.display = 'block';
    }
}

function updateNextButton() {
    const nextButton = document.getElementById('nextButton');
    const formFieldsMenuItem = document.getElementById('formFieldsMenuItem');
    
    if (window.selectedPDFs.size > 0) {
        nextButton.disabled = false;
        if (formFieldsMenuItem) {
            formFieldsMenuItem.classList.remove('disabled');
        }
    } else {
        nextButton.disabled = true;
        if (formFieldsMenuItem) {
            formFieldsMenuItem.classList.add('disabled');
        }
    }
}

// Show status message in status bar
function showStatus(message, type = 'info') {
    const statusBar = document.getElementById('status');
    if (!statusBar) return;
    
    // Clear existing content
    statusBar.textContent = '';
    statusBar.className = 'status-bar';
    
    // Add type-specific styling
    if (type === 'error') {
        statusBar.style.background = '#e74c3c';
    } else if (type === 'success') {
        statusBar.style.background = '#27ae60';
    } else if (type === 'warning') {
        statusBar.style.background = '#f39c12';
    } else {
        statusBar.style.background = '#34495e';
    }
    
    // Set message
    statusBar.textContent = message;
    
    // Auto-hide after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            statusBar.textContent = '';
            statusBar.style.background = '#34495e';
        }, 5000);
    }
}

// Show error screen
function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'flex';
}

// Hide loading and show main app
function showMainApp() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    
    // Initialize default view
    showView('pdf-selection');
}

// Toggle hidden data section
function toggleHiddenData() {
    const content = document.getElementById('hiddenDataContent');
    const toggleText = document.getElementById('hiddenDataToggleText');
    
    if (content && toggleText) {
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            toggleText.textContent = 'Verstecken';
        } else {
            content.style.display = 'none';
            toggleText.textContent = 'Anzeigen';
        }
    }
}

// Handle PDF field type changes in config
function handleFieldTypeChange() {
    const typeSelect = document.getElementById('configFieldType');
    const signatureSettings = document.getElementById('configSignatureSettings');
    
    if (typeSelect && signatureSettings) {
        if (typeSelect.value === 'signature') {
            signatureSettings.style.display = 'block';
        } else {
            signatureSettings.style.display = 'none';
        }
    }
}

// Save settings
function saveSettings() {
    const settings = {
        fileNamePattern: document.getElementById('fileNamePattern')?.value || '',
        emailAddress: document.getElementById('emailAddress')?.value || '',
        emailSubject: document.getElementById('emailSubject')?.value || '',
        emailBody: document.getElementById('emailBody')?.value || ''
    };
    
    try {
        localStorage.setItem('pdf-form-settings', JSON.stringify(settings));
        showStatus('✅ Einstellungen erfolgreich gespeichert', 'success');
        
        // Update global settings
        window.appSettings = settings;
    } catch (error) {
        console.error('Fehler beim Speichern der Einstellungen:', error);
        showStatus('❌ Fehler beim Speichern der Einstellungen', 'error');
    }
}

// Reset settings
function resetSettings() {
    if (confirm('Möchten Sie wirklich alle Einstellungen zurücksetzen?')) {
        const defaultSettings = {
            fileNamePattern: '[Nachname], [Vorname] - [PDF] - [Datum]',
            emailAddress: '',
            emailSubject: 'Formularunterlagen - [Nachname], [Vorname]',
            emailBody: 'Sehr geehrte Damen und Herren,\n\nanbei übersende ich Ihnen die ausgefüllten Formularunterlagen.\n\nMit freundlichen Grüßen'
        };
        
        document.getElementById('fileNamePattern').value = defaultSettings.fileNamePattern;
        document.getElementById('emailAddress').value = defaultSettings.emailAddress;
        document.getElementById('emailSubject').value = defaultSettings.emailSubject;
        document.getElementById('emailBody').value = defaultSettings.emailBody;
        
        window.appSettings = defaultSettings;
        
        showStatus('✅ Einstellungen zurückgesetzt', 'success');
    }
}

// Load settings on page load
function loadSettings() {
    try {
        const saved = localStorage.getItem('pdf-form-settings');
        if (saved) {
            const settings = JSON.parse(saved);
            window.appSettings = settings;
            
            if (settings.fileNamePattern) {
                const elem = document.getElementById('fileNamePattern');
                if (elem) elem.value = settings.fileNamePattern;
            }
            if (settings.emailAddress) {
                const elem = document.getElementById('emailAddress');
                if (elem) elem.value = settings.emailAddress;
            }
            if (settings.emailSubject) {
                const elem = document.getElementById('emailSubject');
                if (elem) elem.value = settings.emailSubject;
            }
            if (settings.emailBody) {
                const elem = document.getElementById('emailBody');
                if (elem) elem.value = settings.emailBody;
            }
        } else {
            // Set defaults
            window.appSettings = {
                fileNamePattern: '[Nachname], [Vorname] - [PDF] - [Datum]',
                emailAddress: '',
                emailSubject: 'Formularunterlagen - [Nachname], [Vorname]',
                emailBody: 'Sehr geehrte Damen und Herren,\n\nanbei übersende ich Ihnen die ausgefüllten Formularunterlagen.\n\nMit freundlichen Grüßen'
            };
        }
    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
    }
}

function openEmailDraft() {
    const data = getAllFormData();
    
    let subject = window.appSettings.emailSubject;
    let body = window.appSettings.emailBody;
    
    Object.keys(data).forEach(fieldName => {
        const regex = new RegExp(`\\[${fieldName}\\]`, 'g');
        subject = subject.replace(regex, data[fieldName] || '');
    });
    
    const today = new Date().toISOString().split('T')[0];
    subject = subject.replace(/\[Datum\]/g, today);
    
    const mailtoLink = `mailto:${window.appSettings.emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
}

// Add event listener for field type changes
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    
    const typeSelect = document.getElementById('configFieldType');
    if (typeSelect) {
        typeSelect.addEventListener('change', handleFieldTypeChange);
    }
});

console.log('✅ UI Manager (Email-Client Style) loaded');