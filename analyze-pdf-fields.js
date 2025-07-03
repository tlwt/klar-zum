const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function analyzePDFFields() {
    try {
        // Read the PDF file
        const pdfPath = './app/formulare/Bw5120 - Anlage zum Einverstaendnis.pdf';
        const pdfBytes = fs.readFileSync(pdfPath);
        
        // Load the PDF document
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Get the form from the PDF
        const form = pdfDoc.getForm();
        
        // Get all field names
        const fieldNames = form.getFieldNames();
        
        console.log('=== PDF FORM ANALYSIS ===');
        console.log(`Total fields found: ${fieldNames.length}`);
        console.log('\n=== ALL FIELD NAMES ===');
        fieldNames.forEach((name, index) => {
            console.log(`${index + 1}. ${name}`);
        });
        
        console.log('\n=== DETAILED FIELD ANALYSIS ===');
        
        // Analyze each field in detail
        fieldNames.forEach((fieldName) => {
            try {
                const field = form.getField(fieldName);
                
                console.log(`\n--- Field: ${fieldName} ---`);
                console.log(`Type: ${field.constructor.name}`);
                
                // Check if it's a radio button group
                if (field.constructor.name === 'PDFRadioGroup') {
                    const options = field.getOptions();
                    console.log(`Radio Group Options: ${JSON.stringify(options)}`);
                    
                    // Check if this might be related to earnings/income
                    if (fieldName.toLowerCase().includes('verdienst') || 
                        fieldName.toLowerCase().includes('einkommen') || 
                        fieldName.toLowerCase().includes('gehalt') ||
                        fieldName.toLowerCase().includes('lohn') ||
                        fieldName.toLowerCase().includes('income') ||
                        fieldName.toLowerCase().includes('earning')) {
                        console.log(`*** POTENTIAL EARNINGS FIELD FOUND ***`);
                    }
                }
                
                // Check if it's a checkbox
                if (field.constructor.name === 'PDFCheckBox') {
                    console.log(`Checkbox field`);
                    
                    // Check if this might be related to earnings/income
                    if (fieldName.toLowerCase().includes('verdienst') || 
                        fieldName.toLowerCase().includes('einkommen') || 
                        fieldName.toLowerCase().includes('gehalt') ||
                        fieldName.toLowerCase().includes('lohn') ||
                        fieldName.toLowerCase().includes('income') ||
                        fieldName.toLowerCase().includes('earning')) {
                        console.log(`*** POTENTIAL EARNINGS CHECKBOX FOUND ***`);
                    }
                }
                
                // Check if it's a dropdown
                if (field.constructor.name === 'PDFDropdown') {
                    const options = field.getOptions();
                    console.log(`Dropdown Options: ${JSON.stringify(options)}`);
                    
                    // Check if this might be related to earnings/income
                    if (fieldName.toLowerCase().includes('verdienst') || 
                        fieldName.toLowerCase().includes('einkommen') || 
                        fieldName.toLowerCase().includes('gehalt') ||
                        fieldName.toLowerCase().includes('lohn') ||
                        fieldName.toLowerCase().includes('income') ||
                        fieldName.toLowerCase().includes('earning')) {
                        console.log(`*** POTENTIAL EARNINGS DROPDOWN FOUND ***`);
                    }
                }
                
                // Check if it's a text field
                if (field.constructor.name === 'PDFTextField') {
                    console.log(`Text field`);
                    
                    // Check if this might be related to earnings/income
                    if (fieldName.toLowerCase().includes('verdienst') || 
                        fieldName.toLowerCase().includes('einkommen') || 
                        fieldName.toLowerCase().includes('gehalt') ||
                        fieldName.toLowerCase().includes('lohn') ||
                        fieldName.toLowerCase().includes('income') ||
                        fieldName.toLowerCase().includes('earning')) {
                        console.log(`*** POTENTIAL EARNINGS TEXT FIELD FOUND ***`);
                    }
                }
                
            } catch (error) {
                console.log(`Error analyzing field ${fieldName}: ${error.message}`);
            }
        });
        
        console.log('\n=== EARNINGS/INCOME RELATED FIELDS ===');
        const earningsFields = fieldNames.filter(name => 
            name.toLowerCase().includes('verdienst') || 
            name.toLowerCase().includes('einkommen') || 
            name.toLowerCase().includes('gehalt') ||
            name.toLowerCase().includes('lohn') ||
            name.toLowerCase().includes('income') ||
            name.toLowerCase().includes('earning') ||
            name.toLowerCase().includes('brutto') ||
            name.toLowerCase().includes('netto')
        );
        
        if (earningsFields.length > 0) {
            console.log('Found potential earnings-related fields:');
            earningsFields.forEach(fieldName => {
                console.log(`- ${fieldName}`);
                try {
                    const field = form.getField(fieldName);
                    if (field.constructor.name === 'PDFRadioGroup') {
                        const options = field.getOptions();
                        console.log(`  Radio options: ${JSON.stringify(options)}`);
                    }
                    if (field.constructor.name === 'PDFDropdown') {
                        const options = field.getOptions();
                        console.log(`  Dropdown options: ${JSON.stringify(options)}`);
                    }
                } catch (error) {
                    console.log(`  Error: ${error.message}`);
                }
            });
        } else {
            console.log('No obvious earnings-related fields found by name matching.');
            console.log('All fields will be analyzed for potential earnings options...');
        }
        
        // Look for fields that might contain earnings options by examining their values
        console.log('\n=== ANALYZING ALL RADIO/DROPDOWN FIELDS FOR EARNINGS OPTIONS ===');
        fieldNames.forEach(fieldName => {
            try {
                const field = form.getField(fieldName);
                
                if (field.constructor.name === 'PDFRadioGroup' || field.constructor.name === 'PDFDropdown') {
                    const options = field.getOptions();
                    const optionsStr = JSON.stringify(options).toLowerCase();
                    
                    // Check if options contain earnings-related terms
                    if (optionsStr.includes('verdienst') || 
                        optionsStr.includes('einkommen') || 
                        optionsStr.includes('gehalt') ||
                        optionsStr.includes('lohn') ||
                        optionsStr.includes('brutto') ||
                        optionsStr.includes('netto') ||
                        optionsStr.includes('euro') ||
                        optionsStr.includes('€')) {
                        console.log(`\n*** EARNINGS OPTIONS FOUND IN FIELD: ${fieldName} ***`);
                        console.log(`Type: ${field.constructor.name}`);
                        console.log(`Options: ${JSON.stringify(options)}`);
                    }
                }
            } catch (error) {
                // Skip fields that can't be analyzed
            }
        });
        
    } catch (error) {
        console.error('Error analyzing PDF:', error);
    }
}

// Run the analysis
analyzePDFFields();