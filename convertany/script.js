const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const outputFormat = document.getElementById('output-format');
const convertBtn = document.getElementById('convert-btn');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const statusText = document.getElementById('status-text');
const percentageText = document.getElementById('percentage-text');
const downloadArea = document.getElementById('download-area');
const downloadLink = document.getElementById('download-link');
const optionsGrid = document.querySelector('.options-grid');
const designStyle = document.getElementById('design-style');

let selectedFile = null;

const FORMAT_MAP = {
    // Documents
    'docx': ['pdf', 'odt', 'txt', 'html', 'rtf', 'doc'],
    'doc': ['pdf', 'docx', 'odt', 'txt', 'rtf'],
    'odt': ['pdf', 'docx', 'txt', 'rtf', 'html'],
    'pdf': ['docx', 'odt', 'txt', 'html', 'png', 'jpg'],
    'txt': ['pdf', 'docx', 'odt', 'html'],
    'rtf': ['pdf', 'docx', 'odt', 'txt'],
    'pptx': ['pdf', 'ppt', 'odp', 'jpg', 'png'],
    'ppt': ['pdf', 'pptx', 'odp'],
    'xlsx': ['pdf', 'xls', 'ods', 'csv'],
    'xls': ['pdf', 'xlsx', 'ods', 'csv'],
    'csv': ['xlsx', 'pdf', 'ods'],
    
    // Videos & Audio
    'mp4': ['webm', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'flac'],
    'webm': ['mp4', 'mkv', 'mov', 'mp3', 'wav'],
    'mkv': ['mp4', 'webm', 'mov', 'mp3'],
    'mov': ['mp4', 'webm', 'mkv', 'mp3'],
    'avi': ['mp4', 'webm', 'mp3'],
    'mp3': ['wav', 'flac', 'ogg', 'm4a'],
    'wav': ['mp3', 'flac', 'ogg'],
    'flac': ['mp3', 'wav', 'ogg'],
    
    // Images
    'jpg': ['png', 'webp', 'pdf', 'gif', 'tiff'],
    'jpeg': ['png', 'webp', 'pdf', 'gif', 'tiff'],
    'png': ['jpg', 'webp', 'pdf', 'gif', 'tiff'],
    'webp': ['jpg', 'png', 'pdf', 'gif'],
    'gif': ['mp4', 'webp', 'png', 'jpg'],
    'svg': ['png', 'jpg', 'pdf']
};

optionsGrid.style.display = 'none';

// Drag and drop handlers
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.style.display = 'block';
    
    // Detect extension and suggest formats
    const ext = file.name.split('.').pop().toLowerCase();
    suggestFormats(ext);
    
    optionsGrid.style.display = 'block';
    validateForm();
    
    // Re-initialize icons for the new elements
    lucide.createIcons();
}

function suggestFormats(ext) {
    const isCareerPage = window.location.pathname.includes('career.html');
    outputFormat.innerHTML = '<option value="">Wähle Zielformat...</option>';
    
    if (isCareerPage) {
        const careerGroup = document.createElement('optgroup');
        careerGroup.label = "Bewerbungsformate";
        const formats = ext === 'pdf' ? ['docx', 'odt'] : ['pdf', 'docx'];
        formats.forEach(fmt => {
            const opt = document.createElement('option');
            opt.value = fmt;
            opt.textContent = fmt.toUpperCase() + (fmt === 'pdf' ? ' (Empfohlen)' : '');
            careerGroup.appendChild(opt);
        });
        outputFormat.appendChild(careerGroup);
        return;
    }

    const suggestions = FORMAT_MAP[ext] || [];
    
    // Add specific suggestions first
    if (suggestions.length > 0) {
        const group = document.createElement('optgroup');
        group.label = "Empfohlene Formate";
        suggestions.forEach(fmt => {
            const opt = document.createElement('option');
            opt.value = fmt;
            opt.textContent = fmt.toUpperCase();
            group.appendChild(opt);
        });
        outputFormat.appendChild(group);
    }

    // Add all other common formats as a second group for "Everything to Everything" feel
    const allDocs = ['pdf', 'docx', 'odt', 'txt', 'html', 'rtf'];
    const allMedia = ['mp4', 'webm', 'mp3', 'wav', 'mkv'];
    const allImages = ['png', 'jpg', 'webp', 'pdf'];

    const otherGroup = document.createElement('optgroup');
    otherGroup.label = "Weitere Formate";
    
    let combined = [];
    if (['docx', 'doc', 'odt', 'pdf', 'txt', 'rtf'].includes(ext)) combined = allDocs;
    else if (['mp4', 'webm', 'mkv', 'mov', 'mp3', 'wav'].includes(ext)) combined = allMedia;
    else combined = [...allDocs, ...allMedia, ...allImages];

    combined.forEach(fmt => {
        if (!suggestions.includes(fmt)) {
            const opt = document.createElement('option');
            opt.value = fmt;
            opt.textContent = fmt.toUpperCase();
            otherGroup.appendChild(opt);
        }
    });
    outputFormat.appendChild(otherGroup);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

outputFormat.addEventListener('change', validateForm);

function validateForm() {
    convertBtn.disabled = !(selectedFile && outputFormat.value);
    if (!convertBtn.disabled) {
        convertBtn.style.display = 'block';
    }
}

convertBtn.addEventListener('click', async () => {
    if (!selectedFile || !outputFormat.value) return;

    // Reset UI
    convertBtn.style.display = 'none';
    progressContainer.style.display = 'block';
    downloadArea.style.display = 'none';
    
    // Start progress simulation
    let progress = 0;
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 5;
            updateProgress(Math.min(progress, 90));
        }
    }, 500);

    // Prepare data
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('format', outputFormat.value);
    
    if (designStyle) {
        formData.append('style', designStyle.value);
    }

    const isMagic = designStyle && designStyle.value !== 'original';
    const endpoint = isMagic ? 'magic-convert' : 'convert';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            clearInterval(interval);
            updateProgress(100);
            statusText.textContent = 'Konvertierung abgeschlossen!';
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Get original filename and change extension
            const originalName = selectedFile.name;
            const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
            const newName = `${baseName}.${outputFormat.value}`;
            
            downloadLink.href = url;
            downloadLink.download = newName;
            downloadArea.style.display = 'block';
        } else {
            throw new Error('Konvertierung fehlgeschlagen');
        }
    } catch (error) {
        clearInterval(interval);
        statusText.textContent = 'Fehler: ' + error.message;
        statusText.style.color = '#ef4444';
    }
});

function updateProgress(value) {
    progressFill.style.width = `${value}%`;
    percentageText.textContent = `${Math.round(value)}%`;
}
