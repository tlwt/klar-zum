// js/ui-manager.js
// UI-Management für Email-Client-Layout

// Email-Client Navigation System
function showView(viewName) {
    console.log(`🔄 Switching to view: ${viewName}`);
    
    // Handle live preview when leaving form-fields view
    if (viewName !== 'form-fields' && window.livePreview && window.livePreview.isActive) {
        console.log('🔄 Disabling live preview when leaving form-fields view');
        // Disable live preview to clean up layout classes
        if (typeof toggleLivePreview === 'function') {
            toggleLivePreview();
        }
    }
    
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
    
    // Automatically enable live preview and select first PDF
    setTimeout(() => {
        enableLivePreviewAutomatically();
    }, 500);
    
    console.log('View-Wechsel abgeschlossen');
}

function generatePDFSelection() {
    console.log('📋 generatePDFSelection() called');
    console.log('📋 availablePDFs:', window.availablePDFs?.length || 'undefined');
    
    const container = document.getElementById('pdfSelection');
    if (!container) {
        console.error('❌ pdfSelection container not found!');
        return;
    }
    
    container.innerHTML = '';
    
    if (!window.availablePDFs || window.availablePDFs.length === 0) {
        container.innerHTML = '<div class="pdf-checkbox"><div class="pdf-info"><h4>⚠️ Keine PDFs gefunden</h4><p>Die PDF-Formulare konnten nicht geladen werden.</p></div></div>';
        return;
    }
    
    console.log(`📋 Generiere ${window.availablePDFs.length} PDF-Optionen`);
    
    window.availablePDFs.forEach((pdf, index) => {
        const fieldsPreview = generateFieldsPreview(pdf.fields);
        const configStatus = pdf.hasConfig ? 
            '<div class="config-status config-found">✅ Konfiguration gefunden</div>' :
            '<div class="config-status config-missing">⚠️ Keine Konfiguration</div>';
        
        const div = document.createElement('div');
        div.className = 'pdf-checkbox';
        div.setAttribute('data-pdf-name', pdf.name);
        div.setAttribute('data-pdf-index', index);
        
        // Make the entire div clickable
        div.onclick = function(event) {
            // Prevent double-triggering when clicking the checkbox itself
            if (event.target.type !== 'checkbox') {
                const checkbox = div.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                onPDFSelectionChange();
            }
        };
        
        // Add hover effects for PDF preview
        div.onmouseenter = function() {
            showPDFPreview(pdf);
        };
        
        div.innerHTML = `
            <input type="checkbox" id="pdf_${index}" value="${pdf.name}" onchange="onPDFSelectionChange()" onclick="event.stopPropagation()">
            <div class="pdf-info">
                <h4>${pdf.name}</h4>
                <div class="pdf-path">${pdf.path}</div>
                ${configStatus}
                <div class="fields-preview">
                    <div class="fields-short">Felder (${pdf.fields.length}): ${fieldsPreview.short}</div>
                    <div class="fields-full">Felder (${pdf.fields.length}): ${fieldsPreview.full}</div>
                    ${pdf.fields.length > 3 ? `<div class="fields-toggle" onclick="toggleFields(this); event.stopPropagation();">Alle anzeigen</div>` : ''}
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
    console.log('window.selectedPDFs before clear:', window.selectedPDFs);
    
    if (!window.selectedPDFs) {
        console.error('❌ window.selectedPDFs ist nicht initialisiert!');
        window.selectedPDFs = new Set();
    }
    
    // Debug: Check DOM structure
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    console.log('🔍 Alle Checkboxen gefunden:', allCheckboxes.length);
    allCheckboxes.forEach((cb, index) => {
        console.log(`  Checkbox ${index}:`, cb.id, cb.value, 'closest(.pdf-checkbox):', !!cb.closest('.pdf-checkbox'));
    });
    
    window.selectedPDFs.clear();
    const checkedBoxes = document.querySelectorAll('input[type="checkbox"]:checked');
    console.log('Gefundene aktivierte Checkboxen:', checkedBoxes.length);
    
    checkedBoxes.forEach(checkbox => {
        console.log('Aktivierte Checkbox:', checkbox.value);
        window.selectedPDFs.add(checkbox.value);
        
        const pdfCheckboxElement = checkbox.closest('.pdf-checkbox');
        if (pdfCheckboxElement) {
            pdfCheckboxElement.classList.add('selected');
        } else {
            console.warn('⚠️ PDF checkbox parent element not found for:', checkbox);
        }
    });
    
    document.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach(checkbox => {
        const pdfCheckboxElement = checkbox.closest('.pdf-checkbox');
        if (pdfCheckboxElement) {
            pdfCheckboxElement.classList.remove('selected');
        } else {
            console.warn('⚠️ PDF checkbox parent element not found for unchecked:', checkbox);
        }
    });
    
    console.log('Neue Auswahl - selectedPDFs:', Array.from(window.selectedPDFs));
    console.log('selectedPDFs.size:', window.selectedPDFs.size);
    
    updateSelectionSummary();
    updateNextButton();
    
    console.log('onPDFSelectionChange() beendet');
    
    // Keep the last selected PDF visible in preview
    updatePDFPreviewForSelection();
}

function updateSelectionSummary() {
    // Hide the old summary div (we'll use notifications instead)
    const summaryDiv = document.getElementById('selectionSummary');
    if (summaryDiv) {
        summaryDiv.style.display = 'none';
    }
    
    // Show notification with selected PDFs
    if (window.selectedPDFs.size === 0) {
        // No notification when nothing is selected
        return;
    } else {
        const pdfCount = window.selectedPDFs.size;
        const pdfList = Array.from(window.selectedPDFs).join(', ');
        
        let message;
        if (pdfCount === 1) {
            message = `📄 ${pdfCount} PDF ausgewählt: ${pdfList}`;
        } else {
            message = `📄 ${pdfCount} PDFs ausgewählt: ${pdfList}`;
        }
        
        showNotification(message, 'success', 3000); // Short duration for selection updates
    }
}

function updateNextButton() {
    const nextButton = document.getElementById('nextButton');
    const formFieldsMenuItem = document.getElementById('formFieldsMenuItem');
    
    console.log('🔄 updateNextButton() - selectedPDFs.size:', window.selectedPDFs?.size || 'undefined');
    console.log('🔄 nextButton found:', !!nextButton);
    console.log('🔄 formFieldsMenuItem found:', !!formFieldsMenuItem);
    
    if (window.selectedPDFs && window.selectedPDFs.size > 0) {
        if (nextButton) {
            nextButton.disabled = false;
            console.log('✅ Next button enabled');
        }
        if (formFieldsMenuItem) {
            formFieldsMenuItem.classList.remove('disabled');
            console.log('✅ Form fields menu item enabled');
        }
    } else {
        if (nextButton) {
            nextButton.disabled = true;
            console.log('❌ Next button disabled');
        }
        if (formFieldsMenuItem) {
            formFieldsMenuItem.classList.add('disabled');
            console.log('❌ Form fields menu item disabled');
        }
    }
}

// Show notification message (replaces old status bar)
function showStatus(message, type = 'info') {
    showNotification(message, type);
}

// Modern notification system
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notificationContainer');
    if (!container) {
        console.warn('Notification container not found');
        return;
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => removeNotification(notification);
    
    // Set content
    notification.innerHTML = `${message}`;
    notification.appendChild(closeBtn);
    
    // Add to container
    container.appendChild(notification);
    
    // Trigger show animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto-remove after duration (except for errors which stay longer)
    if (type === 'error') {
        duration = 10000; // Errors stay 10 seconds
    }
    
    setTimeout(() => {
        removeNotification(notification);
    }, duration);
    
    return notification;
}

// Remove notification with animation
function removeNotification(notification) {
    if (!notification || !notification.parentElement) return;
    
    notification.classList.remove('show');
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
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

// Automatically enable live preview and select first PDF
function enableLivePreviewAutomatically() {
    console.log('🔄 Live-Vorschau wird aktiviert');
    
    // Enable live preview if not already active
    if (!window.livePreview || !window.livePreview.isActive) {
        if (typeof toggleLivePreview === 'function') {
            toggleLivePreview();
            console.log('✅ Live-Vorschau aktiviert');
            
            // The toggleLivePreview function will call initializeLivePreview()
            // which already handles auto-selection of the first PDF, so we don't need to do it here
        }
    } else {
        console.log('Live-Vorschau bereits aktiv');
        
        // If already active, just make sure the dropdown is populated
        const pdfSelector = document.getElementById('livePreviewPDFSelector');
        if (pdfSelector && window.selectedPDFs && window.selectedPDFs.size > 0) {
            // Check if dropdown is empty and repopulate if needed
            if (pdfSelector.children.length <= 1) {
                console.log('🔄 Dropdown ist leer, fülle es neu...');
                
                pdfSelector.innerHTML = '<option value="">PDF auswählen...</option>';
                window.selectedPDFs.forEach(pdfName => {
                    const option = document.createElement('option');
                    option.value = pdfName;
                    option.textContent = pdfName;
                    pdfSelector.appendChild(option);
                });
                
                // Auto-select first PDF
                const firstPDF = Array.from(window.selectedPDFs)[0];
                pdfSelector.value = firstPDF;
                
                if (typeof switchLivePreviewPDF === 'function') {
                    switchLivePreviewPDF();
                }
                
                console.log(`✅ Dropdown neu gefüllt und erstes PDF ausgewählt: ${firstPDF}`);
            }
        }
    }
}

// PDF Preview functionality
let currentlySelectedPDF = null; // Track last selected PDF

function showPDFPreview(pdf) {
    console.log('📄 Showing PDF preview for:', pdf.name);
    
    const previewContent = document.getElementById('pdfPreviewContent');
    if (!previewContent) {
        console.warn('PDF preview content element not found');
        return;
    }
    
    previewContent.innerHTML = `
        <div id="pdfPreviewContainer_${pdf.name.replace(/[^a-zA-Z0-9]/g, '_')}" style="width: 100%; height: 100%; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <div style="text-align: center; color: #7f8c8d;">
                <div style="font-size: 24px; margin-bottom: 10px;">📄</div>
                <div>PDF wird geladen...</div>
            </div>
        </div>
    `;
    
    // Load and render the actual PDF
    loadActualPDFPreview(pdf);
}

async function loadActualPDFPreview(pdf) {
    const containerId = `pdfPreviewContainer_${pdf.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.warn('PDF preview container not found:', containerId);
        return;
    }
    
    try {
        console.log('🔄 Loading PDF preview for:', pdf.name);
        
        // Load the PDF file - correct path relative to main app
        const pdfPath = `../formulare/${pdf.name}`;
        const response = await fetch(pdfPath);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        
        // Get the first page
        const pages = pdfDoc.getPages();
        if (pages.length === 0) {
            throw new Error('PDF has no pages');
        }
        
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        
        // Create a new PDF with just the first page for preview
        const previewDoc = await PDFLib.PDFDocument.create();
        const [copiedPage] = await previewDoc.copyPages(pdfDoc, [0]);
        previewDoc.addPage(copiedPage);
        
        // Convert to data URL
        const pdfBytes = await previewDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Create an embed element to show the PDF
        container.innerHTML = `
            <embed src="${url}" type="application/pdf" width="100%" height="100%" style="border: none; border-radius: 4px;">
        `;
        
        console.log('✅ PDF preview loaded successfully for:', pdf.name);
        
    } catch (error) {
        console.warn('❌ Error loading PDF preview:', error);
        
        // Show fallback content
        container.innerHTML = `
            <div style="text-align: center; color: #7f8c8d; padding: 20px;">
                <div style="font-size: 32px; margin-bottom: 10px;">📄</div>
                <div style="font-weight: bold; margin-bottom: 5px;">${pdf.name}</div>
                <div style="font-size: 0.9rem;">PDF Vorschau nicht verfügbar</div>
                <div style="font-size: 0.8rem; margin-top: 5px; color: #95a5a6;">
                    Grund: ${error.message}
                </div>
            </div>
        `;
    }
}

function updatePDFPreviewForSelection() {
    // Show preview for the last selected PDF
    if (window.selectedPDFs && window.selectedPDFs.size > 0) {
        const lastSelectedPDFName = Array.from(window.selectedPDFs).pop();
        const pdf = window.availablePDFs?.find(p => p.name === lastSelectedPDFName);
        if (pdf) {
            currentlySelectedPDF = pdf;
            showPDFPreview(pdf);
            console.log('📄 Updated preview for selected PDF:', lastSelectedPDFName);
        }
    } else if (currentlySelectedPDF) {
        // If no PDFs are selected but we had one before, keep showing it
        showPDFPreview(currentlySelectedPDF);
        console.log('📄 Keeping previous PDF in preview');
    } else {
        // Show placeholder
        showPDFPreviewPlaceholder();
    }
}

function showPDFPreviewPlaceholder() {
    const previewContent = document.getElementById('pdfPreviewContent');
    if (previewContent) {
        previewContent.innerHTML = `
            <div class="preview-placeholder">
                <div class="preview-icon">📄</div>
                <p>Bewegen Sie die Maus über ein PDF, um eine Vorschau zu sehen</p>
            </div>
        `;
    }
}

console.log('✅ UI Manager (Email-Client Style) loaded');