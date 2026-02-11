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
        if (contour.length <= 10) return contour;
        return this.ramerDouglasPeucker(contour, 1.5);
    }

    ramerDouglasPeucker(points, epsilon) {
        if (points.length <= 2) return points;

        let maxDist = 0;
        let maxIndex = 0;
        const start = points[0];
        const end = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], start, end);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        if (maxDist > epsilon) {
            const left = this.ramerDouglasPeucker(points.slice(0, maxIndex + 1), epsilon);
            const right = this.ramerDouglasPeucker(points.slice(maxIndex), epsilon);
            return left.slice(0, -1).concat(right);
        }

        return [start, end];
    }

    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;

        if (dx === 0 && dy === 0) {
            return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
        }

        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
        const clampedT = Math.max(0, Math.min(1, t));

        const closestX = lineStart.x + clampedT * dx;
        const closestY = lineStart.y + clampedT * dy;

        return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
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
        
        if (this.optcurve.checked && contour.length > 4) {
            d += this.fitBezierCurve(contour);
        } else {
            for (let i = 1; i < contour.length; i++) {
                d += ` L ${contour[i].x} ${contour[i].y}`;
            }
        }

        d += ' Z';
        return d;
    }

    fitBezierCurve(points) {
        if (points.length < 4) {
            let d = '';
            for (let i = 1; i < points.length; i++) {
                d += ` L ${points[i].x} ${points[i].y}`;
            }
            return d;
        }

        let d = '';
        const n = points.length;
        const alphaMax = parseFloat(this.alphamax.value) / 100;

        for (let i = 0; i < n - 1; i++) {
            const curr = points[i];
            const next = points[(i + 1) % n];
            const prev = points[(i - 1 + n) % n];
            const nextNext = points[(i + 2) % n];

            const corner = this.calculateCorner(prev, curr, next);
            const isCorner = corner > alphaMax;

            if (isCorner || i === n - 2) {
                d += ` L ${next.x} ${next.y}`;
            } else {
                const ctrl1 = this.calculateControlPoint(prev, curr, next, 0.3);
                const ctrl2 = this.calculateControlPoint(curr, next, nextNext, 0.3);
                d += ` C ${ctrl1.x} ${ctrl1.y} ${ctrl2.x} ${ctrl2.y} ${next.x} ${next.y}`;
            }
        }

        return d;
    }

    calculateCorner(a, b, c) {
        const v1 = { x: a.x - b.x, y: a.y - b.y };
        const v2 = { x: c.x - b.x, y: c.y - b.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (mag1 === 0 || mag2 === 0) return 0;
        const cosAngle = dot / (mag1 * mag2);
        return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    }

    calculateControlPoint(a, b, c, tension) {
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        return {
            x: b.x + dx * tension,
            y: b.y + dy * tension
        };
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