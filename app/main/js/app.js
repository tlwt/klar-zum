// js/app.js
// Hauptanwendung und Initialisierung

window.addEventListener('load', async function() {
    await initializeApp();
});

async function initializeApp() {
    try {
        console.log('🚀 App-Initialisierung gestartet...');
        
        await loadPDFsFromDirectory();
        generatePDFSelection();
        parseUrlParams(); // URL-Parameter früh parsen und anzeigen
        
        console.log('✅ App erfolgreich initialisiert');
        showMainApp();
    } catch (error) {
        console.error('❌ Fehler beim Initialisieren:', error);
        showError();
    }
}

async function generatePDFs(flatten = true) {
    console.log('\n🎯 === GENERATE PDFs GESTARTET ===');
    console.log('🔧 Flatten Mode:', flatten);
    console.log('📊 selectedPDFs size:', window.selectedPDFs?.size || 0);
    console.log('📊 availablePDFs length:', window.availablePDFs?.length || 0);
    
    const data = getAllFormData();
    const selectedPDFList = [];
    
    console.log('📋 window.selectedPDFs:', Array.from(window.selectedPDFs || []));
    console.log('📚 window.availablePDFs:', window.availablePDFs?.map(p => p.name) || []);
    
    for (const pdfName of window.selectedPDFs) {
        console.log(`🔍 Suche PDF: ${pdfName}`);
        let pdf = window.availablePDFs.find(p => p.name === pdfName);
        
        if (pdf) {
            selectedPDFList.push(pdf);
            console.log(`✅ PDF gefunden und hinzugefügt: ${pdfName}`);
        } else {
            console.warn(`⚠️ PDF nicht in availablePDFs gefunden: ${pdfName}`);
            console.log(`🔄 Versuche PDF dynamisch zu laden...`);
            
            // Versuche das PDF dynamisch zu laden
            try {
                const response = await fetch(`../formulare/${encodeURIComponent(pdfName)}`);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                    const fields = await extractFieldsFromPDF(pdfDoc, pdfName);
                    
                    // Lade Konfiguration
                    await loadPDFConfigForFile(pdfName);
                    
                    pdf = {
                        name: pdfName,
                        path: `../formulare/${pdfName}`,
                        document: pdfDoc,
                        fields: fields,
                        hasConfig: window.pdfConfigs.has(pdfName),
                        description: '',
                        category: 'Dynamisch geladen'
                    };
                    
                    // Füge zu availablePDFs hinzu für zukünftige Verwendung
                    window.availablePDFs.push(pdf);
                    selectedPDFList.push(pdf);
                    console.log(`✅ PDF dynamisch geladen und hinzugefügt: ${pdfName}`);
                } else {
                    console.error(`❌ PDF konnte nicht geladen werden: ${pdfName} (Status: ${response.status})`);
                }
            } catch (dynamicLoadError) {
                console.error(`❌ Fehler beim dynamischen Laden von ${pdfName}:`, dynamicLoadError);
            }
        }
    }
    
    console.log(`📊 Finale selectedPDFList (${selectedPDFList.length}):`, selectedPDFList.map(p => p.name));
    
    if (selectedPDFList.length === 0) {
        console.error('❌ Keine PDFs in selectedPDFList!');
        showStatus('Bitte wählen Sie mindestens ein PDF-Formular aus.', 'error');
        return;
    }
    
    try {
        const modeText = flatten ? 'geflacht (nicht bearbeitbar)' : 'bearbeitbar';
        showStatus(`Generiere ${selectedPDFList.length} PDF(s) als ${modeText}...`, 'info');
        
        let successCount = 0;
        let failedPDFs = [];
        const downloadPromises = [];
        
        // Generiere alle PDFs parallel und sammle Download-Promises
        for (const pdf of selectedPDFList) {
            try {
                console.log(`🔄 Starte Generierung für: ${pdf.name}`);
                const downloadPromise = fillAndDownloadPDF(pdf, data, flatten);
                downloadPromises.push(downloadPromise.then(() => {
                    successCount++;
                    console.log(`✅ PDF erfolgreich generiert: ${pdf.name}`);
                    return pdf.name;
                }).catch(pdfError => {
                    console.error(`❌ Fehler bei PDF ${pdf.name}:`, pdfError);
                    failedPDFs.push(pdf.name);
                    throw pdfError;
                }));
            } catch (pdfError) {
                console.error(`❌ Fehler bei PDF ${pdf.name}:`, pdfError);
                failedPDFs.push(pdf.name);
            }
        }
        
        // Warte auf alle PDF-Generierungen
        console.log(`🚀 Starte ${downloadPromises.length} PDF-Downloads parallel...`);
        await Promise.allSettled(downloadPromises);
        
        saveData();
        
        if (successCount === selectedPDFList.length) {
            showStatus(`${successCount} PDF(s) erfolgreich als ${modeText} generiert und Daten gespeichert!`, 'success');
        } else if (successCount > 0) {
            showStatus(`${successCount} von ${selectedPDFList.length} PDF(s) erfolgreich generiert. Fehler bei: ${failedPDFs.join(', ')}`, 'warning');
        } else {
            showStatus(`Alle PDF-Generierungen fehlgeschlagen: ${failedPDFs.join(', ')}`, 'error');
        }
        
    } catch (error) {
        showStatus('Fehler bei der PDF-Generierung: ' + error.message, 'error');
    }
}

async function generatePDFsAsZip(flatten = true) {
    console.log('\n📦 === GENERATE PDFs AS ZIP GESTARTET ===');
    console.log('🔧 Flatten Mode:', flatten);
    console.log('📊 selectedPDFs size:', window.selectedPDFs?.size || 0);
    
    const data = getAllFormData();
    const selectedPDFList = [];
    
    // Sammle PDFs (gleiche Logik wie generatePDFs)
    for (const pdfName of window.selectedPDFs) {
        console.log(`🔍 Suche PDF: ${pdfName}`);
        let pdf = window.availablePDFs.find(p => p.name === pdfName);
        
        if (pdf) {
            selectedPDFList.push(pdf);
            console.log(`✅ PDF gefunden und hinzugefügt: ${pdfName}`);
        } else {
            console.warn(`⚠️ PDF nicht in availablePDFs gefunden: ${pdfName}`);
            console.log(`🔄 Versuche PDF dynamisch zu laden...`);
            
            try {
                const response = await fetch(`../formulare/${encodeURIComponent(pdfName)}`);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                    const fields = await extractFieldsFromPDF(pdfDoc, pdfName);
                    
                    await loadPDFConfigForFile(pdfName);
                    
                    pdf = {
                        name: pdfName,
                        path: `../formulare/${pdfName}`,
                        document: pdfDoc,
                        fields: fields,
                        hasConfig: window.pdfConfigs.has(pdfName),
                    };
                    
                    selectedPDFList.push(pdf);
                    console.log(`✅ PDF dynamisch geladen und hinzugefügt: ${pdfName}`);
                } else {
                    console.error(`❌ PDF konnte nicht geladen werden: ${pdfName} (Status: ${response.status})`);
                }
            } catch (dynamicLoadError) {
                console.error(`❌ Fehler beim dynamischen Laden von ${pdfName}:`, dynamicLoadError);
            }
        }
    }
    
    if (selectedPDFList.length === 0) {
        console.error('❌ Keine PDFs in selectedPDFList!');
        showStatus('Bitte wählen Sie mindestens ein PDF-Formular aus.', 'error');
        return;
    }
    
    try {
        const modeText = flatten ? 'geflacht (nicht bearbeitbar)' : 'bearbeitbar';
        showStatus(`Generiere ${selectedPDFList.length} PDF(s) als ZIP (${modeText})...`, 'info');
        
        const zip = new JSZip();
        let successCount = 0;
        let failedPDFs = [];
        
        // Generiere alle PDFs und füge sie zur ZIP hinzu (strukturiert in 3 Ordnern)
        for (const pdf of selectedPDFList) {
            try {
                console.log(`🔄 Starte Generierung für ZIP: ${pdf.name}`);
                
                // Generiere konfigurierten Dateinamen (ohne Modus-Suffix)
                let configuredFileName = generateFileName(pdf.name, data, false); // Basis-Name
                // Entferne _bearbeitbar und _flach Suffixe für saubere ZIP-Namen
                configuredFileName = configuredFileName.replace(/_bearbeitbar\.pdf$/i, '.pdf').replace(/_flach\.pdf$/i, '.pdf');
                
                // 1. Bearbeitbares PDF-Formular
                const editablePdfBlob = await fillPDFForZip(pdf, data, false);
                zip.file(`PDF-Formulare/${configuredFileName}`, editablePdfBlob);
                console.log(`✅ Bearbeitbares PDF zu ZIP hinzugefügt: PDF-Formulare/${configuredFileName}`);
                
                // 2. Finalisiertes PDF (geflacht)
                const finalPdfBlob = await fillPDFForZip(pdf, data, true);
                zip.file(`PDFs/${configuredFileName}`, finalPdfBlob);
                console.log(`✅ Finalisiertes PDF zu ZIP hinzugefügt: PDFs/${configuredFileName}`);
                
                successCount++;
                
            } catch (pdfError) {
                console.error(`❌ Fehler bei PDF ${pdf.name}:`, pdfError);
                failedPDFs.push(pdf.name);
            }
        }
        
        // Füge JSON-Daten hinzu (mit konfiguriertem Namen)
        console.log('📋 Füge JSON-Daten zur ZIP hinzu...');
        try {
            const jsonData = {
                formData: data,
                settings: window.appSettings || {},
                timestamp: new Date().toISOString(),
                selectedPDFs: Array.from(window.selectedPDFs),
                mode: flatten ? 'flat' : 'editable',
                fileNamePattern: window.appSettings?.fileNamePattern || '[PDF]_[Datum]'
            };
            
            const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
            
            // JSON-Dateiname: [Nachname], [Vorname] - [Datum].json
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            
            const nachname = data.Nachname || '';
            const vorname = data.Vorname || '';
            
            let jsonFileName;
            if (nachname && vorname) {
                jsonFileName = `${nachname}, ${vorname} - ${dateStr}.json`;
            } else if (nachname) {
                jsonFileName = `${nachname} - ${dateStr}.json`;
            } else if (vorname) {
                jsonFileName = `${vorname} - ${dateStr}.json`;
            } else {
                jsonFileName = `formdata_${dateStr}.json`;
            }
                
            zip.file(`Formulardaten/${jsonFileName}`, jsonBlob);
            console.log(`✅ JSON-Daten zu ZIP hinzugefügt: Formulardaten/${jsonFileName}`);
        } catch (jsonError) {
            console.warn('⚠️ Fehler beim Hinzufügen der JSON-Daten:', jsonError);
        }
        
        if (successCount === 0) {
            showStatus('Fehler: Keine PDFs konnten generiert werden.', 'error');
            return;
        }
        
        // ZIP generieren und downloaden
        console.log('📦 Generiere ZIP-Datei...');
        const zipBlob = await zip.generateAsync({type: 'blob'});
        
        // ZIP-Dateiname erstellen: [Nachname], [Vorname] - [Datum].zip
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        const nachname = data.Nachname || '';
        const vorname = data.Vorname || '';
        
        let zipFileName;
        if (nachname && vorname) {
            zipFileName = `${nachname}, ${vorname} - ${dateStr}.zip`;
        } else if (nachname) {
            zipFileName = `${nachname} - ${dateStr}.zip`;
        } else if (vorname) {
            zipFileName = `${vorname} - ${dateStr}.zip`;
        } else {
            zipFileName = `Daten_${dateStr}.zip`;
        }
        
        // ZIP downloaden
        saveAs(zipBlob, zipFileName);
        
        if (successCount === selectedPDFList.length) {
            showStatus(`${successCount} PDF(s) erfolgreich als ZIP generiert!`, 'success');
        } else {
            showStatus(`${successCount} von ${selectedPDFList.length} PDF(s) erfolgreich generiert. Fehler bei: ${failedPDFs.join(', ')}`, 'warning');
        }
        
    } catch (error) {
        console.error('Fehler beim Generieren der ZIP:', error);
        showStatus('Fehler beim Generieren der ZIP: ' + error.message, 'error');
    }
    
    console.log('📦 === GENERATE PDFs AS ZIP BEENDET ===\n');
}