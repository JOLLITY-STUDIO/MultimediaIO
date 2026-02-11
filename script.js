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
        this.convertBtn.disabled = true;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const maxSize = 800;
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
            
            if (this.invert.checked) {
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = 255 - imageData.data[i];
                    imageData.data[i + 1] = 255 - imageData.data[i + 1];
                    imageData.data[i + 2] = 255 - imageData.data[i + 2];
                }
            }

            const options = {
                threshold: parseInt(this.threshold.value),
                turnPolicy: this.turnpolicy.value,
                turdSize: parseInt(this.turdsize.value),
                alphaMax: parseFloat(this.alphamax.value) / 100,
                optCurve: this.optcurve.checked,
                optTolerance: 0.2,
                background: '#ffffff',
                color: '#000000'
            };

            try {
                if (typeof Potrace !== 'undefined') {
                    Potrace.trace(imageData, options, (err, svg) => {
                        if (err) {
                            console.error('Potrace error:', err);
                            this.convertToSVGCanvas(ctx, canvas, width, height);
                            return;
                        }
                        this.svgData = svg;
                        this.displaySVG(svg);
                        this.loading.style.display = 'none';
                        this.convertBtn.disabled = false;
                        this.downloadBtn.style.display = 'inline-block';
                    });
                } else {
                    this.convertToSVGCanvas(ctx, canvas, width, height);
                }
            } catch (error) {
                console.error('Conversion error:', error);
                this.convertToSVGCanvas(ctx, canvas, width, height);
            }
        };
        img.src = this.originalImage;
    }

    convertToSVGCanvas(ctx, canvas, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const edgePoints = this.detectEdges(data, width, height);
        const paths = this.tracePaths(edgePoints, width, height);
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
        svg += '  <rect width="100%" height="100%" fill="white"/>\n';
        
        for (const path of paths) {
            if (path.length > 2) {
                const simplified = this.simplifyPath(path, 1);
                const d = this.pathToSVG(simplified);
                svg += `  <path d="${d}" fill="black" stroke="none"/>\n`;
            }
        }
        
        svg += '</svg>';
        
        this.svgData = svg;
        this.displaySVG(svg);
        this.loading.style.display = 'none';
        this.convertBtn.disabled = false;
        this.downloadBtn.style.display = 'inline-block';
    }

    detectEdges(data, width, height) {
        const edges = new Set();
        const threshold = parseInt(this.threshold.value);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                
                const right = ((y * width + x + 1) * 4);
                const grayRight = (data[right] + data[right + 1] + data[right + 2]) / 3;
                
                const bottom = (((y + 1) * width + x) * 4);
                const grayBottom = (data[bottom] + data[bottom + 1] + data[bottom + 2]) / 3;
                
                if (Math.abs(gray - grayRight) > threshold || Math.abs(gray - grayBottom) > threshold) {
                    if (gray < threshold) {
                        edges.add(`${x},${y}`);
                    }
                }
            }
        }
        
        return edges;
    }

    tracePaths(edges, width, height) {
        const paths = [];
        const visited = new Set();
        const directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const key = `${x},${y}`;
                if (edges.has(key) && !visited.has(key)) {
                    const path = [];
                    const stack = [{ x, y }];
                    
                    while (stack.length > 0) {
                        const p = stack.pop();
                        const pKey = `${p.x},${p.y}`;
                        if (visited.has(pKey)) continue;
                        if (!edges.has(pKey)) continue;
                        
                        visited.add(pKey);
                        path.push({ x: p.x, y: p.y });
                        
                        for (const [dx, dy] of directions) {
                            const nx = p.x + dx;
                            const ny = p.y + dy;
                            const nKey = `${nx},${ny}`;
                            if (!visited.has(nKey) && edges.has(nKey)) {
                                stack.push({ x: nx, y: ny });
                            }
                        }
                    }
                    
                    if (path.length > 5) {
                        paths.push(path);
                    }
                }
            }
        }
        
        return paths;
    }

    simplifyPath(points, tolerance) {
        if (points.length <= 3) return points;

        const result = [points[0]];
        let prev = points[0];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = Math.sqrt(
                Math.pow(points[i].x - prev.x, 2) +
                Math.pow(points[i].y - prev.y, 2)
            );
            if (dist >= tolerance) {
                result.push(points[i]);
                prev = points[i];
            }
        }

        result.push(points[points.length - 1]);
        return result;
    }

    pathToSVG(points) {
        if (points.length < 2) return '';
        
        let d = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
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