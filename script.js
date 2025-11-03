// DOM Elements
const elements = {
    uploadZone: document.getElementById('uploadZone'),
    audioUploadZone: document.getElementById('audioUploadZone'),
    fileInput: document.getElementById('fileInput'),
    audioFileInput: document.getElementById('audioFileInput'),
    visionSnapBtn: document.getElementById('visionSnapBtn'),
    previewContainer: document.getElementById('previewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    newUploadBtn: document.getElementById('newUploadBtn'),
    processingState: document.getElementById('processingState'),
    resultDisplay: document.getElementById('resultDisplay'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    resultText: document.getElementById('resultText'),
    copyBtn: document.getElementById('copyBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    toast: document.getElementById('toast'),
    imageResultDisplay: document.getElementById('imageResultDisplay'),
    imageResultContent: document.getElementById('imageResultContent'),
    modal: document.getElementById('imageModal'),
    modalImg: document.getElementById('modalImage'),
    closeBtn: document.querySelector('.close')
};

// Global variables
let currentFile = null;

// FIXED: PDF.js worker configuration
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

// Event Listeners
elements.visionSnapBtn.addEventListener('click', () => {
    window.open('https://teachable-machine-two.vercel.app/', '_blank');
});

elements.fileInput.addEventListener('change', handleFileSelect);
elements.audioFileInput.addEventListener('change', handleAudioFileSelect);

// Upload zone events
['dragover', 'dragleave', 'drop'].forEach(event => {
    [elements.uploadZone, elements.audioUploadZone].forEach(zone => {
        zone.addEventListener(event, handleDragEvent);
    });
});

elements.newUploadBtn.addEventListener('click', resetApp);
elements.copyBtn.addEventListener('click', copyText);
elements.downloadBtn.addEventListener('click', downloadText);
elements.closeBtn.onclick = () => elements.modal.style.display = 'none';
elements.modal.onclick = (e) => { 
    if (e.target === elements.modal) elements.modal.style.display = 'none'; 
};

// Main Functions
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    currentFile = file;
    resetUI();
    elements.imageResultContent.innerHTML = '';
    elements.imageResultDisplay.style.display = 'none';
    
    elements.previewContainer.style.display = 'grid';
    elements.processingState.style.display = 'flex';

    const fileType = file.type;
    const handlers = {
        'image/': handleImageFile,
        'application/pdf': handlePDFFile,
        'text/plain': handleTextFile,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': handleDOCXFile
    };

    const handlerKey = Object.keys(handlers).find(key => fileType.startsWith(key));
    if (handlerKey) {
        await handlers[handlerKey](file);
    } else {
        elements.processingState.style.display = 'none';
        showToast('Unsupported file type', 'error');
    }
}

async function handleAudioFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    resetUI();
    elements.previewContainer.style.display = 'grid';
    elements.processingState.style.display = 'flex';

    if (file.type.startsWith('audio/')) {
        await handleAudioFile(file);
    } else {
        showToast('Unsupported audio file type', 'error');
    }
}

// Drag event handler
function handleDragEvent(e) {
    e.preventDefault();
    const isUploadZone = e.currentTarget === elements.uploadZone;
    
    switch (e.type) {
        case 'dragover':
            e.currentTarget.style.borderColor = 'hsl(var(--primary))';
            e.currentTarget.style.background = 'hsl(var(--primary) / 0.05)';
            break;
        case 'dragleave':
        case 'drop':
            e.currentTarget.style.borderColor = 'hsl(var(--border) / 0.6)';
            e.currentTarget.style.background = 'hsl(var(--card) / 0.6)';
            if (e.type === 'drop' && e.dataTransfer.files.length) {
                const handler = isUploadZone ? handleFileSelect : handleAudioFileSelect;
                handler({ target: { files: e.dataTransfer.files } });
            }
            break;
    }
}

// Audio Processing
async function handleAudioFile(file) {
    showAudioPreview(file);
    setTimeout(() => {
        elements.processingState.style.display = 'none';
        showResult('Audio processing would be implemented here. Currently supports file upload only.', 'Audio file uploaded successfully!');
    }, 2000);
}

// Image Processing
async function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageDataUrl = e.target.result;
        showImagePreview(imageDataUrl, 'Image', 'fas fa-image');
        
        // Add the uploaded image to extracted images
        addExtractedImage(imageDataUrl, file.name.split('.')[0]);
        
        try {
            const img = new Image();
            img.onload = async () => {
                elements.processingState.style.display = 'flex';
                elements.progressText.textContent = '0% - Processing image for OCR...';

                let bestResult = '';
                let bestConfidence = 0;

                // Try multiple OCR methods
                const methods = [
                    { 
                        name: 'AUTO', 
                        psm: Tesseract.PSM.AUTO, 
                        config: { 
                            preserve_interword_spaces: '1'
                        } 
                    }
                ];

                for (let method of methods) {
                    try {
                        updateProgress({ status: `Processing image...` });
                        
                        const canvas = createCanvasFromImage(img);
                        const processedCanvas = enhanceImageForOCR(canvas);
                        
                        const { data: { text, confidence } } = await Tesseract.recognize(processedCanvas, 'eng', {
                            logger: m => updateProgress(m),
                            tessedit_pageseg_mode: method.psm,
                            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
                            ...method.config
                        });

                        if (confidence > bestConfidence && text.trim().length > 0) {
                            bestResult = text;
                            bestConfidence = confidence;
                        }
                    } catch (err) {
                        console.log(`OCR method failed:`, err);
                    }
                }

                // Fallback if no good result
                if (!bestResult) {
                    const canvas = createCanvasFromImage(img);
                    const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
                        logger: m => updateProgress(m)
                    });
                    bestResult = text;
                }

                const cleanedText = cleanOCRTextWithFormatting(bestResult);
                showResult(cleanedText, `Text extracted from image`);
            };
            img.src = imageDataUrl;
        } catch (err) {
            console.error('OCR Error:', err);
            showError('Failed to extract text from image');
        }
    };
    reader.readAsDataURL(file);
}

// FIXED: PDF Processing with better error handling
async function handlePDFFile(file) {
    console.log('Starting PDF processing...');
    
    // Check if PDF.js is available
    if (typeof pdfjsLib === 'undefined') {
        showError('PDF.js library not loaded. Please refresh the page.');
        return;
    }

    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
        try {
            console.log('PDF file read successfully, size:', this.result.byteLength);
            const typedArray = new Uint8Array(this.result);
            showPDFPreview(file);
            
            // Process PDF
            await processPDFFile(typedArray, file.name);
            
        } catch (err) {
            console.error('PDF processing error:', err);
            showError('Failed to process PDF file: ' + err.message);
        }
    };
    
    fileReader.onerror = function() {
        console.error('FileReader error:', fileReader.error);
        showError('Failed to read PDF file');
    };
    
    fileReader.readAsArrayBuffer(file);
}

// NEW: Separate PDF processing function
async function processPDFFile(typedArray, filename) {
    try {
        console.log('Loading PDF document...');
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(typedArray);
        const pdf = await loadingTask.promise;
        
        console.log('PDF loaded successfully, pages:', pdf.numPages);
        
        // Extract content and text in sequence to avoid overload
        await extractContentFromPDFPages(pdf, filename);
        await extractTextFromPDF(pdf);
        
    } catch (err) {
        console.error('PDF processing error:', err);
        
        if (err.name === 'InvalidPDFException') {
            showError('Invalid PDF file. The file may be corrupted.');
        } else if (err.name === 'PasswordException') {
            showError('PDF is password protected. Please remove the password and try again.');
        } else {
            showError('Failed to process PDF: ' + err.message);
        }
    }
}

// UPDATED: PDF Content Extraction
async function extractContentFromPDFPages(pdf, filename) {
    try {
        let totalRegions = 0;
        const totalPages = pdf.numPages;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            try {
                console.log(`Processing page ${pageNum} of ${totalPages}`);
                updateProgress({ 
                    progress: (pageNum / totalPages) * 100, 
                    status: `Processing page ${pageNum} of ${totalPages}` 
                });

                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 }); // Reduced scale for performance
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;

                // Extract content regions
                const contentRegions = detectContentBlocks(canvas);
                contentRegions.forEach((region, index) => {
                    if (region.width > 50 && region.height > 50) {
                        const regionCanvas = document.createElement('canvas');
                        const regionCtx = regionCanvas.getContext('2d');
                        regionCanvas.width = region.width;
                        regionCanvas.height = region.height;
                        
                        regionCtx.drawImage(
                            canvas, 
                            region.x, region.y, region.width, region.height,
                            0, 0, region.width, region.height
                        );
                        
                        addExtractedImage(regionCanvas.toDataURL('image/png'), `${filename}-page${pageNum}-region${index + 1}`);
                        totalRegions++;
                    }
                });

            } catch (pageErr) {
                console.error(`Error processing page ${pageNum}:`, pageErr);
                // Continue with next page even if one fails
            }
        }

        if (totalRegions > 0) {
            showToast(`Extracted ${totalRegions} content regions from PDF`, 'success');
        } else {
            showToast('No individual content regions found in PDF', 'info');
        }
    } catch (err) {
        console.error('PDF content extraction error:', err);
        throw err;
    }
}

// UPDATED: PDF Text Extraction
async function extractTextFromPDF(pdf) {
    try {
        let extractedText = '';
        const totalPages = pdf.numPages;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            try {
                updateProgress({ 
                    progress: (pageNum / totalPages) * 100, 
                    status: `Extracting text from page ${pageNum} of ${totalPages}` 
                });

                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                extractedText += reconstructTextWithExactFormatting(textContent.items);
                
            } catch (pageErr) {
                console.error(`Error extracting text from page ${pageNum}:`, pageErr);
                // Continue with next page even if one fails
            }
        }

        if (extractedText.trim().length > 10) {
            showResult(extractedText, `Extracted text from ${totalPages} page(s)`);
        } else {
            // Fallback to OCR
            showToast('Using OCR for text extraction...', 'info');
            await performOCROnPDF(pdf);
        }
    } catch (err) {
        console.error('PDF text extraction error:', err);
        throw err;
    }
}

// NEW: OCR fallback for PDF
async function performOCROnPDF(pdf) {
    try {
        let ocrText = '';
        const totalPages = pdf.numPages;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            try {
                updateProgress({ 
                    progress: (pageNum / totalPages) * 100, 
                    status: `OCR processing page ${pageNum} of ${totalPages}` 
                });

                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 }); // Reduced scale for performance
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;

                const processedCanvas = enhanceImageForOCR(canvas);
                const { data: { text } } = await Tesseract.recognize(processedCanvas, 'eng', {
                    logger: m => updateProgress(m),
                    tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
                    preserve_interword_spaces: '1'
                });
                
                ocrText += cleanOCRTextWithFormatting(text) + '\n\n';
                
            } catch (pageErr) {
                console.error(`OCR failed for page ${pageNum}:`, pageErr);
            }
        }

        showResult(ocrText, 'Text extracted using OCR');
    } catch (err) {
        console.error('PDF OCR error:', err);
        showError('Failed to perform OCR on PDF');
    }
}

// DOCX Processing
async function handleDOCXFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        showPDFPreview(file, 'DOCX', 'fas fa-file-word');
        try {
            await extractImagesFromDOCX(file);
            const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
            showResult(cleanOCRTextWithFormatting(result.value), 'Text extracted from DOCX');
        } catch (err) {
            console.error('DOCX processing error:', err);
            showError('Failed to extract text from DOCX');
        }
    };
    reader.readAsArrayBuffer(file);
}

// DOCX Image Extraction
async function extractImagesFromDOCX(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const imagePromises = [];
        let imageIndex = 0;
        
        zip.forEach((relativePath, zipEntry) => {
            if (relativePath.startsWith('word/media/') && !zipEntry.dir) {
                const ext = relativePath.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
                    imageIndex++;
                    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
                    imagePromises.push(
                        zipEntry.async('base64').then(data => {
                            const dataUrl = `data:image/${mimeType};base64,${data}`;
                            addExtractedImage(dataUrl, `image-${imageIndex}`);
                            return dataUrl;
                        })
                    );
                }
            }
        });

        const images = await Promise.all(imagePromises);
        if (images.length > 0) {
            showToast(`Extracted ${images.length} embedded images from DOCX`, 'success');
        }
    } catch (err) {
        console.error('DOCX image extraction error:', err);
    }
}

// Text File Processing
async function handleTextFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        showPDFPreview(file, 'TXT', 'fas fa-file-alt');
        showResult(e.target.result, 'Text extracted from file');
        elements.processingState.style.display = 'none';
    };
    reader.readAsText(file);
}

// Content Detection Functions
function detectContentBlocks(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const blocks = [];
    const visited = new Set();
    
    for (let y = 0; y < height; y += 5) { // Increased step for performance
        for (let x = 0; x < width; x += 5) {
            const pos = `${x},${y}`;
            if (!visited.has(pos)) {
                const idx = (y * width + x) * 4;
                if (!isBackgroundColor(data[idx], data[idx+1], data[idx+2])) {
                    const block = floodFillBlock(imageData, x, y, visited);
                    if (block && block.area > 100) blocks.push(block);
                }
            }
        }
    }
    return blocks;
}

function floodFillBlock(imageData, startX, startY, visited) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const queue = [[startX, startY]];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let area = 0;
    
    while (queue.length > 0) {
        const [x, y] = queue.shift();
        const pos = `${x},${y}`;
        if (visited.has(pos) || x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const idx = (y * width + x) * 4;
        if (isBackgroundColor(data[idx], data[idx+1], data[idx+2])) continue;
        
        visited.add(pos);
        area++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        
        // 4-directional for better performance
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    if (area < 50) return null;
    const padding = 5;
    return {
        x: Math.max(0, minX - padding),
        y: Math.max(0, minY - padding),
        width: Math.min(width, maxX - minX + 2 * padding + 1),
        height: Math.min(height, maxY - minY + 2 * padding + 1),
        area: area
    };
}

function isBackgroundColor(r, g, b) {
    return r > 240 && g > 240 && b > 240;
}

// Text Processing Functions
function reconstructTextWithExactFormatting(textItems) {
    if (!textItems || textItems.length === 0) return '';
    
    const lines = {};
    textItems.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lines[y]) lines[y] = [];
        lines[y].push({ x: item.transform[4], text: item.str });
    });
    
    const sortedLines = Object.keys(lines).map(y => parseInt(y)).sort((a, b) => b - a);
    let result = '';
    
    sortedLines.forEach(y => {
        const lineItems = lines[y].sort((a, b) => a.x - b.x);
        let lineText = '';
        let lastX = -Infinity;
        
        lineItems.forEach(item => {
            const gap = item.x - lastX;
            if (lastX !== -Infinity && gap > 10) {
                lineText += gap > 20 ? '    ' : ' ';
            }
            lineText += item.text;
            lastX = item.x;
        });
        
        result += lineText + '\n';
    });
    
    return result + '\n';
}

function cleanOCRTextWithFormatting(text) {
    if (!text || text.trim().length === 0) return 'No text detected.';
    
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^(\s+)/gm, (match) => match.length >= 4 ? '    ' : match.length >= 2 ? '  ' : ' ')
        .replace(/([.!?])([A-Z])/g, '$1 $2')
        .replace(/([.,])([A-Za-z])/g, '$1 $2')
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/^\s*[-•*]\s+/gm, '• ')
        .replace(/^\s*\d+\.\s+/gm, match => match.trim() + ' ')
        .replace(/ {2,}/g, '  ')
        .trim();
}

// Image Extraction UI
function addExtractedImage(dataUrl, filename = 'image') {
    const wrapper = document.createElement('div');
    wrapper.className = 'extracted-image-card';
    wrapper.style.cssText = `
        position: relative; width: 160px; height: 180px; border: 2px solid hsl(var(--border));
        border-radius: 12px; overflow: hidden; background: hsl(var(--card)); display: flex;
        flex-direction: column; transition: all 0.3s ease; cursor: pointer;
    `;

    wrapper.onmouseenter = () => {
        wrapper.style.transform = 'translateY(-4px)';
        wrapper.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        wrapper.style.borderColor = 'hsl(var(--primary))';
    };
    
    wrapper.onmouseleave = () => {
        wrapper.style.transform = 'translateY(0)';
        wrapper.style.boxShadow = 'none';
        wrapper.style.borderColor = 'hsl(var(--border))';
    };

    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = `
        width: 100%; height: 120px; overflow: hidden; display: flex;
        align-items: center; justify-content: center;
        background: linear-gradient(135deg, hsl(var(--muted)), hsl(var(--secondary)));
    `;

    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = `
        max-width: 100%; max-height: 100%; object-fit: contain;
        transition: transform 0.3s ease;
    `;
    img.onload = () => console.log('Image loaded successfully:', filename);
    img.onerror = () => console.error('Failed to load image:', filename);
    img.onmouseenter = () => img.style.transform = 'scale(1.05)';
    img.onmouseleave = () => img.style.transform = 'scale(1)';
    img.addEventListener('click', () => viewImage(dataUrl));
    
    imgContainer.appendChild(img);

    const fileName = document.createElement('div');
    fileName.textContent = filename.length > 20 ? filename.substring(0, 18) + '...' : filename;
    fileName.style.cssText = `
        padding: 8px 4px; font-size: 0.75rem; color: hsl(var(--muted-foreground));
        text-align: center; border-top: 1px solid hsl(var(--border));
        background: hsl(var(--secondary)); font-weight: 500;
    `;

    const actions = document.createElement('div');
    actions.style.cssText = `
        display: flex; justify-content: space-around; padding: 6px 4px;
        background: hsl(var(--muted)); border-top: 1px solid hsl(var(--border));
    `;

    actions.appendChild(createImageActionButton('View', 'view', () => viewImage(dataUrl)));
    actions.appendChild(createImageActionButton('Save', 'download', () => downloadImage(dataUrl, filename)));
    
    wrapper.appendChild(imgContainer);
    wrapper.appendChild(fileName);
    wrapper.appendChild(actions);
    elements.imageResultContent.appendChild(wrapper);
    elements.imageResultDisplay.style.display = 'flex';
}

function createImageActionButton(text, type, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
        padding: 4px 8px; border: none; border-radius: 6px; cursor: pointer;
        font-size: 0.7rem; font-weight: 600; transition: all 0.2s ease; min-width: 50px;
    `;
    
    button.style.background = type === 'view' ? 'var(--gradient-primary)' : 'hsl(var(--accent))';
    button.style.color = 'white';
    
    button.onmouseenter = () => { button.style.transform = 'scale(1.05)'; button.style.opacity = '0.9'; };
    button.onmouseleave = () => { button.style.transform = 'scale(1)'; button.style.opacity = '1'; };
    button.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    
    return button;
}

// Utility Functions
function showImagePreview(src, fileType, iconClass) {
    elements.imagePreview.innerHTML = 
        `<div class="preview-image-container">
            <img src="${src}" class="preview-image">
            <div class="file-badge"><i class="${iconClass}"></i><span>${fileType}</span></div>
        </div>`;
}

function showAudioPreview(file) {
    elements.imagePreview.innerHTML = 
        `<div class="pdf-preview">
            <i class="fas fa-music"></i>
            <div>
                <div class="file-name">${file.name}</div>
                <div class="file-info">Audio File • ${(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <div class="file-badge"><i class="fas fa-music"></i><span>Audio</span></div>
        </div>`;
}

function showPDFPreview(file, fileType = 'PDF', iconClass = 'fas fa-file-pdf') {
    elements.imagePreview.innerHTML = 
        `<div class="pdf-preview">
            <i class="${iconClass}"></i>
            <div>
                <div class="file-name">${file.name}</div>
                <div class="file-info">${fileType} Document • ${(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <div class="file-badge"><i class="${iconClass}"></i><span>${fileType}</span></div>
        </div>`;
}

function createCanvasFromImage(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return canvas;
}

function enhanceImageForOCR(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
        data[i] = data[i + 1] = data[i + 2] = enhanced;
    }

    ctx.putImageData(imgData, 0, 0);
    ctx.filter = 'contrast(1.3) brightness(1.1)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    return canvas;
}

function viewImage(src) {
    elements.modal.style.display = 'block';
    elements.modalImg.src = src;
}

function downloadImage(src, filename) {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Image downloaded successfully!', 'success');
}

function updateProgress(m, currentPage = 1, totalPages = 1) {
    if (m.status === 'recognizing text' || m.status === 'extracting text') {
        const baseProgress = ((currentPage - 1) / totalPages) * 100;
        const pageProgress = (m.progress || 0) * (100 / totalPages);
        const progress = Math.round(baseProgress + pageProgress);
        elements.progressFill.style.width = `${progress}%`;
        elements.progressText.textContent = `${progress}% - ${m.status || 'Processing...'}`;
    } else if (m.status) {
        elements.progressText.textContent = `${Math.round((currentPage / totalPages) * 100)}% - ${m.status}`;
    }
}

function showResult(text, message = 'Text extracted successfully!') {
    elements.processingState.style.display = 'none';
    elements.resultDisplay.style.display = 'flex';
    elements.resultText.textContent = text && text.trim().length > 0 ? text : 'No text detected in the file.';
    if (text && text.trim().length > 10) showToast(message, 'success');
}

function showError(message) {
    elements.processingState.style.display = 'none';
    showToast(message, 'error');
}

function resetUI() {
    elements.previewContainer.style.display = 'none';
    elements.processingState.style.display = 'none';
    elements.resultDisplay.style.display = 'none';
    elements.imageResultDisplay.style.display = 'none';
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = '0%';
}

function resetApp() {
    elements.fileInput.value = '';
    elements.audioFileInput.value = '';
    elements.previewContainer.style.display = 'none';
    elements.processingState.style.display = 'none';
    elements.resultDisplay.style.display = 'none';
    elements.imageResultDisplay.style.display = 'none';
    elements.imageResultContent.innerHTML = '';
    currentFile = null;
    showToast('Ready for new upload', 'info');
}

function copyText() {
    const text = elements.resultText.textContent;
    if (text && text !== 'No text detected in the file.') {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Text copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy text', 'error'));
    } else {
        showToast('No text to copy', 'error');
    }
}

function downloadText() {
    const text = elements.resultText.textContent;
    if (text && text !== 'No text detected in the file.') {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `extracted-text-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Text file downloaded!', 'success');
    } else {
        showToast('No text to download', 'error');
    }
}

function showToast(message, type = 'default') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;
    setTimeout(() => elements.toast.classList.remove('show'), 4000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (elements.modal.style.display === 'block') {
            elements.modal.style.display = 'none';
        } else if (elements.previewContainer.style.display === 'grid') {
            resetApp();
        }
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    showToast('Upload a file to extract text and images', 'info');
});