class ImageToSVGConverter {
    constructor() {
        this.originalImage = null;
        this.svgData = null;
        this.convertTimeout = null;
        this.init();
    }

    init() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.previewArea = document.getElementById('previewArea');
        this.controls = document.getElementById('controls');
        this.loading = document.getElementById('loading');
        this.originalImageEl = document.getElementById('originalImage');
        this.svgPreview = document.getElementById('svgPreview');
        this.convertBtn = document.getElementById('convertBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.reuploadBtn = document.getElementById('reuploadBtn');

        this.threshold = document.getElementById('threshold');
        this.turnpolicy = document.getElementById('turnpolicy');
        this.turdsize = document.getElementById('turdsize');
        this.alphamax = document.getElementById('alphamax');
        this.optcurve = document.getElementById('optcurve');
        this.invert = document.getElementById('invert');

        this.thresholdValue = document.getElementById('thresholdValue');
        this.turdsizeValue = document.getElementById('turdsizeValue');
        this.alphamaxValue = document.getElementById('alphamaxValue');

        this.bindEvents();
    }

    bindEvents() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        this.threshold.addEventListener('input', (e) => {
            this.thresholdValue.textContent = e.target.value;
            this.scheduleConvert();
        });
        this.turdsize.addEventListener('input', (e) => {
            this.turdsizeValue.textContent = e.target.value;
            this.scheduleConvert();
        });
        this.alphamax.addEventListener('input', (e) => {
            this.alphamaxValue.textContent = (e.target.value / 100).toFixed(2);
            this.scheduleConvert();
        });
        this.turnpolicy.addEventListener('change', () => this.scheduleConvert());
        this.optcurve.addEventListener('change', () => this.scheduleConvert());
        this.invert.addEventListener('change', () => this.scheduleConvert());

        this.convertBtn.style.display = 'none';
        this.downloadBtn.addEventListener('click', () => this.downloadSVG());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.reuploadBtn.addEventListener('click', () => this.fileInput.click());
    }

    scheduleConvert() {
        if (!this.originalImage) return;
        if (this.convertTimeout) {
            clearTimeout(this.convertTimeout);
        }
        this.convertTimeout = setTimeout(() => {
            this.convertToSVG();
        }, 300);
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.originalImage = e.target.result;
            this.originalImageEl.src = this.originalImage;
            this.showPreview();
        };
        reader.readAsDataURL(file);
    }

    showPreview() {
        this.uploadArea.style.display = 'none';
        this.previewArea.style.display = 'grid';
        this.controls.style.display = 'block';
        this.downloadBtn.style.display = 'none';
        this.svgPreview.innerHTML = '<p style="color: #999;">正在转换中...</p>';
        setTimeout(() => {
            this.convertToSVG();
        }, 100);
    }

    convertToSVG() {
        if (!this.originalImage) return;

        this.loading.style.display = 'block';

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const maxSize = 600;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = (height / width) * maxSize;
                    width = maxSize;
                } else {
                    width = (width / height) * maxSize;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const thresholdVal = parseInt(this.threshold.value);
            const turdSize = parseInt(this.turdsize.value);
            const invertColors = this.invert.checked;

            const binaryImage = this.binarizeImage(imageData, thresholdVal, invertColors);
            const contours = this.findContours(binaryImage, width, height, turdSize);
            const svg = this.contoursToSVG(contours, width, height);

            this.svgData = svg;
            this.displaySVG(svg);
            this.loading.style.display = 'none';
            this.downloadBtn.style.display = 'inline-block';
        };
        img.src = this.originalImage;
    }

    binarizeImage(imageData, threshold, invert) {
        const data = imageData.data;
        const binary = new Uint8Array(data.length / 4);

        for (let i = 0; i < data.length; i += 4) {
            const gray = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
            const alpha = data[i + 3];
            let value = gray < threshold ? 1 : 0;
            if (invert) value = 1 - value;
            if (alpha < 128) value = 0;
            binary[i / 4] = value;
        }

        return binary;
    }

    findContours(binary, width, height, minArea) {
        const contours = [];
        const visited = new Set();
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const key = `${x},${y}`;
                
                if (binary[idx] === 1 && !visited.has(key)) {
                    const region = [];
                    const stack = [{ x, y }];
                    let minX = x, maxX = x, minY = y, maxY = y;

                    while (stack.length > 0) {
                        const p = stack.pop();
                        const pKey = `${p.x},${p.y}`;
                        
                        if (visited.has(pKey)) continue;
                        if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue;
                        
                        const pIdx = p.y * width + p.x;
                        if (binary[pIdx] !== 1) continue;

                        visited.add(pKey);
                        region.push({ x: p.x, y: p.y });
                        
                        minX = Math.min(minX, p.x);
                        maxX = Math.max(maxX, p.x);
                        minY = Math.min(minY, p.y);
                        maxY = Math.max(maxY, p.y);

                        for (const [dx, dy] of directions) {
                            stack.push({ x: p.x + dx, y: p.y + dy });
                        }
                    }

                    const area = region.length;
                    if (area >= minArea) {
                        const contour = this.traceContour(region, binary, width, height, minX, maxX, minY, maxY);
                        if (contour.length >= 3) {
                            contours.push(contour);
                        }
                    }
                }
            }
        }

        return contours.sort((a, b) => b.length - a.length);
    }

    traceContour(region, binary, width, height, minX, maxX, minY, maxY) {
        const regionSet = new Set(region.map(p => `${p.x},${p.y}`));
        const edgeDirections = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
        
        let startPoint = null;
        for (const p of region) {
            if (p.y === minY || p.x === minX) {
                startPoint = p;
                break;
            }
        }
        
        if (!startPoint) return [];

        const contour = [startPoint];
        let current = startPoint;
        let dir = 0;
        let iterations = 0;
        const maxIterations = region.length * 4;

        do {
            let found = false;
            for (let i = 0; i < 8 && !found; i++) {
                const testDir = (dir + i + 6) % 8;
                const [dx, dy] = edgeDirections[testDir];
                const next = { x: current.x + dx, y: current.y + dy };
                const nextKey = `${next.x},${next.y}`;

                if (regionSet.has(nextKey)) {
                    const isEdge = this.isEdgePoint(next, binary, width, height);
                    if (isEdge) {
                        contour.push(next);
                        current = next;
                        dir = testDir;
                        found = true;
                    }
                }
            }
            iterations++;
        } while (iterations < maxIterations && 
                 (current.x !== startPoint.x || current.y !== startPoint.y || contour.length < 3) &&
                 contour.length < region.length);

        return this.simplifyContour(contour, parseFloat(this.alphamax.value) / 100);
    }

    isEdgePoint(p, binary, width, height) {
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of directions) {
            const nx = p.x + dx;
            const ny = p.y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
            const nIdx = ny * width + nx;
            if (binary[nIdx] === 0) return true;
        }
        return false;
    }

    simplifyContour(contour, tolerance) {
        if (contour.length <= 10) return contour;

        const simplified = [contour[0]];
        let prev = contour[0];
        const minDist = Math.max(1, Math.floor(contour.length / 50));

        for (let i = 1; i < contour.length - 1; i++) {
            const dist = Math.sqrt(
                Math.pow(contour[i].x - prev.x, 2) +
                Math.pow(contour[i].y - prev.y, 2)
            );
            if (dist >= minDist) {
                simplified.push(contour[i]);
                prev = contour[i];
            }
        }

        simplified.push(contour[contour.length - 1]);
        return simplified;
    }

    contoursToSVG(contours, width, height) {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
        svg += '  <rect width="100%" height="100%" fill="white"/>\n';

        for (const contour of contours) {
            if (contour.length < 3) continue;

            const path = this.contourToPath(contour);
            svg += `  <path d="${path}" fill="black" stroke="none"/>\n`;
        }

        svg += '</svg>';
        return svg;
    }

    contourToPath(contour) {
        if (contour.length < 2) return '';

        let d = `M ${contour[0].x} ${contour[0].y}`;
        
        if (this.optcurve.checked && contour.length > 4) {
            for (let i = 1; i < contour.length - 1; i += 2) {
                const p0 = contour[i - 1];
                const p1 = contour[i];
                const p2 = contour[Math.min(i + 1, contour.length - 1)];
                
                const c1 = {
                    x: (p0.x + p1.x) / 2,
                    y: (p0.y + p1.y) / 2
                };
                const c2 = {
                    x: (p1.x + p2.x) / 2,
                    y: (p1.y + p2.y) / 2
                };
                
                d += ` Q ${p1.x} ${p1.y} ${c2.x} ${c2.y}`;
            }
        } else {
            for (let i = 1; i < contour.length; i++) {
                d += ` L ${contour[i].x} ${contour[i].y}`;
            }
        }

        d += ' Z';
        return d;
    }

    displaySVG(svg) {
        this.svgPreview.innerHTML = svg;
    }

    downloadSVG() {
        if (!this.svgData) return;

        const blob = new Blob([this.svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted-image.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    reset() {
        this.originalImage = null;
        this.svgData = null;
        this.fileInput.value = '';
        this.uploadArea.style.display = 'block';
        this.previewArea.style.display = 'none';
        this.controls.style.display = 'none';
        this.loading.style.display = 'none';
        this.downloadBtn.style.display = 'none';
        this.svgPreview.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageToSVGConverter();
});