// js/calculation-engine.js
// Berechnungslogik für Formularfelder - Erweitert mit Unterschrift-Unterstützung

function addCalculationEventListeners() {
    // Event-Listener für alle Input-Felder hinzufügen
    document.querySelectorAll('#dataForm input, #dataForm textarea, #dataForm select').forEach(input => {
        input.addEventListener('input', calculateAllFields);
        input.addEventListener('change', calculateAllFields);
    });
    
    // Spezielle Event-Listener für Unterschrift-Felder
    document.querySelectorAll('.signature-data').forEach(signatureInput => {
        signatureInput.addEventListener('change', () => {
            console.log(`Unterschrift-Feld ${signatureInput.id} geändert`);
            calculateAllFields();
        });
    });
}

function calculateAllFields() {
    console.log('📊 calculateAllFields() called');
    console.log('currentFieldCalculations:', window.currentFieldCalculations);
    
    if (!window.currentFieldCalculations || window.currentFieldCalculations.size === 0) {
        console.log('⚠️ No calculations found');
        return;
    }
    
    const formData = getAllFormData();
    console.log('📋 Form data for calculations:', formData);
    
    window.currentFieldCalculations.forEach((calculation, fieldName) => {
        console.log(`🔄 Processing calculation for field: ${fieldName}`);
        const calculatedValue = evaluateCalculation(calculation, formData);
        const element = document.getElementById(fieldName);
        console.log(`🔍 Looking for element with ID: ${fieldName}`, element ? 'FOUND' : 'NOT FOUND');
        
        if (element && calculatedValue !== null) {
            // Spezielle Behandlung für Unterschrift-Felder (diese sollten nicht überschrieben werden)
            if (!element.classList.contains('signature-data')) {
                console.log(`✅ Setting ${fieldName} = ${calculatedValue}`);
                element.value = calculatedValue;
            }
        } else {
            console.log(`❌ Cannot set ${fieldName}: element=${!!element}, value=${calculatedValue}`);
        }
    });
}

function evaluateCalculation(calculation, formData) {
    try {
        console.log('🧮 Evaluating calculation:', calculation);
        console.log('📊 Form data available:', Object.keys(formData));
        
        // Ersetze Feldnamen in der Berechnung durch ihre Werte
        let expression = calculation;
        
        // Finde alle Feldnamen in geschweiften Klammern
        const fieldMatches = expression.match(/{([^}]+)}/g);
        if (fieldMatches) {
            fieldMatches.forEach(match => {
                const fieldName = match.slice(1, -1); // Entferne { und }
                let fieldValue = '';
                
                console.log(`🔍 Looking for field: ${fieldName}`);
                
                // Vereinfachte Feldsuche: Zuerst direkt nach Element mit dieser ID suchen
                const formElement = document.getElementById(fieldName);
                if (formElement) {
                    fieldValue = formElement.value || '';
                    console.log(`✅ Found form element directly: ${fieldName} = "${fieldValue}"`);
                } else {
                    // Fallback: Im formData suchen (für Felder aus anderen Formularen)
                    if (formData[fieldName] !== undefined) {
                        fieldValue = formData[fieldName];
                        console.log(`✅ Found in formData (cross-form): ${fieldName} = "${fieldValue}"`);
                    } else {
                        console.log(`⚠️ Field ${fieldName} not found`);
                        console.log('Available form elements:', Array.from(document.querySelectorAll('#dataForm input, #dataForm select, #dataForm textarea')).map(el => el.id).filter(id => id));
                        console.log('Available formData keys:', Object.keys(formData));
                    }
                }
                
                // Spezielle Behandlung für Unterschrift-Felder
                if ((fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) && 
                    fieldValue && fieldValue.startsWith('data:image/')) {
                    fieldValue = '[Unterschrift vorhanden]';
                }
                
                const replacement = `"${fieldValue}"`;
                expression = expression.replace(match, replacement);
                console.log(`🔄 Replaced ${match} with ${replacement}`);
            });
        }
        
        // Spezielle Funktionen unterstützen
        if (expression.includes('CONCAT')) {
            // CONCAT({Vorname}, " ", {Nachname}) -> "Vorname" + " " + "Nachname"
            expression = expression.replace(/CONCAT\(/g, '').replace(/\)$/, '');
            expression = expression.replace(/,\s*/g, ' + ');
            console.log('🔗 CONCAT converted to:', expression);
        }
        
        console.log('✨ Final expression before evaluation:', expression);
        
        // Sichere Auswertung der Expression
        const result = evaluateExpression(expression);
        console.log('🎯 Calculation result:', result);
        return result;
        
    } catch (error) {
        console.warn('❌ Fehler bei Berechnung:', error);
        return null;
    }
}

function evaluateExpression(expression) {
    // Sichere Auswertung ohne eval()
    try {
        console.log('🧪 Evaluating expression:', expression);
        
        // String split operation: "value".split("separator")[index]
        let splitMatch = expression.match(/"([^"]+)"\.split\("([^"]+)"\)\[(\d+)\]/);
        if (splitMatch) {
            console.log('✂️ Found split pattern (quoted):', splitMatch);
            const value = splitMatch[1];
            const separator = splitMatch[2];
            const index = parseInt(splitMatch[3]);
            const parts = value.split(separator);
            console.log(`🔪 Splitting "${value}" by "${separator}" -> parts:`, parts, `index ${index} ->`, parts[index]);
            return parts[index] || '';
        }
        
        // Alternative: value.split("separator")[index] (ohne äußere Anführungszeichen)
        splitMatch = expression.match(/^([^.]+)\.split\("([^"]+)"\)\[(\d+)\]$/);
        if (splitMatch) {
            console.log('✂️ Found split pattern (unquoted):', splitMatch);
            const value = splitMatch[1];
            const separator = splitMatch[2];
            const index = parseInt(splitMatch[3]);
            const parts = value.split(separator);
            console.log(`🔪 Splitting "${value}" by "${separator}" -> parts:`, parts, `index ${index} ->`, parts[index]);
            return parts[index] || '';
        }
        
        // Einfache String-Konkatenation
        if (expression.includes('+')) {
            const parts = expression.split('+').map(part => part.trim());
            return parts.map(part => {
                if (part.startsWith('"') && part.endsWith('"')) {
                    return part.slice(1, -1);
                }
                return part;
            }).join('');
        }
        
        // Einzelner String-Wert
        if (expression.startsWith('"') && expression.endsWith('"')) {
            return expression.slice(1, -1);
        }
        
        return expression;
    } catch (error) {
        console.warn('Fehler bei Expression-Auswertung:', error);
        return '';
    }
}