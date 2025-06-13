// js/data-manager.js
// Datenverwaltung und Import/Export - Erweitert mit Unterschrift-Unterstützung

function getAllFormData() {
    const formData = {};
    
    // Reguläre Formularfelder (sichtbare Felder haben Vorrang)
    const form = document.getElementById('dataForm');
    if (form) {
        const formDataObj = new FormData(form);
        for (let [key, value] of formDataObj.entries()) {
            formData[key] = value;
        }
        
        // Checkboxen separat behandeln
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            formData[checkbox.name] = checkbox.checked ? checkbox.value : '';
        });
        
        // Radio Buttons separat behandeln
        form.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
            formData[radio.name] = radio.value;
        });
        
        // Select-Felder separat behandeln
        form.querySelectorAll('select').forEach(select => {
            formData[select.name] = select.value;
        });
        
        // Unterschrift-Felder separat behandeln (versteckte Inputs mit Base64-Daten)
        form.querySelectorAll('input.signature-data').forEach(signatureInput => {
            const fieldName = signatureInput.name || signatureInput.id;
            if (fieldName && signatureInput.value) {
                formData[fieldName] = signatureInput.value;
                console.log(`Unterschrift-Feld ${fieldName} erfasst: ${signatureInput.value.substring(0, 50)}...`);
            }
        });
        
        // Alle Input-Felder direkt auslesen (für den Fall, dass FormData nicht alles erfasst)
        form.querySelectorAll('input, textarea, select').forEach(input => {
            if (input.name || input.id) {
                const fieldName = input.name || input.id;
                if (input.type === 'checkbox') {
                    formData[fieldName] = input.checked ? input.value : '';
                } else if (input.type === 'radio') {
                    if (input.checked) {
                        formData[fieldName] = input.value;
                    }
                } else if (input.classList.contains('signature-data')) {
                    // Unterschrift-Daten nur übernehmen wenn sie existieren
                    if (input.value && input.value.startsWith('data:image/')) {
                        formData[fieldName] = input.value;
                    }
                } else {
                    formData[fieldName] = input.value;
                }
            }
        });
    }
    
    
    // Versteckte Daten aus hiddenData hinzufügen (nur wenn nicht bereits über Formular erfasst)
    Object.keys(window.hiddenData).forEach(key => {
        if (!formData.hasOwnProperty(key)) {
            formData[key] = window.hiddenData[key];
        }
    });
    
    console.log('Gesammelte Formulardaten:', formData);
    return formData;
}

function getFormData() {
    return getAllFormData();
}

function restoreFormData(data) {
    Object.keys(data).forEach(key => {
        // Suche nach regulären Feldern
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = data[key] === '1' || data[key] === 'true' || data[key] === true;
            } else if (element.type === 'radio') {
                element.checked = element.value === data[key];
            } else if (element.classList.contains('signature-data')) {
                // Unterschrift-Daten wiederherstellen
                element.value = data[key];
                restoreSignatureDisplay(key, data[key]);
            } else {
                element.value = data[key];
            }
        } else {
            // Suche nach Radio Button Gruppen
            const radioButtons = document.querySelectorAll(`input[type="radio"][name="${key}"]`);
            if (radioButtons.length > 0) {
                radioButtons.forEach(radio => {
                    radio.checked = radio.value === data[key];
                });
            }
        }
    });
}

function restoreSignatureDisplay(fieldId, base64Data) {
    if (!base64Data || !base64Data.startsWith('data:image/')) {
        return;
    }
    
    console.log(`Stelle Unterschrift für Feld ${fieldId} wieder her`);
    
    // Canvas wiederherstellen (falls im Zeichnen-Modus)
    if (window.signatures && window.signatures.has(fieldId)) {
        window.signatures.get(fieldId).setImageData(base64Data);
    }
    
    // Upload-Preview wiederherstellen
    const preview = document.getElementById(`signature-preview-${fieldId}`);
    if (preview) {
        preview.innerHTML = `<img src="${base64Data}" alt="Unterschrift">`;
        preview.classList.add('has-signature');
    }
    
    console.log(`✓ Unterschrift für ${fieldId} wiederhergestellt`);
}



function getAllData() {
    const formData = getAllFormData();
    return {
        formData: formData,
        hiddenData: window.hiddenData,
        settings: window.appSettings,
        selectedPDFs: Array.from(window.selectedPDFs),
        timestamp: new Date().toISOString()
    };
}

function saveData() {
    const allData = getAllData();
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const data = getAllFormData();
    let fileName = window.appSettings.fileNamePattern;
    const today = new Date().toISOString().split('T')[0];
    
    fileName = fileName.replace(/\[PDF\]/g, 'Daten');
    fileName = fileName.replace(/\[Datum\]/g, today);
    
    Object.keys(data).forEach(fieldName => {
        const regex = new RegExp(`\\[${fieldName}\\]`, 'g');
        // Unterschrift-Daten nicht in Dateinamen verwenden
        if (!(fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature'))) {
            fileName = fileName.replace(regex, data[fieldName] || '');
        } else {
            fileName = fileName.replace(regex, '');
        }
    });
    
    fileName = fileName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s,.-]/g, '_');
    fileName = fileName.replace(/\s+/g, ' ').trim();
    
    // Verwende FileSaver.js
    saveAs(dataBlob, fileName + '.json');
    
    showStatus('Daten erfolgreich gespeichert!');
}

function loadData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Versteckte Daten zurücksetzen
            window.hiddenData = {};
            
            // Versteckte Daten aus dem Datensatz laden
            if (data.hiddenData) {
                window.hiddenData = { ...data.hiddenData };
            }
            
            const formData = data.formData || data;
            
            // Sammle alle sichtbaren Feldnamen aus dem aktuellen Formular
            const visibleFieldNames = new Set();
            document.querySelectorAll('#dataForm input, #dataForm textarea, #dataForm select').forEach(element => {
                if (element.name || element.id) {
                    visibleFieldNames.add(element.name || element.id);
                }
            });
            
            console.log('Sichtbare Felder:', Array.from(visibleFieldNames));
            
            // Nur Daten in hiddenData speichern, die NICHT in sichtbaren Feldern vorkommen
            Object.keys(formData).forEach(key => {
                if (!visibleFieldNames.has(key)) {
                    window.hiddenData[key] = formData[key];
                    console.log(`Feld ${key} als versteckt markiert`);
                } else {
                    console.log(`Feld ${key} ist sichtbar - nicht in hiddenData`);
                }
            });
            
            // Formularfelder setzen (nur sichtbare Felder)
            for (const [key, value] of Object.entries(formData)) {
                // URL-Parameter haben Vorrang - überspringen wenn URL-Parameter vorhanden
                if (window.urlParamData && window.urlParamData.hasOwnProperty(key)) {
                    console.log(`Feld ${key} wird durch URL-Parameter geschützt`);
                    continue;
                }
                
                // Reguläre Felder
                const element = document.getElementById(key);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = value === '1' || value === 'true' || value === true;
                    } else if (element.type === 'radio') {
                        element.checked = element.value === value;
                    } else if (element.classList.contains('signature-data')) {
                        // Unterschrift-Daten wiederherstellen
                        element.value = value;
                        restoreSignatureDisplay(key, value);
                    } else {
                        element.value = value;
                    }
                    console.log(`Feld ${key} gesetzt mit Wert: ${value}`);
                } else {
                    // Radio Button Gruppen
                    const radioButtons = document.querySelectorAll(`input[type="radio"][name="${key}"]`);
                    if (radioButtons.length > 0) {
                        radioButtons.forEach(radio => {
                            radio.checked = radio.value === value;
                        });
                        console.log(`Radio-Gruppe ${key} gesetzt mit Wert: ${value}`);
                    }
                }
            }
            
            if (data.settings) {
                window.appSettings = { ...window.appSettings, ...data.settings };
                loadSettingsToForm();
            }
            
            if (data.selectedPDFs) {
                window.selectedPDFs.clear();
                data.selectedPDFs.forEach(pdfName => {
                    // Versuche direkten Match
                    let checkbox = document.querySelector(`input[value="${pdfName}"]`);
                    let actualPdfName = pdfName;
                    
                    // Falls nicht gefunden, versuche fuzzy matching (für umbenannte PDFs)
                    if (!checkbox) {
                        console.log(`⚠️ PDF ${pdfName} nicht gefunden, versuche fuzzy matching...`);
                        
                        // Versuche ähnliche Namen zu finden
                        const allCheckboxes = document.querySelectorAll('.pdf-checkbox input[type="checkbox"]');
                        for (const cb of allCheckboxes) {
                            const normalizedStored = pdfName.toLowerCase().replace(/[äöüß]/g, match => {
                                const replacements = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'};
                                return replacements[match] || match;
                            });
                            const normalizedAvailable = cb.value.toLowerCase().replace(/[äöüß]/g, match => {
                                const replacements = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'};
                                return replacements[match] || match;
                            });
                            
                            if (normalizedStored === normalizedAvailable) {
                                checkbox = cb;
                                actualPdfName = cb.value;
                                console.log(`✅ Fuzzy match gefunden: ${pdfName} -> ${actualPdfName}`);
                                break;
                            }
                        }
                    }
                    
                    if (checkbox) {
                        window.selectedPDFs.add(actualPdfName);
                        checkbox.checked = true;
                        checkbox.closest('.pdf-checkbox').classList.add('selected');
                        console.log(`✅ PDF ausgewählt: ${actualPdfName}`);
                    } else {
                        console.warn(`❌ PDF nicht gefunden: ${pdfName}`);
                    }
                });
                updateSelectionSummary();
                updateNextButton();
            }
            
            // Versteckte Daten anzeigen und Berechnungen nach dem Laden ausführen
            setTimeout(() => {
                updateHiddenDataSection();
                addCalculationEventListeners();
                calculateAllFields();
                
                // Unterschrift-Felder neu initialisieren
                initializeAllSignatureFields();
            }, 100);
            
            showStatus('Daten erfolgreich geladen!');
        } catch (error) {
            showStatus('Fehler beim Laden der Daten: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

async function loadExampleData() {
    try {
        const response = await fetch('../testdaten/mustermann_max.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Versteckte Daten zurücksetzen
        window.hiddenData = {};
        
        // Versteckte Daten aus dem Datensatz laden
        if (data.hiddenData) {
            window.hiddenData = { ...data.hiddenData };
        }
        
        const formData = data.formData || data;
        
        // Sammle alle sichtbaren Feldnamen aus dem aktuellen Formular
        const visibleFieldNames = new Set();
        document.querySelectorAll('#dataForm input, #dataForm textarea, #dataForm select').forEach(element => {
            if (element.name || element.id) {
                visibleFieldNames.add(element.name || element.id);
            }
        });
        
        console.log('Sichtbare Felder:', Array.from(visibleFieldNames));
        
        // Nur Daten in hiddenData speichern, die NICHT in sichtbaren Feldern vorkommen
        Object.keys(formData).forEach(key => {
            if (!visibleFieldNames.has(key)) {
                window.hiddenData[key] = formData[key];
                console.log(`Feld ${key} als versteckt markiert`);
            } else {
                console.log(`Feld ${key} ist sichtbar - nicht in hiddenData`);
            }
        });
        
        // Formularfelder setzen (nur sichtbare Felder)
        for (const [key, value] of Object.entries(formData)) {
            // URL-Parameter haben Vorrang - überspringen wenn URL-Parameter vorhanden
            if (window.urlParamData && window.urlParamData.hasOwnProperty(key)) {
                console.log(`Feld ${key} wird durch URL-Parameter geschützt (Beispieldaten)`);
                continue;
            }
            
            // Reguläre Felder
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value === '1' || value === 'true' || value === true;
                } else if (element.type === 'radio') {
                    element.checked = element.value === value;
                } else if (element.classList.contains('signature-data')) {
                    // Unterschrift-Daten wiederherstellen
                    element.value = value;
                    restoreSignatureDisplay(key, value);
                } else {
                    element.value = value;
                }
                console.log(`Feld ${key} gesetzt mit Wert: ${value}`);
            } else {
                // Radio Button Gruppen
                const radioButtons = document.querySelectorAll(`input[type="radio"][name="${key}"]`);
                if (radioButtons.length > 0) {
                    radioButtons.forEach(radio => {
                        radio.checked = radio.value === value;
                    });
                    console.log(`Radio-Gruppe ${key} gesetzt mit Wert: ${value}`);
                }
            }
        }
        
        if (data.settings) {
            window.appSettings = { ...window.appSettings, ...data.settings };
            loadSettingsToForm();
        }
        
        // Sofort Berechnungen ausführen nach dem Setzen der Daten
        console.log('🧮 Führe Berechnungen direkt nach Beispieldaten-Laden aus...');
        if (typeof calculateAllFields === 'function') {
            calculateAllFields();
        }
        
        // Live-Vorschau sofort nach dem Setzen der Formulardaten aktualisieren
        if (window.livePreview && window.livePreview.isActive && typeof updateLivePreview === 'function') {
            updateLivePreview();
            console.log('✅ Live-Vorschau nach Beispieldaten-Laden aktualisiert');
        }
        
        // Versteckte Daten anzeigen und Berechnungen nach dem Laden ausführen
        setTimeout(() => {
            console.log('🧮 Starte zusätzliche Berechnungen nach Beispieldaten-Laden...');
            updateHiddenDataSection();
            addCalculationEventListeners();
            calculateAllFields();
            
            // Unterschrift-Felder neu initialisieren
            initializeAllSignatureFields();
            
            // Live-Vorschau NACH den Berechnungen nochmals aktualisieren
            if (window.livePreview && window.livePreview.isActive && typeof updateLivePreview === 'function') {
                setTimeout(() => {
                    updateLivePreview();
                    console.log('✅ Live-Vorschau nach Berechnungen nochmals aktualisiert');
                }, 50);
            }
        }, 100);
        
        showStatus('📋 Beispieldaten (Max Mustermann) erfolgreich geladen!');
    } catch (error) {
        console.error('Fehler beim Laden der Beispieldaten:', error);
        showStatus('❌ Fehler beim Laden der Beispieldaten: ' + error.message, 'error');
    }
}

function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramsDiv = document.getElementById('urlParams');
    const paramsContent = document.getElementById('urlParamsContent');
    
    let hasParams = false;
    let content = '<ul>';
    
    for (const [key, value] of urlParams) {
        // In urlParamData speichern für Vorrang bei loadData
        window.urlParamData[key] = value;
        
        // In hiddenData speichern, falls Feld nicht existiert
        window.hiddenData[key] = value;
        
        content += `<li><strong>${key}:</strong> ${value}</li>`;
        hasParams = true;
    }
    
    if (hasParams) {
        content += '</ul>';
        paramsContent.innerHTML = content;
        paramsDiv.style.display = 'block';
    }
}

function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    for (const [key, value] of urlParams) {
        // Versuche Element zu finden - zuerst über ID, dann über name/label
        let element = document.getElementById(key);
        
        if (!element) {
            // Suche nach Element mit name-Attribut
            element = document.querySelector(`[name="${key}"]`);
        }
        
        if (!element) {
            // Suche nach Element dessen Label-Text dem key entspricht
            const labels = document.querySelectorAll('#dataForm label');
            for (const label of labels) {
                if (label.textContent.trim() === key) {
                    const forAttr = label.getAttribute('for');
                    if (forAttr) {
                        element = document.getElementById(forAttr);
                        break;
                    }
                }
            }
        }
        
        if (element) {
            if (element.type === 'radio') {
                // Bei Radio Buttons das richtige Element mit dem Wert finden
                const radioGroup = document.querySelectorAll(`input[name="${element.name}"]`);
                for (const radio of radioGroup) {
                    if (radio.value === value) {
                        radio.checked = true;
                        break;
                    }
                }
            } else if (element.type === 'checkbox') {
                element.checked = (value === '1' || value === 'true' || value === true);
            } else {
                element.value = value;
            }
        }
    }
    
    const today = new Date().toISOString().split('T')[0];
    ['Datum', 'DatumDate2'].forEach(fieldName => {
        const element = document.getElementById(fieldName);
        if (element && !element.value) {
            element.value = today;
        }
    });
    
    // Berechnungen nach dem Setzen der URL-Parameter ausführen
    setTimeout(() => {
        calculateAllFields();
    }, 500);
}

function getFieldDisplayName(elementId) {
    // Finde das zugehörige Label
    const label = document.querySelector(`label[for="${elementId}"]`);
    if (label) {
        // Entferne Berechnungs-Badge und andere HTML-Elemente
        let labelText = label.textContent.trim();
        labelText = labelText.replace(/\s*🧮\s*$/, ''); // Entferne Berechnungs-Badge
        return labelText;
    }
    return elementId; // Fallback zur Element-ID
}

function generateUrlWithData() {
    const url = new URL(window.location.href);
    
    // Aktuelle URL-Parameter löschen
    url.search = '';
    
    // Nur explizit gesetzte Werte sammeln
    const activeValues = {};
    
    // Text-Inputs, Textareas, Selects
    document.querySelectorAll('#dataForm input[type="text"], #dataForm input[type="email"], #dataForm input[type="date"], #dataForm input[type="number"], #dataForm textarea, #dataForm select').forEach(element => {
        const value = element.value;
        const elementId = element.name || element.id;
        const displayName = getFieldDisplayName(elementId);
        
        // Ausschließen: leere Werte, Unterschriften, Default-Werte von Dropdowns
        if (value && value.trim() !== '' && 
            value !== 'null' &&
            !value.toLowerCase().includes('bitte wählen') &&
            !value.toLowerCase().includes('please select') &&
            !displayName.toLowerCase().includes('unterschrift') && 
            !displayName.toLowerCase().includes('signature') &&
            !value.startsWith('data:image/')) {
            activeValues[displayName] = value;
        }
    });
    
    // Checkboxes - nur wenn checked
    document.querySelectorAll('#dataForm input[type="checkbox"]').forEach(element => {
        if (element.checked) {
            const elementId = element.name || element.id;
            const displayName = getFieldDisplayName(elementId);
            activeValues[displayName] = element.value || '1';
        }
    });
    
    // Radio buttons - nur wenn selected
    document.querySelectorAll('#dataForm input[type="radio"]:checked').forEach(element => {
        const elementId = element.name || element.id;
        const displayName = getFieldDisplayName(elementId);
        activeValues[displayName] = element.value;
    });
    
    // Parameter zur URL hinzufügen
    Object.entries(activeValues).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    
    const urlString = url.toString();
    
    // URL in Zwischenablage kopieren
    navigator.clipboard.writeText(urlString).then(() => {
        showNotification('🔗 URL mit Formulardaten wurde in die Zwischenablage kopiert!', 'success');
        
        // URL-Dialog mit bearbeitbaren Parametern anzeigen
        showUrlParameterDialog(activeValues);
    }).catch(err => {
        showNotification('❌ Fehler beim Kopieren der URL: ' + err.message, 'error');
        console.error('Fehler beim Kopieren:', err);
    });
}

function showUrlParameterDialog(activeValues) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    // Parameter-Liste erstellen
    let parameterList = '';
    Object.entries(activeValues).forEach(([key, value]) => {
        parameterList += `
            <div class="url-param-item" style="display: flex; align-items: center; margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                <strong style="min-width: 150px; margin-right: 10px;">${key}:</strong>
                <span style="flex: 1; margin-right: 10px;">${value}</span>
                <button onclick="removeUrlParameter('${key}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">❌ Entfernen</button>
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 90%; max-height: 90%; overflow-y: auto;">
            <h3>🔗 URL mit vorausgefüllten Daten</h3>
            <p>Diese Parameter werden in die URL aufgenommen. Sie können ungewünschte Parameter entfernen:</p>
            
            <div id="urlParameterList" style="margin: 20px 0; max-height: 300px; overflow-y: auto;">
                ${parameterList}
            </div>
            
            <h4>Generierte URL:</h4>
            <textarea id="generatedUrl" readonly style="width: 100%; height: 120px; margin: 10px 0; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
            
            <div style="text-align: right; margin-top: 20px;">
                <button onclick="copyUpdatedUrl()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; margin-right: 10px; cursor: pointer;">📋 URL kopieren</button>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Schließen</button>
            </div>
        </div>
    `;
    
    // Global verfügbare Funktionen für den Dialog
    window.currentUrlParams = { ...activeValues };
    
    window.removeUrlParameter = function(key) {
        delete window.currentUrlParams[key];
        updateUrlParameterDialog();
    };
    
    window.copyUpdatedUrl = function() {
        const textarea = document.getElementById('generatedUrl');
        navigator.clipboard.writeText(textarea.value).then(() => {
            showNotification('🔗 Aktualisierte URL wurde in die Zwischenablage kopiert!', 'success');
        }).catch(err => {
            showNotification('❌ Fehler beim Kopieren der URL: ' + err.message, 'error');
        });
    };
    
    window.updateUrlParameterDialog = function() {
        const url = new URL(window.location.href);
        url.search = '';
        
        // Parameter zur URL hinzufügen
        Object.entries(window.currentUrlParams).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
        
        // URL-Textfeld aktualisieren
        document.getElementById('generatedUrl').value = url.toString();
        
        // Parameter-Liste aktualisieren
        let parameterList = '';
        Object.entries(window.currentUrlParams).forEach(([key, value]) => {
            parameterList += `
                <div class="url-param-item" style="display: flex; align-items: center; margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                    <strong style="min-width: 150px; margin-right: 10px;">${key}:</strong>
                    <span style="flex: 1; margin-right: 10px;">${value}</span>
                    <button onclick="removeUrlParameter('${key}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">❌ Entfernen</button>
                </div>
            `;
        });
        
        if (Object.keys(window.currentUrlParams).length === 0) {
            parameterList = '<p style="text-align: center; color: #6c757d; font-style: italic;">Keine Parameter ausgewählt</p>';
        }
        
        document.getElementById('urlParameterList').innerHTML = parameterList;
    };
    
    document.body.appendChild(modal);
    
    // Initial URL generieren
    updateUrlParameterDialog();
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
            // Cleanup global functions
            delete window.currentUrlParams;
            delete window.removeUrlParameter;
            delete window.copyUpdatedUrl;
            delete window.updateUrlParameterDialog;
        }
    };
}

// Load settings data into form fields (called when loading saved data)
function loadSettingsToForm() {
    try {
        console.log('🔄 Lade Einstellungen in Formularfelder...');
        
        if (window.appSettings) {
            // Update settings form fields if they exist
            const fileNamePattern = document.getElementById('fileNamePattern');
            if (fileNamePattern && window.appSettings.fileNamePattern) {
                fileNamePattern.value = window.appSettings.fileNamePattern;
            }
            
            const emailAddress = document.getElementById('emailAddress');
            if (emailAddress && window.appSettings.emailAddress) {
                emailAddress.value = window.appSettings.emailAddress;
            }
            
            const emailSubject = document.getElementById('emailSubject');
            if (emailSubject && window.appSettings.emailSubject) {
                emailSubject.value = window.appSettings.emailSubject;
            }
            
            const emailBody = document.getElementById('emailBody');
            if (emailBody && window.appSettings.emailBody) {
                emailBody.value = window.appSettings.emailBody;
            }
            
            console.log('✅ Einstellungen in Formular geladen');
        }
    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen in Formular:', error);
    }
}