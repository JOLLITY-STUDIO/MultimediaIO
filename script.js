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
            try {
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
            } catch (error) {
                console.error('[SVG Convert] Error:', error);
                this.svgPreview.innerHTML = `<p style="color: red;">转换出错: ${error.message}</p>`;
            } finally {
                this.loading.style.display = 'none';
                this.downloadBtn.style.display = 'inline-block';
            }
        };
        img.onerror = (e) => {
            console.error('[SVG Convert] Image load error:', e);
            this.loading.style.display = 'none';
            this.svgPreview.innerHTML = '<p style="color: red;">图片加载失败</p>';
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

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const key = `${x},${y}`;
                
                if (binary[idx] === 1 && !visited.has(key)) {
                    const region = this.floodFill(binary, width, height, x, y, visited);
                    
                    if (region.length >= minArea) {
                        const contour = this.traceRegionBoundary(region, binary, width, height);
                        if (contour.length >= 3) {
                            contours.push(contour);
                        }
                    }
                }
            }
        }

        return contours.sort((a, b) => b.length - a.length);
    }

    floodFill(binary, width, height, startX, startY, visited) {
        const region = [];
        const stack = [{ x: startX, y: startY }];
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];

        while (stack.length > 0) {
            const p = stack.pop();
            const key = `${p.x},${p.y}`;
            
            if (visited.has(key)) continue;
            if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue;
            
            const idx = p.y * width + p.x;
            if (binary[idx] !== 1) continue;

            visited.add(key);
            region.push({ x: p.x, y: p.y });

            for (const [dx, dy] of directions) {
                stack.push({ x: p.x + dx, y: p.y + dy });
            }
        }

        return region;
    }

    traceRegionBoundary(region, binary, width, height) {
        if (region.length === 0) return [];

        let minX = width, maxX = 0, minY = height, maxY = 0;
        const regionSet = new Set(region.map(p => `${p.x},${p.y}`));

        for (const p of region) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        let startPoint = null;
        for (const p of region) {
            if (p.y === minY) {
                startPoint = p;
                break;
            }
        }

        if (!startPoint) return [];

        const contour = [startPoint];
        const directions = [
            { dx: 1, dy: 0 },
            { dx: 1, dy: 1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: -1, dy: -1 },
            { dx: 0, dy: -1 },
            { dx: 1, dy: -1 }
        ];

        let current = startPoint;
        let dir = 0;
        let iterations = 0;
        const maxIterations = region.length * 4;
        const contourSet = new Set();
        contourSet.add(`${startPoint.x},${startPoint.y}`);

        do {
            let found = false;
            for (let i = 0; i < 8 && !found; i++) {
                const testDir = (dir + i + 6) % 8;
                const { dx, dy } = directions[testDir];
                const next = { x: current.x + dx, y: current.y + dy };
                const nextKey = `${next.x},${next.y}`;

                if (regionSet.has(nextKey)) {
                    const hasWhiteNeighbor = this.hasWhiteNeighbor(next, binary, width, height);
                    if (hasWhiteNeighbor) {
                        if (!contourSet.has(nextKey)) {
                            contour.push(next);
                            contourSet.add(nextKey);
                        }
                        current = next;
                        dir = testDir;
                        found = true;
                    }
                }
            }
            if (!found) break;
            iterations++;
        } while (iterations < maxIterations && 
                 (current.x !== startPoint.x || current.y !== startPoint.y || contour.length < 4) &&
                 contour.length < region.length);

        return this.simplifyContour(contour);
    }

    hasWhiteNeighbor(p, binary, width, height) {
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        
        for (const [dx, dy] of directions) {
            const nx = p.x + dx;
            const ny = p.y + dy;
            
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                return true;
            }
            
            const idx = ny * width + nx;
            if (binary[idx] === 0) {
                return true;
            }
        }
        
        return false;
    }

    simplifyContour(contour) {
        if (contour.length <= 20) return contour;

        const simplified = [];
        const step = Math.max(1, Math.floor(contour.length / 100));

        for (let i = 0; i < contour.length; i += step) {
            simplified.push(contour[i]);
        }

        if (simplified.length > 0 && 
            (simplified[simplified.length - 1].x !== contour[0].x || 
             simplified[simplified.length - 1].y !== contour[0].y)) {
            simplified.push(contour[contour.length - 1]);
        }

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
        if (contour.length < 3) return '';

        let d = `M ${contour[0].x} ${contour[0].y}`;
        
        if (this.optcurve.checked && contour.length > 6) {
            for (let i = 1; i < contour.length - 2; i += 2) {
                const p1 = contour[i];
                const p2 = contour[i + 1];
                
                const cx = (p1.x + p2.x) / 2;
                const cy = (p1.y + p2.y) / 2;
                
                d += ` Q ${p1.x} ${p1.y} ${cx} ${cy}`;
            }
            d += ` L ${contour[contour.length - 1].x} ${contour[contour.length - 1].y}`;
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