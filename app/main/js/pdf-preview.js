// js/pdf-preview.js
// Live PDF Vorschau-Funktionalität mit ausgefüllten Feldern in Echtzeit

// Globale Variablen für die Live-Vorschau
window.livePreview = {
    isActive: false,
    currentPDF: null,
    currentPage: 1,
    totalPages: 1,
    scale: 1.5, // Will be calculated dynamically for 95% fill
    pdfDocument: null,
    canvas: null,
    context: null,
    updateTimer: null,
    lastFormData: null
};

// PDF.js Worker URL setzen
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.min.js';
}

function toggleLivePreview() {
    if (window.selectedPDFs.size === 0) {
        showStatus('Bitte wählen Sie zuerst ein PDF aus!', 'error');
        return;
    }

    const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
    const toggleBtn = document.getElementById('livePreviewToggle'); // May be null if button was removed

    if (window.livePreview.isActive) {
        // Deaktivieren
        window.livePreview.isActive = false;
        document.body.classList.remove('live-preview-active');
        pdfPreviewContainer.style.display = 'none';
        
        // Only update button text if button exists
        if (toggleBtn) {
            toggleBtn.textContent = '👁️ Live-Vorschau';
        }
        
        // Timer stoppen
        if (window.livePreview.updateTimer) {
            clearTimeout(window.livePreview.updateTimer);
            window.livePreview.updateTimer = null;
        }
        
        // Event-Listener entfernen
        if (window.livePreview.scheduleUpdate) {
            document.removeEventListener('input', window.livePreview.scheduleUpdate);
            document.removeEventListener('change', window.livePreview.scheduleUpdate);
            document.removeEventListener('signature-updated', window.livePreview.scheduleUpdate);
            window.livePreview.scheduleUpdate = null;
        }
        
        // Cleanup
        if (window.livePreview.pdfDocument) {
            window.livePreview.pdfDocument.destroy();
            window.livePreview.pdfDocument = null;
        }
        
    } else {
        // Aktivieren
        window.livePreview.isActive = true;
        document.body.classList.add('live-preview-active');
        pdfPreviewContainer.style.display = 'flex';
        
        // Only update button text if button exists
        if (toggleBtn) {
            toggleBtn.textContent = '❌ Vorschau schließen';
        }
        
        initializeLivePreview();
    }
}

async function initializeLivePreview() {
    // console.log('🎬 initializeLivePreview() gestartet');
    const selector = document.getElementById('livePreviewPDFSelector');
    
    if (!selector) {
        console.error('❌ livePreviewPDFSelector nicht gefunden!');
        return;
    }
    
    // console.log('📋 window.selectedPDFs:', Array.from(window.selectedPDFs || []));
    
    // PDF-Auswahl aktualisieren
    selector.innerHTML = '<option value="">PDF auswählen...</option>';
    
    if (window.selectedPDFs && window.selectedPDFs.size > 0) {
        window.selectedPDFs.forEach(pdfName => {
            const option = document.createElement('option');
            option.value = pdfName;
            option.textContent = pdfName;
            selector.appendChild(option);
    // console.log(`➕ Option hinzugefügt: ${pdfName}`);
        });
        
    // console.log(`✅ ${selector.children.length - 1} PDF-Optionen hinzugefügt`);
    } else {
        console.warn('⚠️ Keine selectedPDFs gefunden!');
    }

    // Erstes PDF automatisch auswählen (immer, auch bei mehreren PDFs)
    if (window.selectedPDFs.size >= 1) {
        const firstPDF = Array.from(window.selectedPDFs)[0];
        selector.value = firstPDF;
        await switchLivePreviewPDF();
    }
    
    // Canvas initialisieren
    const canvas = document.getElementById('livePreviewCanvas');
    window.livePreview.canvas = canvas;
    window.livePreview.context = canvas.getContext('2d');
    
    // Event-Listener für Formular-Änderungen hinzufügen
    setupLivePreviewListeners();
}

async function switchLivePreviewPDF() {
    // console.log('🔄 switchLivePreviewPDF() aufgerufen');
    
    const selector = document.getElementById('livePreviewPDFSelector');
    if (!selector) {
        console.error('❌ livePreviewPDFSelector nicht gefunden!');
        return;
    }
    
    const selectedPDF = selector.value;
    // console.log('📄 Ausgewähltes PDF:', selectedPDF);
    
    if (!selectedPDF) {
    // console.log('⚠️ Kein PDF ausgewählt, beende Funktion');
        return;
    }

    showLivePreviewLoading(true);
    
    try {
        // PDF-Objekt finden
    // console.log('🔍 Suche PDF-Info für:', selectedPDF);
        const pdfInfo = window.availablePDFs.find(pdf => pdf.name === selectedPDF);
        if (!pdfInfo) {
            console.error('❌ PDF nicht in availablePDFs gefunden:', selectedPDF);
    // console.log('Available PDFs:', window.availablePDFs.map(p => p.name));
            throw new Error('PDF nicht gefunden');
        }
        
    // console.log('✅ PDF-Info gefunden:', pdfInfo.name);

        window.livePreview.currentPDF = selectedPDF;
        window.livePreview.currentPage = 1;
        
    // console.log('🔄 Erzwinge PDF-Wechsel...');
        // Force update by resetting last form data and calling update
        window.livePreview.lastFormData = null; // Reset to force update
        await updateLivePreview();
        
        // Sicherstellen dass erste Seite korrekt angezeigt wird
        setTimeout(async () => {
            if (window.livePreview.pdfDocument && window.livePreview.currentPage === 1) {
                await renderLivePreviewPage();
                updateLivePreviewControls();
            }
        }, 100);

    } catch (error) {
        console.error('Fehler beim Laden der Live-Vorschau:', error);
        showStatus('Fehler beim Laden der Live-Vorschau: ' + error.message, 'error');
    } finally {
        showLivePreviewLoading(false);
    }
}

// Live-Update-Funktion die bei Formular-Änderungen aufgerufen wird
async function updateLivePreview() {
    // console.log('📄 updateLivePreview() gestartet');
    // console.log('  isActive:', window.livePreview.isActive);
    // console.log('  currentPDF:', window.livePreview.currentPDF);
    
    if (!window.livePreview.isActive || !window.livePreview.currentPDF) {
    // console.log('❌ Abbruch: Live-Vorschau inaktiv oder kein PDF ausgewählt');
        return;
    }

    try {
        // Aktuelle Formular-Daten abrufen
        const formData = getAllFormData();
        
        // Prüfe ob sich die Daten geändert haben
        const formDataString = JSON.stringify(formData);
    // console.log('🔍 Formdata-Check:', formDataString === window.livePreview.lastFormData ? 'GLEICH' : 'UNTERSCHIEDLICH');
        
        if (formDataString === window.livePreview.lastFormData) {
    // console.log('⏭️ Keine Änderung der Formulardaten, überspringe Update');
            return; // Keine Änderung
        }
        window.livePreview.lastFormData = formDataString;

    // console.log('🔄 Live-Vorschau aktualisieren...');
        
        // PDF-Objekt finden
        const pdfInfo = window.availablePDFs.find(pdf => pdf.name === window.livePreview.currentPDF);
        if (!pdfInfo) {
            throw new Error('PDF nicht gefunden');
        }

        // PDF mit ausgefüllten Daten erstellen
        const filledPdfBytes = await createFilledPDFForLivePreview(pdfInfo, formData);
        
        // Altes PDF-Dokument aufräumen
        if (window.livePreview.pdfDocument) {
            window.livePreview.pdfDocument.destroy();
        }
        
        // PDF mit PDF.js laden
        const loadingTask = pdfjsLib.getDocument({ data: filledPdfBytes });
        window.livePreview.pdfDocument = await loadingTask.promise;
        window.livePreview.totalPages = window.livePreview.pdfDocument.numPages;

        // Aktuelle Seite rendern - mit kleiner Verzögerung für bessere Stabilität
        await new Promise(resolve => setTimeout(resolve, 50));
        await renderLivePreviewPage();
        updateLivePreviewControls();

    } catch (error) {
        console.error('Fehler beim Aktualisieren der Live-Vorschau:', error);
    }
}

async function createFilledPDFForLivePreview(pdfInfo, formData) {
    try {
        // Lade Original-PDF direkt vom Server für Live-Vorschau
        const response = await fetch(pdfInfo.path);
        if (!response.ok) {
            throw new Error(`Konnte PDF nicht laden: ${pdfInfo.path}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        
        let pdfDoc;
        try {
            pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        } catch (loadError) {
            console.warn(`PDF ${pdfInfo.name} kann nicht mit pdf-lib geladen werden, verwende Original für Live-Vorschau:`, loadError);
            // Verwende das Original-PDF direkt ohne Bearbeitung für die Live-Vorschau
            return arrayBuffer;
        }
        const form = pdfDoc.getForm();
        
        let filledFields = 0;
        const pdfConfig = window.pdfConfigs.get(pdfInfo.name) || {};
        
        // Hauptlogik: Iteriere über alle PDF-Felder und versuche sie zu setzen
        for (const fieldName of pdfInfo.fields) {
            let value = null;
            
            // Prüfe direkte Übereinstimmung
            if (formData[fieldName] && formData[fieldName].toString().trim() !== '') {
                value = formData[fieldName];
            } else {
                // Prüfe Mapping aus der PDF-spezifischen Konfiguration
                const fieldConf = pdfConfig.fields?.[fieldName] || {};
                if (fieldConf.mapping && formData[fieldConf.mapping] && formData[fieldConf.mapping].toString().trim() !== '') {
                    value = formData[fieldConf.mapping];
                }
            }
            
            if (value !== null && value !== undefined) {
                try {
                    const field = form.getField(fieldName);
                    if (field) {
                        const success = await setFieldValueForLivePreview(field, value, fieldName, pdfDoc, pdfInfo.name);
                        if (success) {
                            filledFields++;
                        }
                    } else {
                        // Spezielle Behandlung für Unterschrift-Felder ohne Formularfeld
                        if (fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) {
                            if (value && value.startsWith('data:image/')) {
                                const success = await embedSignatureInPDF(pdfDoc, fieldName, value, pdfInfo.name);
                                if (success) {
                                    filledFields++;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Fehler beim Setzen des Live-Vorschau-Feldes ${fieldName}:`, error);
                    
                    // Spezielle Behandlung für Unterschrift-Felder bei Fehlern
                    if (fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) {
                        if (value && value.startsWith('data:image/')) {
                            try {
                                const success = await embedSignatureInPDF(pdfDoc, fieldName, value, pdfInfo.name);
                                if (success) {
                                    filledFields++;
                                }
                            } catch (signatureError) {
                                console.warn(`Fehler beim Einbetten der Unterschrift ${fieldName} in Live-Vorschau:`, signatureError);
                            }
                        }
                    }
                }
            }
        }
        
        // Behandle Unterschrift-Felder die nicht als PDF-Formularfelder existieren
        for (const [fieldName, fieldValue] of Object.entries(formData)) {
            if ((fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) && 
                fieldValue && fieldValue.startsWith('data:image/')) {
                
                // Prüfe ob diese Unterschrift für dieses PDF konfiguriert ist
                const signatureConfig = getSignatureConfig(fieldName, pdfInfo.name);
                if (signatureConfig.x === undefined && signatureConfig.y === undefined) {
    // console.log(`⏭️ Live-Vorschau: Unterschrift ${fieldName} ist nicht für ${pdfInfo.name} konfiguriert - überspringe`);
                    continue;
                }
                
                // Prüfe ob bereits als Formularfeld verarbeitet
                let alreadyProcessed = false;
                try {
                    const field = form.getField(fieldName);
                    if (field) {
                        alreadyProcessed = true;
                    }
                } catch (e) {
                    // Feld existiert nicht als Formularfeld - das ist ok
                }
                
                if (!alreadyProcessed) {
                    try {
                        const success = await embedSignatureInPDF(pdfDoc, fieldName, fieldValue, pdfInfo.name);
                        if (success) {
                            filledFields++;
                        }
                    } catch (signatureError) {
                        console.warn(`Fehler beim Einbetten der separaten Unterschrift ${fieldName} in Live-Vorschau:`, signatureError);
                    }
                }
            }
        }
        
        // Form-Updates (NICHT flatten für Vorschau!)
        try {
            const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            form.updateFieldAppearances(helveticaFont);
        } catch (error) {
            console.warn('Fehler beim Aktualisieren der Appearances in Live-Vorschau:', error);
        }
        
        const finalPdfBytes = await pdfDoc.save({
            useObjectStreams: false
        });
        
        return finalPdfBytes;
        
    } catch (error) {
        console.error('Fehler beim Erstellen der ausgefüllten PDF für Live-Vorschau:', error);
        throw error;
    }
}

// Event-Listener für Live-Updates einrichten
function setupLivePreviewListeners() {
    // Debouncing für bessere Performance
    let updateTimeout = null;
    
    function scheduleUpdate() {
        if (!window.livePreview.isActive || !window.livePreview.currentPDF) return;
        
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(async () => {
            await updateLivePreview();
        }, 300); // 300ms Debounce
    }
    
    // Entferne alte Event-Listener falls vorhanden
    if (window.livePreview.scheduleUpdate) {
        document.removeEventListener('input', window.livePreview.scheduleUpdate);
        document.removeEventListener('change', window.livePreview.scheduleUpdate);
        document.removeEventListener('signature-updated', window.livePreview.scheduleUpdate);
    }
    
    // Speichere Referenz für Cleanup
    window.livePreview.scheduleUpdate = scheduleUpdate;
    
    // Event-Listener für alle Eingabefelder
    document.addEventListener('input', scheduleUpdate);
    document.addEventListener('change', scheduleUpdate);
    
    // Spezielle Event-Listener für Unterschrift-Felder
    document.addEventListener('signature-updated', scheduleUpdate);
}

async function setFieldValueForLivePreview(field, value, fieldName, pdfDoc, currentPdfName) {
    try {
        // Spezielle Behandlung für Unterschrift (Base64-Bilder)
        if (fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) {
            if (value && value.startsWith('data:image/')) {
                return await embedSignatureInPDF(pdfDoc, fieldName, value, currentPdfName);
            } else {
                return false;
            }
        }
        
        if (field instanceof PDFLib.PDFTextField) {
            field.setText(String(value));
            return true;
        } 
        else if (field instanceof PDFLib.PDFCheckBox) {
            const shouldCheck = value === '1' || value === 'true' || value === true || 
                               value === 'on' || value === 'Ja' || value === 'ja' || 
                               value === 'YES' || value === 'yes' || value === 'checked';
            
            if (shouldCheck) {
                field.check();
            } else {
                field.uncheck();
            }
            return true;
        } 
        else if (field instanceof PDFLib.PDFRadioGroup) {
            const options = field.getOptions();
            const valueStr = String(value);
            
            if (options.includes(valueStr)) {
                field.select(valueStr);
                return true;
            }
            
            if (options.length > 0) {
                field.select(options[0]);
                return true;
            }
            
            return false;
        } 
        else if (field instanceof PDFLib.PDFDropdown) {
            const options = field.getOptions();
            const valueStr = String(value);
            
            if (options.includes(valueStr)) {
                field.select(valueStr);
                return true;
            }
            
            const target = options.find(v => /übung|uebung/i.test(v)) || options[0];
            if (target) {
                field.select(target);
                return true;
            }
            
            return false;
        } 
        else if (field instanceof PDFLib.PDFOptionList) {
            const options = field.getOptions();
            if (options.length > 0) {
                field.select(options[0]);
                return true;
            }
            return false;
        } 
        else {
            if (typeof field.setText === 'function') {
                field.setText(String(value));
                return true;
            }
            return false;
        }
    } catch (error) {
        console.warn(`Fehler beim Setzen von Live-Vorschau-Feld ${fieldName}:`, error);
        return false;
    }
}

// Calculate optimal scale to fill 95% of available space
function calculateOptimalScale() {
    if (!window.livePreview.pdfDocument || !window.livePreview.canvas) return 1.5;
    
    try {
        const previewContent = document.querySelector('.preview-content');
        if (!previewContent) return 1.5;
        
        const containerWidth = previewContent.clientWidth * 0.95; // 95% of container width
        const containerHeight = previewContent.clientHeight * 0.95; // 95% of container height
        
    // console.log(`📐 Container size: ${containerWidth}x${containerHeight}`);
        
        return { containerWidth, containerHeight };
    } catch (error) {
        console.warn('Error calculating optimal scale:', error);
        return 1.5;
    }
}

async function renderLivePreviewPage() {
    if (!window.livePreview.pdfDocument || !window.livePreview.canvas) {
        console.warn('PDF-Dokument oder Canvas nicht verfügbar für Rendering');
        return;
    }

    try {
    // console.log(`Rendering Live-Vorschau Seite ${window.livePreview.currentPage} von ${window.livePreview.totalPages}`);
        
        const page = await window.livePreview.pdfDocument.getPage(window.livePreview.currentPage);
        
        // Calculate optimal scale for 95% fill
        const containerInfo = calculateOptimalScale();
        if (containerInfo.containerWidth && containerInfo.containerHeight) {
            const originalViewport = page.getViewport({ scale: 1.0 });
            const scaleX = containerInfo.containerWidth / originalViewport.width;
            const scaleY = containerInfo.containerHeight / originalViewport.height;
            const optimalScale = Math.min(scaleX, scaleY, 3.0); // Max scale of 3.0 to prevent too large images
            
    // console.log(`📐 Calculated scale: ${optimalScale.toFixed(2)} (PDF: ${originalViewport.width}x${originalViewport.height})`);
            window.livePreview.scale = optimalScale;
        }
        
        const viewport = page.getViewport({ scale: window.livePreview.scale });
        
        // Canvas-Größe anpassen
        window.livePreview.canvas.width = viewport.width;
        window.livePreview.canvas.height = viewport.height;
        
        // Canvas leeren
        window.livePreview.context.clearRect(0, 0, viewport.width, viewport.height);
        
        // Seite rendern
        const renderContext = {
            canvasContext: window.livePreview.context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
    // console.log(`✓ Live-Vorschau Seite ${window.livePreview.currentPage} erfolgreich gerendert`);
        
        // Canvas sichtbar machen
        showLivePreviewLoading(false);
        
    } catch (error) {
        console.error('Fehler beim Rendern der Live-Vorschau-Seite:', error);
        showLivePreviewLoading(false);
    }
}

function updateLivePreviewControls() {
    const pageInfo = document.getElementById('livePreviewPageInfo');
    const prevBtn = document.getElementById('livePrevPageBtn');
    const nextBtn = document.getElementById('liveNextPageBtn');
    
    pageInfo.textContent = `${window.livePreview.currentPage}/${window.livePreview.totalPages}`;
    prevBtn.disabled = window.livePreview.currentPage <= 1;
    nextBtn.disabled = window.livePreview.currentPage >= window.livePreview.totalPages;
}

async function previousLivePreviewPage() {
    if (window.livePreview.currentPage > 1) {
        window.livePreview.currentPage--;
        await renderLivePreviewPage();
        updateLivePreviewControls();
    }
}

async function nextLivePreviewPage() {
    if (window.livePreview.currentPage < window.livePreview.totalPages) {
        window.livePreview.currentPage++;
        await renderLivePreviewPage();
        updateLivePreviewControls();
    }
}

function showLivePreviewLoading(show) {
    const loading = document.getElementById('livePreviewLoading');
    const canvas = document.getElementById('livePreviewCanvas');
    
    if (show) {
        loading.style.display = 'flex';
        canvas.style.display = 'none';
    } else {
        loading.style.display = 'none';
        canvas.style.display = 'block';
    }
}

// Legacy-Funktionen für Kompatibilität
function showPDFPreview() {
    // Fallback zur Live-Vorschau
    toggleLivePreview();
}

function closePDFPreview() {
    if (window.livePreview.isActive) {
        toggleLivePreview();
    }
}