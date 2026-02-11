class ImageToSVGConverter {
    constructor() {
        this.originalImage = null;
        this.svgData = null;
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

        this.colorThreshold = document.getElementById('colorThreshold');
        this.blurRadius = document.getElementById('blurRadius');
        this.simplifyTolerance = document.getElementById('simplifyTolerance');

        this.colorThresholdValue = document.getElementById('colorThresholdValue');
        this.blurRadiusValue = document.getElementById('blurRadiusValue');
        this.simplifyToleranceValue = document.getElementById('simplifyToleranceValue');

        this.bindEvents();
    }

    bindEvents() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        this.colorThreshold.addEventListener('input', (e) => {
            this.colorThresholdValue.textContent = e.target.value;
        });
        this.blurRadius.addEventListener('input', (e) => {
            this.blurRadiusValue.textContent = e.target.value;
        });
        this.simplifyTolerance.addEventListener('input', (e) => {
            this.simplifyToleranceValue.textContent = e.target.value;
        });

        this.convertBtn.addEventListener('click', () => this.convertToSVG());
        this.downloadBtn.addEventListener('click', () => this.downloadSVG());
        this.resetBtn.addEventListener('click', () => this.reset());
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
        this.svgPreview.innerHTML = '<p style="color: #999;">点击"转换为 SVG"按钮开始转换</p>';
    }

    convertToSVG() {
        if (!this.originalImage) return;

        this.loading.style.display = 'block';
        this.convertBtn.disabled = true;

        setTimeout(() => {
            this.performConversion();
        }, 100);
    }

    performConversion() {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const maxSize = 500;
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

            const blur = parseInt(this.blurRadius.value);
            if (blur > 0) {
                ctx.filter = `blur(${blur}px)`;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            ctx.filter = 'none';

            const imageData = ctx.getImageData(0, 0, width, height);
            const svg = this.imageDataToSVG(imageData, width, height);
            
            this.svgData = svg;
            this.displaySVG(svg);
            
            this.loading.style.display = 'none';
            this.convertBtn.disabled = false;
            this.downloadBtn.style.display = 'inline-block';
        };
        img.src = this.originalImage;
    }

    imageDataToSVG(imageData, width, height) {
        const threshold = parseInt(this.colorThreshold.value);
        const tolerance = parseInt(this.simplifyTolerance.value);
        
        const regions = this.extractColorRegions(imageData, width, height, threshold);
        const simplifiedRegions = this.simplifyRegions(regions, tolerance);
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
        svg += '  <rect width="100%" height="100%" fill="white"/>\n';
        
        for (const region of simplifiedRegions) {
            if (region.points && region.points.length > 0) {
                const points = region.points.map(p => `${p.x},${p.y}`).join(' ');
                svg += `  <polygon points="${points}" fill="${region.color}" stroke="none"/>\n`;
            }
        }
        
        svg += '</svg>';
        return svg;
    }

    extractColorRegions(imageData, width, height, threshold) {
        const regions = [];
        const visited = new Set();
        const data = imageData.data;

        const getPixelIndex = (x, y) => (y * width + x) * 4;
        const getColor = (x, y) => {
            const i = getPixelIndex(x, y);
            return { r: data[i], g: data[i+1], b: data[i+2], a: data[i+3] };
        };
        const colorDistance = (c1, c2) => {
            return Math.sqrt(
                Math.pow(c1.r - c2.r, 2) +
                Math.pow(c1.g - c2.g, 2) +
                Math.pow(c1.b - c2.b, 2)
            );
        };
        const colorToHex = (c) => {
            return `#${this.toHex(c.r)}${this.toHex(c.g)}${this.toHex(c.b)}`;
        };

        for (let y = 0; y < height; y += 3) {
            for (let x = 0; x < width; x += 3) {
                const key = `${x},${y}`;
                if (visited.has(key)) continue;

                const color = getColor(x, y);
                if (color.a < 128) continue;

                const region = { color: colorToHex(color), points: [] };
                const stack = [{ x, y }];

                while (stack.length > 0) {
                    const p = stack.pop();
                    const pKey = `${p.x},${p.y}`;
                    if (visited.has(pKey)) continue;
                    if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue;

                    const pColor = getColor(p.x, p.y);
                    if (colorDistance(color, pColor) > threshold * 5) continue;

                    visited.add(pKey);
                    region.points.push({ x: p.x, y: p.y });

                    stack.push({ x: p.x + 3, y: p.y });
                    stack.push({ x: p.x - 3, y: p.y });
                    stack.push({ x: p.x, y: p.y + 3 });
                    stack.push({ x: p.x, y: p.y - 3 });
                }

                if (region.points.length > 5) {
                    regions.push(region);
                }
            }
        }

        return regions;
    }

    simplifyRegions(regions, tolerance) {
        return regions.map(region => {
            if (region.points.length < 3) return region;

            const hull = this.convexHull(region.points);
            const simplified = this.simplifyPath(hull, tolerance);
            
            return { ...region, points: simplified };
        }).filter(r => r.points && r.points.length >= 3);
    }

    convexHull(points) {
        if (points.length < 3) return points;

        const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
        
        const cross = (o, a, b) => {
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        };

        const lower = [];
        for (const p of sorted) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        lower.pop();
        upper.pop();
        return lower.concat(upper);
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

    toHex(n) {
        const hex = Math.round(n).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
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