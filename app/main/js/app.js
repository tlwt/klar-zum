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
        handleUrlParams();
        
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