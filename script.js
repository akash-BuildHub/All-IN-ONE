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
let extractedImages = [];
let currentFile = null;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Event Listeners
elements.visionSnapBtn.addEventListener('click', () => {
    window.open('https://teachable-machine-two.vercel.app/', '_blank');
});

elements.fileInput.addEventListener('change', handleFileSelect);
elements.audioFileInput.addEventListener('change', handleAudioFileSelect);

// Document/Image upload zone events
elements.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadZone.style.borderColor = 'hsl(var(--primary))';
    elements.uploadZone.style.background = 'hsl(var(--primary) / 0.05)';
});

elements.uploadZone.addEventListener('dragleave', () => {
    elements.uploadZone.style.borderColor = 'hsl(var(--border) / 0.6)';
    elements.uploadZone.style.background = 'hsl(var(--card) / 0.6)';
});

elements.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadZone.style.borderColor = 'hsl(var(--border) / 0.6)';
    elements.uploadZone.style.background = 'hsl(var(--card) / 0.6)';
    if (e.dataTransfer.files.length) {
        handleFileSelect({ target: { files: e.dataTransfer.files } });
    }
});

// Audio upload zone events
elements.audioUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.audioUploadZone.style.borderColor = 'hsl(var(--primary))';
    elements.audioUploadZone.style.background = 'hsl(var(--primary) / 0.05)';
});

elements.audioUploadZone.addEventListener('dragleave', () => {
    elements.audioUploadZone.style.borderColor = 'hsl(var(--border) / 0.6)';
    elements.audioUploadZone.style.background = 'hsl(var(--card) / 0.6)';
});

elements.audioUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.audioUploadZone.style.borderColor = 'hsl(var(--border) / 0.6)';
    elements.audioUploadZone.style.background = 'hsl(var(--card) / 0.6)';
    if (e.dataTransfer.files.length) {
        handleAudioFileSelect({ target: { files: e.dataTransfer.files } });
    }
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

    // Clear previous extracted images
    elements.imageResultContent.innerHTML = '';
    elements.imageResultDisplay.style.display = 'none';
    
    const fileType = file.type;

    // Show processing immediately
    elements.previewContainer.style.display = 'grid';
    elements.processingState.style.display = 'flex';

    if (fileType.startsWith('image/')) {
        await handleImageFile(file);
    } else if (fileType === 'application/pdf') {
        await handlePDFFile(file);
    } else if (fileType === 'text/plain') {
        await handleTextFile(file);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        await handleDOCXFile(file);
    } else {
        elements.processingState.style.display = 'none';
        showToast('Unsupported file type', 'error');
    }
}

// Audio file handler
async function handleAudioFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    resetUI();
    elements.previewContainer.style.display = 'grid';
    elements.processingState.style.display = 'flex';

    const fileType = file.type;

    if (fileType.startsWith('audio/')) {
        await handleAudioFile(file);
    } else {
        showToast('Unsupported audio file type', 'error');
    }
}

// Audio Processing Function
async function handleAudioFile(file) {
    showAudioPreview(file);
    
    // Simulate audio processing
    setTimeout(() => {
        elements.processingState.style.display = 'none';
        showResult('Audio processing would be implemented here. Currently supports file upload only.', 'Audio file uploaded successfully!');
    }, 2000);
}

// IMPROVED: Image Processing with Multiple OCR Methods
async function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        showImagePreview(e.target.result, 'Image', 'fas fa-image');
        
        // Add the uploaded image to extracted images
        addExtractedImage(e.target.result, file.name.split('.')[0]);
        
        try {
            const img = new Image();
            img.onload = async () => {
                let bestResult = '';
                let bestConfidence = 0;

                // Try multiple OCR methods
                const methods = [
                    { name: 'PSM_AUTO', psm: Tesseract.PSM.AUTO },
                    { name: 'PSM_SINGLE_BLOCK', psm: Tesseract.PSM.SINGLE_BLOCK },
                    { name: 'PSM_SINGLE_COLUMN', psm: Tesseract.PSM.SINGLE_COLUMN },
                    { name: 'PSM_SINGLE_BLOCK_VERT_TEXT', psm: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT }
                ];

                for (let method of methods) {
                    try {
                        const canvas = createCanvasFromImage(img);
                        const processedCanvas = enhanceImageForOCR(canvas);
                        
                        const { data: { text, confidence } } = await Tesseract.recognize(processedCanvas, 'eng', {
                            logger: m => updateProgress(m),
                            tessedit_pageseg_mode: method.psm,
                            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
                            preserve_interword_spaces: '1'
                        });

                        if (confidence > bestConfidence && text.trim().length > bestResult.length) {
                            bestResult = text;
                            bestConfidence = confidence;
                        }
                    } catch (err) {
                        console.log(`OCR method ${method.name} failed:`, err);
                    }
                }

                // If no good result, try default method
                if (!bestResult || bestConfidence < 50) {
                    const canvas = createCanvasFromImage(img);
                    const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
                        logger: m => updateProgress(m)
                    });
                    bestResult = text;
                }

                showResult(cleanOCRText(bestResult), `Text extracted with ${Math.round(bestConfidence)}% confidence`);
            };
            img.src = e.target.result;
        } catch (err) {
            console.error('OCR Error:', err);
            showError('Failed to extract text from image');
        }
    };
    reader.readAsDataURL(file);
}

// IMPROVED: PDF Processing with Better Text Preservation
async function handlePDFFile(file) {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        try {
            const typedArray = new Uint8Array(this.result);
            showPDFPreview(file);
            
            // Extract images and text in parallel for better performance
            await Promise.all([
                extractPDFPagesAsImages(typedArray, file.name),
                extractTextFromPDF(typedArray)
            ]);

        } catch (err) {
            console.error('PDF processing error:', err);
            showError('Failed to process PDF file');
        }
    };
    fileReader.readAsArrayBuffer(file);
}

// IMPROVED: PDF Text Extraction with Format Preservation
async function extractTextFromPDF(typedArray) {
    try {
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let extractedText = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Improved text reconstruction with line breaks
            let pageText = '';
            let lastY = null;
            
            textContent.items.forEach(item => {
                const y = item.transform[5];
                if (lastY !== null && Math.abs(y - lastY) > 5) {
                    pageText += '\n';
                }
                pageText += item.str + ' ';
                lastY = y;
            });
            
            extractedText += `--- Page ${pageNum} ---\n${pageText.trim()}\n\n`;
            updateProgress({ 
                progress: pageNum / pdf.numPages, 
                status: `Extracting text from page ${pageNum}/${pdf.numPages}` 
            });
        }

        const cleanedText = cleanExtractedText(extractedText);
        
        if (cleanedText.trim().length > 10) {
            showResult(cleanedText, `Extracted text from ${pdf.numPages} page(s)`);
        } else {
            // Fallback to OCR
            showToast('Using OCR for better text extraction...', 'info');
            await performOCROnPDFPages(typedArray);
        }
    } catch (err) {
        console.error('PDF text extraction error:', err);
        await performOCROnPDFPages(typedArray);
    }
}

// IMPROVED: PDF Image Extraction - Higher Quality
async function extractPDFPagesAsImages(typedArray, filename) {
    try {
        const pdf = await pdfjsLib.getDocument(typedArray).promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 3.0 }); // Higher resolution for better quality
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            // Use higher quality image format
            const imageData = canvas.toDataURL('image/png', 1.0);
            addExtractedImage(imageData, `${filename}-page${pageNum}`);
            
            updateProgress({ 
                progress: pageNum / pdf.numPages, 
                status: `Extracting images from page ${pageNum}` 
            });
        }

        showToast(`Extracted ${pdf.numPages} page images from PDF`, 'success');
    } catch (err) {
        console.error('PDF image extraction error:', err);
        showToast('Failed to extract images from PDF', 'error');
    }
}

// IMPROVED: OCR Fallback for PDF with Better Settings
async function performOCROnPDFPages(typedArray) {
    try {
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let ocrText = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.5 }); // Higher scale for better OCR
            
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
                logger: m => updateProgress(m, pageNum, pdf.numPages),
                tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
                tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
                preserve_interword_spaces: '1'
            });
            
            ocrText += `--- Page ${pageNum} (OCR) ---\n${cleanOCRText(text)}\n\n`;
        }

        showResult(cleanExtractedText(ocrText), 'Text extracted using OCR');
    } catch (err) {
        console.error('PDF OCR error:', err);
        showError('Failed to perform OCR on PDF');
    }
}

// IMPROVED: DOCX Processing with Better Text Extraction
async function handleDOCXFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        showPDFPreview(file, 'DOCX', 'fas fa-file-word');
        
        try {
            // Extract images first
            await extractImagesFromDOCX(file);

            // Extract text with better options
            const result = await mammoth.extractRawText({ 
                arrayBuffer: e.target.result 
            });
            
            const cleanedText = cleanExtractedText(result.value);
            showResult(cleanedText, 'Text extracted from DOCX');
        } catch (err) {
            console.error('DOCX processing error:', err);
            showError('Failed to extract text from DOCX');
        }
    };
    reader.readAsArrayBuffer(file);
}

// IMPROVED: DOCX Image Extraction - More Reliable
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
                            const imageName = `image-${imageIndex}`;
                            addExtractedImage(dataUrl, imageName);
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
        showToast('Failed to extract images from DOCX', 'error');
    }
}

// IMPROVED: Text File Processing with Format Preservation
async function handleTextFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        showPDFPreview(file, 'TXT', 'fas fa-file-alt');
        // Preserve original formatting for text files
        const text = e.target.result;
        showResult(text, 'Text extracted from file');
        elements.processingState.style.display = 'none';
    };
    reader.readAsText(file);
}

// IMPROVED: Image Extraction Functions with Better UI
function addExtractedImage(dataUrl, filename = 'image') {
    const wrapper = document.createElement('div');
    wrapper.className = 'extracted-image-card';
    wrapper.style.cssText = `
        position: relative;
        width: 160px;
        height: 180px;
        border: 2px solid hsl(var(--border));
        border-radius: 12px;
        overflow: hidden;
        background: hsl(var(--card));
        display: flex;
        flex-direction: column;
        transition: all 0.3s ease;
        cursor: pointer;
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

    // Image container
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = `
        width: 100%;
        height: 120px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, hsl(var(--muted)), hsl(var(--secondary)));
    `;

    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transition: transform 0.3s ease;
    `;
    img.onmouseenter = () => img.style.transform = 'scale(1.05)';
    img.onmouseleave = () => img.style.transform = 'scale(1)';
    img.addEventListener('click', () => viewImage(dataUrl));
    
    imgContainer.appendChild(img);

    // Filename
    const fileName = document.createElement('div');
    fileName.textContent = filename.length > 20 ? filename.substring(0, 18) + '...' : filename;
    fileName.style.cssText = `
        padding: 8px 4px;
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
        text-align: center;
        border-top: 1px solid hsl(var(--border));
        background: hsl(var(--secondary));
        font-weight: 500;
    `;

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = `
        display: flex;
        justify-content: space-around;
        padding: 6px 4px;
        background: hsl(var(--muted));
        border-top: 1px solid hsl(var(--border));
    `;

    const viewBtn = createImageActionButton('View', 'view', () => viewImage(dataUrl));
    const downloadBtn = createImageActionButton('Save', 'download', () => downloadImage(dataUrl, filename));

    actions.appendChild(viewBtn);
    actions.appendChild(downloadBtn);
    
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
        padding: 4px 8px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.7rem;
        font-weight: 600;
        transition: all 0.2s ease;
        min-width: 50px;
    `;
    
    if (type === 'view') {
        button.style.background = 'var(--gradient-primary)';
        button.style.color = 'white';
    } else {
        button.style.background = 'hsl(var(--accent))';
        button.style.color = 'white';
    }
    
    button.onmouseenter = () => {
        button.style.transform = 'scale(1.05)';
        button.style.opacity = '0.9';
    };
    
    button.onmouseleave = () => {
        button.style.transform = 'scale(1)';
        button.style.opacity = '1';
    };
    
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
    });
    return button;
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

// IMPROVED: Utility Functions
function showImagePreview(src, fileType, iconClass) {
    elements.imagePreview.innerHTML = 
        `<div class="preview-image-container">
            <img src="${src}" class="preview-image">
            <div class="file-badge">
                <i class="${iconClass}"></i>
                <span>${fileType}</span>
            </div>
        </div>`;
}

function showAudioPreview(file) {
    elements.imagePreview.innerHTML = 
        `<div class="pdf-preview">
            <i class="fas fa-music"></i>
            <div>
                <div class="file-name">${file.name}</div>
                <div class="file-info">
                    Audio File • ${(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
            </div>
        </div>
        <div class="file-badge">
            <i class="fas fa-music"></i>
            <span>Audio</span>
        </div>`;
}

function showPDFPreview(file, fileType = 'PDF', iconClass = 'fas fa-file-pdf') {
    elements.imagePreview.innerHTML = 
        `<div class="pdf-preview">
            <i class="${iconClass}"></i>
            <div>
                <div class="file-name">${file.name}</div>
                <div class="file-info">
                    ${fileType} Document • ${(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
            </div>
        </div>
        <div class="file-badge">
            <i class="${iconClass}"></i>
            <span>${fileType}</span>
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

// IMPROVED: Image Enhancement for Better OCR
function enhanceImageForOCR(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Advanced contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert to grayscale with luminance preservation
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Enhanced contrast adjustment
        const contrastFactor = 1.8;
        const enhanced = ((gray - 128) * contrastFactor) + 128;
        
        // Smart thresholding
        const finalValue = Math.min(255, Math.max(0, enhanced));
        
        data[i] = data[i + 1] = data[i + 2] = finalValue;
    }

    ctx.putImageData(imgData, 0, 0);
    
    // Apply additional image filters
    ctx.filter = 'contrast(1.3) brightness(1.1) saturate(1.1)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    
    return canvas;
}

// IMPROVED: Text Cleaning Functions
function cleanOCRText(text) {
    if (!text) return '';
    
    return text
        // Preserve formatting but clean up excessive spaces
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        // Fix common OCR errors but preserve structure
        .replace(/([.,!?])([A-Za-z])/g, '$1 $2')
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim();
}

function cleanExtractedText(text) {
    if (!text) return '';
    
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^\s+|\s+$/gm, '')
        .trim();
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
    
    if (text && text.trim().length > 10) {
        showToast(message, 'success');
    }
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
    extractedImages = [];
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
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 4000);
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