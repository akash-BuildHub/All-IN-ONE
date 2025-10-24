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
});

elements.uploadZone.addEventListener('dragleave', () => {
    elements.uploadZone.style.borderColor = 'hsl(var(--border) / 0.6)';
});

elements.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadZone.style.borderColor = 'hsl(var(--border) / 0.6)';
    if (e.dataTransfer.files.length) {
        handleFileSelect({ target: { files: e.dataTransfer.files } });
    }
});

// Audio upload zone events
elements.audioUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.audioUploadZone.style.borderColor = 'hsl(var(--primary))';
});

elements.audioUploadZone.addEventListener('dragleave', () => {
    elements.audioUploadZone.style.borderColor = 'hsl(var(--border) / 0.6)';
});

elements.audioUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.audioUploadZone.style.borderColor = 'hsl(var(--border) / 0.6)';
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

    resetUI();

    // Clear previous extracted images
    elements.imageResultContent.innerHTML = '';
    elements.imageResultDisplay.style.display = 'none';
    
    const fileType = file.type;

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
    
    // Show processing state for audio
    elements.processingState.style.display = 'flex';
    
    // Simulate audio processing (replace with actual audio processing logic)
    setTimeout(() => {
        elements.processingState.style.display = 'none';
        showResult('Audio processing would be implemented here. Currently supports file upload only.', 'Audio file uploaded successfully!');
    }, 2000);
}

// Image Processing Functions
async function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        showImagePreview(e.target.result, 'Image', 'fas fa-image');
        
        // Add the uploaded image to extracted images
        addExtractedImage(e.target.result, file.name.split('.')[0]);
        
        try {
            const img = new Image();
            img.onload = async () => {
                const canvas = createCanvasFromImage(img);
                const processedCanvas = enhanceImageForOCR(canvas);
                
                const { data: { text } } = await Tesseract.recognize(processedCanvas, 'eng', {
                    logger: m => updateProgress(m),
                    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                    tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY
                });

                showResult(cleanOCRText(text));
            };
            img.src = e.target.result;
        } catch (err) {
            console.error('OCR Error:', err);
            showError('Failed to extract text from image');
        }
    };
    reader.readAsDataURL(file);
}

// PDF Processing Functions
async function handlePDFFile(file) {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        try {
            const typedArray = new Uint8Array(this.result);
            showPDFPreview(file);
            
            // Extract PDF pages as cropped images
            await extractPDFPagesAsImages(typedArray, file.name);

            // Extract text
            await extractTextFromPDF(typedArray);

        } catch (err) {
            console.error('PDF processing error:', err);
            showError('Failed to process PDF file');
        }
    };
    fileReader.readAsArrayBuffer(file);
}

// Function to crop canvas to content area
function cropCanvasToContent(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    let top = canvas.height, bottom = 0, left = canvas.width, right = 0;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2];
            const alpha = data[idx+3];

            // If pixel is not white or transparent
            if (!(r > 240 && g > 240 && b > 240) && alpha > 0) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }

    // Add small padding around content
    const padding = 10;
    left = Math.max(0, left - padding);
    top = Math.max(0, top - padding);
    right = Math.min(canvas.width, right + padding);
    bottom = Math.min(canvas.height, bottom + padding);

    const width = right - left + 1;
    const height = bottom - top + 1;

    // If no content found, return original canvas
    if (width <= 0 || height <= 0 || left >= canvas.width || top >= canvas.height) {
        return canvas.toDataURL('image/png');
    }

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const croppedCtx = croppedCanvas.getContext('2d');
    croppedCtx.drawImage(canvas, left, top, width, height, 0, 0, width, height);

    return croppedCanvas.toDataURL('image/png');
}

// Function to extract PDF pages as cropped images
async function extractPDFPagesAsImages(typedArray, filename) {
    try {
        const pdf = await pdfjsLib.getDocument(typedArray).promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            // Crop the canvas to content and add to extracted images
            const croppedDataUrl = cropCanvasToContent(canvas);
            addExtractedImage(croppedDataUrl, `${filename}-page${pageNum}`);
            
            updateProgress({ progress: pageNum / pdf.numPages });
        }

        showToast(`Extracted ${pdf.numPages} cropped page images from PDF`, 'success');
    } catch (err) {
        console.error('PDF image extraction error:', err);
        showToast('Failed to extract images from PDF', 'error');
    }
}

async function extractTextFromPDF(typedArray) {
    try {
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let text = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ').trim();
            text += pageText + '\n\n';
            updateProgress({ progress: pageNum / pdf.numPages });
        }

        if (text.trim().length > 10) {
            showResult(text);
        } else {
            // Fallback to OCR if no text found
            await performOCROnPDFPages(typedArray);
        }
    } catch (err) {
        console.error('PDF text extraction error:', err);
        showError('Failed to extract text from PDF');
    }
}

async function performOCROnPDFPages(typedArray) {
    try {
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let ocrText = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport }).promise;
            
            const processedCanvas = enhanceImageForOCR(canvas);
            const { data: { text } } = await Tesseract.recognize(processedCanvas, 'eng', {
                logger: m => updateProgress(m, pageNum, pdf.numPages)
            });
            
            ocrText += text + '\n\n';
        }

        showResult(cleanOCRText(ocrText), 'Text extracted using OCR');
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
            // Extract images
            await extractImagesFromDOCX(file);

            // Extract text
            const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
            showResult(result.value);
        } catch (err) {
            showError('Failed to extract text from DOCX');
        }
    };
    reader.readAsArrayBuffer(file);
}

async function extractImagesFromDOCX(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const imagePromises = [];
        zip.forEach((relativePath, zipEntry) => {
            if (relativePath.startsWith('word/media/') && !zipEntry.dir) {
                const ext = relativePath.split('.').pop().toLowerCase();
                // Support jpg, jpeg, png, gif, bmp
                const mimeType = ext === 'jpg' ? 'jpeg' : ext;
                imagePromises.push(
                    zipEntry.async('base64').then(data => {
                        const dataUrl = `data:image/${mimeType};base64,${data}`;
                        addExtractedImage(dataUrl, `${file.name}-img${imagePromises.length + 1}`);
                        return dataUrl;
                    })
                );
            }
        });

        const images = await Promise.all(imagePromises);
        showToast(`Extracted ${images.length} embedded images from DOCX`, 'success');
    } catch (err) {
        console.error('DOCX image extraction error:', err);
        showToast('Failed to extract images from DOCX', 'error');
    }
}

// Text File Processing
async function handleTextFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        showPDFPreview(file, 'TXT', 'fas fa-file-alt');
        showResult(e.target.result);
    };
    reader.readAsText(file);
}

// Image Extraction Functions
function addExtractedImage(dataUrl, filename = 'image') {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '150px';
    wrapper.style.height = '150px';
    wrapper.style.border = '1px solid hsl(var(--border))';
    wrapper.style.borderRadius = '0.75rem';
    wrapper.style.overflow = 'hidden';
    wrapper.style.backgroundColor = 'hsl(var(--card))';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => viewImage(dataUrl));
    wrapper.appendChild(img);

    const actions = document.createElement('div');
    actions.style.position = 'absolute';
    actions.style.bottom = '0';
    actions.style.width = '100%';
    actions.style.display = 'flex';
    actions.style.justifyContent = 'space-around';
    actions.style.background = 'rgba(0,0,0,0.5)';
    actions.style.padding = '0.25rem 0';

    // View Button
    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.style.fontSize = '0.75rem';
    viewBtn.style.color = 'white';
    viewBtn.style.background = 'transparent';
    viewBtn.style.border = 'none';
    viewBtn.style.cursor = 'pointer';
    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        viewImage(dataUrl);
    });

    // Download Button
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.style.fontSize = '0.75rem';
    downloadBtn.style.color = 'white';
    downloadBtn.style.background = 'transparent';
    downloadBtn.style.border = 'none';
    downloadBtn.style.cursor = 'pointer';
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadImage(dataUrl, filename);
    });

    actions.appendChild(viewBtn);
    actions.appendChild(downloadBtn);
    wrapper.appendChild(actions);

    elements.imageResultContent.appendChild(wrapper);
    elements.imageResultDisplay.style.display = 'flex';
}

function viewImage(src) {
    elements.modal.style.display = 'block';
    elements.modalImg.src = src;
}

function downloadImage(src, filename) {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${filename}.png`;
    a.click();
    showToast('Image downloaded successfully!', 'success');
}

// Utility Functions
function showImagePreview(src, fileType, iconClass) {
    elements.imagePreview.innerHTML = 
        `<img src="${src}" class="preview-image">
         <div class="file-badge">
            <i class="${iconClass}"></i>
            <span>${fileType}</span>
         </div>`;
}

function showAudioPreview(file) {
    elements.imagePreview.innerHTML = 
        `<div class="pdf-preview">
            <i class="fas fa-music"></i>
            <div>
                <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">${file.name}</div>
                <div style="color: hsl(var(--muted-foreground));">
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
                <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">${file.name}</div>
                <div style="color: hsl(var(--muted-foreground));">
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

function enhanceImageForOCR(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Enhance contrast and convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.3 + 128));
        const finalValue = enhanced > 150 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = finalValue;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

function cleanOCRText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[Il1]/g, 'I')
        .replace(/[0O]/g, 'O')
        .trim();
}

function updateProgress(m, currentPage = 1, totalPages = 1) {
    if (m.status === 'recognizing text') {
        const baseProgress = ((currentPage - 1) / totalPages) * 100;
        const pageProgress = m.progress * (100 / totalPages);
        const progress = Math.round(baseProgress + pageProgress);
        elements.progressFill.style.width = `${progress}%`;
        elements.progressText.textContent = `${progress}%`;
    }
}

function showResult(text, message = 'Text extracted successfully!') {
    elements.processingState.style.display = 'none';
    elements.resultDisplay.style.display = 'flex';
    elements.resultText.textContent = text || 'No text detected in the file.';
    if (text && text.trim().length > 10) {
        showToast(message, 'success');
    }
}

function showError(message) {
    elements.processingState.style.display = 'none';
    showToast(message, 'error');
}

function resetUI() {
    elements.previewContainer.style.display = 'grid';
    elements.processingState.style.display = 'flex';
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
    extractedImages = [];
}

function copyText() {
    navigator.clipboard.writeText(elements.resultText.textContent)
        .then(() => showToast('Text copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy text', 'error'));
}

function downloadText() {
    const blob = new Blob([elements.resultText.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-text-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Text file downloaded!', 'success');
}

function showToast(message, type = 'default') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;
    setTimeout(() => elements.toast.classList.remove('show'), 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (elements.previewContainer.style.display === 'grid') resetApp();
        if (elements.modal.style.display === 'block') elements.modal.style.display = 'none';
    }
});