// This code creates a simple Express.js server that scans other local folders in the directory where server.js is located and displays .webp preview images in a filterable gallery in the browser.
// The server browses the category → model folders in the given directory, returns .webp files via the API, and provides an HTML interface containing a modal + thumbnail.
// To start the server: node server.js

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000; // Change this port if needed
const baseDir = path.join(__dirname);

const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
const nsort = (a, b) => collator.compare(a, b);

app.use(express.static(baseDir));

function countFilesRecursively(dirPath) {
    let count = 0;
    fs.readdirSync(dirPath).forEach(item => {
        const itemPath = path.join(dirPath, item);
        if (fs.statSync(itemPath).isDirectory()) {
            count += countFilesRecursively(itemPath);
        } else {
            count++;
        }
    });
    return count;
}

app.get("/api/models", (req, res) => {
    let data = [];

    fs.readdirSync(baseDir)
        .filter(category => {
            const categoryPath = path.join(baseDir, category);
            return fs.statSync(categoryPath).isDirectory() && !['.git', 'node_modules', 'assets'].includes(category);
        })
        .sort(nsort)
        .forEach(category => {
            const categoryPath = path.join(baseDir, category);

            const catFiles = fs.readdirSync(categoryPath).sort(nsort);
            const catWebp = catFiles.filter(f => f.toLowerCase().endsWith(".webp"));
            if (catWebp.length > 0) {
                data.push({
                    name: category,
                    images: catWebp.map(f => `${category}/${f}`),
                    category,
                    photoCount: catWebp.length,
                    fileCount: countFilesRecursively(categoryPath)
                });
            }

            fs.readdirSync(categoryPath)
                .filter(subfolder => fs.statSync(path.join(categoryPath, subfolder)).isDirectory())
                .sort(nsort)
                .forEach(subfolder => {
                    const subfolderPath = path.join(categoryPath, subfolder);
                    const files = fs.readdirSync(subfolderPath).sort(nsort);
                    const webpFiles = files.filter(f => f.toLowerCase().endsWith(".webp"));
                    if (webpFiles.length > 0) {
                        data.push({
                            name: subfolder,
                            images: webpFiles.map(f => `${category}/${subfolder}/${f}`),
                            category,
                            photoCount: webpFiles.length,
                            fileCount: countFilesRecursively(subfolderPath)
                        });
                    }
                });
        });

    res.json(data);
});

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Folder Viewer</title>
<style>
    body { font-family: Arial, sans-serif; background-color: #f0f0f0; padding: 20px; }
    #filters { display: flex; gap: 10px; margin-bottom: 20px; }
    select, input { padding: 5px; font-size: 16px; }
    #models { display: flex; flex-wrap: wrap; gap: 20px; }
    .card { position: relative; width: 200px; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2); text-align: center; cursor: pointer; transition: transform 0.2s ease; }
    .card:hover { transform: scale(1.05); }
    .card img { width: 100%; height: 200px; object-fit: cover; }
    .card p { margin: 10px 0; font-weight: bold; }
    .badge { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; font-size: 12px; padding: 2px 6px; border-radius: 8px; display: flex; align-items: center; gap: 4px; justify-content: center; }
    .card .icon-photo { margin-top: -6px; display: inline-block; }
    .card .icon-file { margin-top: -2px; display: inline-block; }
    /* Modal */
    #modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); justify-content: center; align-items: center; z-index: 999; flex-direction: column; }
    #modal .modal-wrapper { position: relative; text-align: center; pointer-events: none; }
    #modal .modal-wrapper #modalImg { position: relative; text-align: center; pointer-events: auto; }
    #modal img { max-width: 80%; max-height: 80vh; border: 4px solid #fff; border-radius: 10px; }
    #modal .text { color: white; margin-top: 10px; font-size: 1rem; }
    #thumbnails { display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap; justify-content: center; overflow-y: auto; height: 56px; }
    #thumbnails img { width: 50px; height: 50px; object-fit: cover; cursor: pointer; border: 2px solid transparent; pointer-events: auto; }
    #thumbnails img.active { border: 2px solid #fff; }
    #prevBtn, #nextBtn { background: rgba(255,255,255,0.2); border: none; font-size: 2rem; color: white; cursor: pointer; padding: 10px; position: absolute; top: 50%; transform: translateY(-50%); }
    #prevBtn { left: 20px; }
    #nextBtn { right: 20px; }
</style>
</head>
<body>

<!-- Filters -->
<div id="filters">
    <select id="categoryFilter"><option value="">All Categories</option></select>
    <input type="text" id="searchInput" placeholder="Search...">
</div>
<div id="models"></div>

<!-- Modal -->
<div id="modal">
    <button id="prevBtn">⟨</button>
    <div class="modal-wrapper">
        <img id="modalImg" src="" alt="Preview">
        <p id="modalName" class="text"></p>
        <div id="thumbnails"></div>
    </div>
    <button id="nextBtn">⟩</button>
</div>

<script>
let allModels = [], currentImages = [], currentImageIndex = 0, currentModelIndex = 0;

function renderModels(models) {
    const container = document.getElementById('models');
    container.innerHTML = '';
    models.forEach((model, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = \`
            <div class="badge">\${model.photoCount} <span class="icon-photo">📷</span> / \${model.fileCount} <span class="icon-file">📄</span></div>
            <img src="\${model.images[0]}" alt="\${model.name}">
            <p>\${model.name}</p>
        \`;
        card.addEventListener('click', () => openModal(model, index));
        container.appendChild(card);
    });
}

function openModal(model, modelIndex) {
    currentModelIndex = modelIndex;
    currentImages = model.images;
    currentImageIndex = 0;
    document.getElementById('modal').style.display = 'flex';
    renderThumbnails();
    showModalImage();
}

function renderThumbnails() {
    const thumbs = document.getElementById('thumbnails');
    thumbs.innerHTML = '';
    currentImages.forEach((img, idx) => {
        const t = document.createElement('img');
        t.src = img;
        if (idx === currentImageIndex) t.classList.add('active');
        t.addEventListener('click', () => {
            currentImageIndex = idx;
            showModalImage();
            renderThumbnails();
        });
        thumbs.appendChild(t);
    });
}

function closeModal() { document.getElementById('modal').style.display = 'none'; }

function showModalImage() {
    const imgPath = currentImages[currentImageIndex];
    document.getElementById('modalImg').src = imgPath;
    document.getElementById('modalName').textContent = imgPath.split('/').pop();
    renderThumbnails();
}

function prevImage() {
    if (currentImageIndex > 0) currentImageIndex--;
    else if (currentModelIndex > 0) {
        currentModelIndex--;
        currentImages = allModels[currentModelIndex].images;
        currentImageIndex = currentImages.length - 1;
    }
    showModalImage();
}

function nextImage() {
    if (currentImageIndex < currentImages.length - 1) currentImageIndex++;
    else if (currentModelIndex < allModels.length - 1) {
        currentModelIndex++;
        currentImages = allModels[currentModelIndex].images;
        currentImageIndex = 0;
    }
    showModalImage();
}

function applyFilters() {
    const category = document.getElementById('categoryFilter').value;
    const search = document.getElementById('searchInput').value.toLowerCase();
    renderModels(allModels.filter(m => 
        (category === '' || m.category === category) &&
        (search === '' || m.name.toLowerCase().includes(search))
    ));
}

fetch('/api/models')
    .then(res => res.json())
    .then(models => {
        allModels = models;
        const categorySelect = document.getElementById('categoryFilter');
        [...new Set(models.map(m => m.category))].forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat; opt.textContent = cat;
            categorySelect.appendChild(opt);
        });
        categorySelect.addEventListener('change', applyFilters);
        document.getElementById('searchInput').addEventListener('input', applyFilters);
        renderModels(allModels);
    });

document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.getElementById('prevBtn').addEventListener('click', e => { e.stopPropagation(); prevImage(); });
document.getElementById('nextBtn').addEventListener('click', e => { e.stopPropagation(); nextImage(); });
document.addEventListener('keydown', e => {
    if (document.getElementById('modal').style.display === 'flex') {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'ArrowRight') nextImage();
    }
});
</script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ The server is running: http://localhost:${PORT}`);
});
