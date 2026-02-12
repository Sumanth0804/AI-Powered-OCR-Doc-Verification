/* ===========================================================================
   script.js — Final merged, fixed & production-ready
   - Backend mode (uses /api/verify_single and /api/verify_batch)
   - Unified localStorage keys: user_name, user_role
   - History key: aadhaar_history
   - Exposes helper functions used by inline onclicks
   =========================================================================== */

/* =========================
   CONFIG
   ========================= */

/* >>>> FIX ADDED HERE — API BASE URL <<<< */
const API_BASE_URL =
    (window.API_BASE_URL || "https://ai-ocr-document-verification-2.onrender.com").replace(/\/+$/, "");
/* >>>> END FIX <<<< */

const AppState = {
    mode: "single",
    lastSingleResult: null,
    lastBatchResults: null,
    debug: false
};

/* =========================
   UTILITIES
   ========================= */
function log(...args) { if (AppState.debug) console.log("[APP]", ...args); }
function warn(...args) { if (AppState.debug) console.warn("[APP]", ...args); }
function error(...args) { console.error("[APP]", ...args); }

function onDOMReady(cb) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(cb, 0);
    } else {
        document.addEventListener("DOMContentLoaded", cb);
    }
}

function $id(id) { return document.getElementById(id); }
function $q(sel, ctx=document) { return ctx.querySelector(sel); }
function $qa(sel, ctx=document) { return Array.from(ctx.querySelectorAll(sel)); }

/* =========================
   THEME — early apply
   ========================= */
(function applySavedThemeEarly() {
    try {
        const stored = localStorage.getItem("theme");
        if (stored === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
    } catch (e) {
        console.warn("Theme early apply failed", e);
    }
})();

function setTheme(mode) {
    try {
        if (mode === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", mode);
    } catch (e) {
        console.warn("setTheme error", e);
    }
    updateThemeIcon();
}

function toggleTheme() {
    const current = localStorage.getItem("theme") === "dark" ? "dark" : "light";
    setTheme(current === "dark" ? "light" : "dark");
}

function updateThemeIcon() {
    const themeBtn = $id("themeBtn");
    if (!themeBtn) return;
    const current = (localStorage.getItem("theme") === "dark") ? "dark" : "light";
    themeBtn.textContent = current === "dark" ? "🌙" : "☀️";
}

/* =========================
   SIMPLE TOAST
   ========================= */
function showToast(msg, type="info", ttl=3000) {
    try {
        const box = document.createElement("div");
        box.className = `toast toast-${type}`;
        box.textContent = msg;
        document.body.appendChild(box);
        requestAnimationFrame(() => box.classList.add("show"));
        setTimeout(() => {
            box.classList.remove("show");
            setTimeout(() => box.remove(), 300);
        }, ttl);
    } catch (e) {
        console.warn("Toast error", e);
    }
}

/* =========================
   AUTH
   ========================= */
const ExtrasAuth = {
    login(username, role) {
        localStorage.setItem("user_name", username);
        localStorage.setItem("user_role", role);
        showToast("Login successful", "success");
        setTimeout(() => window.location.href = "dashboard.html", 700);
    },
    logout() {
        localStorage.removeItem("user_name");
        localStorage.removeItem("user_role");
        showToast("Logged out", "info");
        setTimeout(() => window.location.href = "login.html", 600);
    },
    getUser() { return localStorage.getItem("user_name") || ""; },
    getRole() { return localStorage.getItem("user_role") || ""; },
    requireRole(allowed=[]) {
        const role = this.getRole();
        if (!role || !allowed.includes(role)) {
            showToast("Access denied", "error");
            window.location.href = "login.html";
            return false;
        }
        return true;
    }
};

/* =========================
   HISTORY
   ========================= */
const ExtrasHistory = {
    key: "aadhaar_history",
    push(entry) {
        try {
            const list = JSON.parse(localStorage.getItem(this.key) || "[]");
            list.unshift(entry);
            localStorage.setItem(this.key, JSON.stringify(list.slice(0, 200)));
        } catch (e) { console.warn("History push failed", e); }
    },
    get() {
        try { return JSON.parse(localStorage.getItem(this.key) || "[]"); }
        catch(e){ return []; }
    },
    clear() { localStorage.removeItem(this.key); }
};

/* =========================
   FILE HELPERS
   ========================= */
function createImagePreview(container, file) {
    if (!container || !file) return;
    const img = document.createElement("img");
    img.className = "preview-img";
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    container.innerHTML = "";
    container.appendChild(img);
}

/* =========================
   THEME TOGGLE
   ========================= */
function initThemeToggle() {
    const themeBtn = $id("themeBtn");
    const themeMenu = $id("themeMenu");
    updateThemeIcon();

    if (!themeBtn || !themeMenu) return;

    themeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        themeMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => themeMenu.classList.add("hidden"));
    themeMenu.addEventListener("click", (e) => e.stopPropagation());

    $qa(".theme-option").forEach(opt => {
        const t = opt.dataset.theme;
        if (!t) return;
        opt.addEventListener("click", () => {
            setTheme(t);
            themeMenu.classList.add("hidden");
        });
    });
}

/* =========================
   SERVICE CARDS
   ========================= */
function initServiceCards() {
    const cards = $qa('.service-card[data-service]');
    if (!cards.length) return;

    cards.forEach(card => {
        card.addEventListener("click", () => {
            cards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");

            const uploadSection = $id("uploadSection");
            if (uploadSection) {
                uploadSection.style.display = "block";
                uploadSection.scrollIntoView({ behavior: "smooth" });
            }

            const svc = card.getAttribute("data-service");
            if (svc === "single" || svc === "batch") setMode(svc);
            else if (svc === "api") setMode("api");
        });
    });

    const singleBtn = $id("singleBtn");
    const batchBtn = $id("batchBtn");
    if (singleBtn) singleBtn.addEventListener("click", () => setMode("single"));
    if (batchBtn) batchBtn.addEventListener("click", () => setMode("batch"));
}

/* =========================
   setMode
   ========================= */
function setMode(mode) {
    AppState.mode = mode;
    log("Mode set to", mode);

    const uploadTitle = $id("uploadTitle");
    const uploadDescription = $id("uploadDescription");
    const verifyForm = $id("verifyForm");
    const singleUpload = $id("singleUpload");
    const batchUpload = $id("batchUpload");
    const qrContainer = $id("qrCheckboxContainer");
    const verificationResults = $id("verificationResults");

    if (uploadTitle && uploadDescription) {
        if (mode === "single") {
            uploadTitle.textContent = "Single Aadhaar Verification";
            uploadDescription.textContent = "Upload Aadhaar card images for verification.";
        } else if (mode === "batch") {
            uploadTitle.textContent = "Batch Aadhaar Verification";
            uploadDescription.textContent = "Upload a ZIP file containing multiple Aadhaar images.";
        } else {
            uploadTitle.textContent = "API Integration";
            uploadDescription.textContent = "Contact team for API access.";
        }
    }

    if (singleUpload) singleUpload.style.display = mode === "single" ? "block" : "none";
    if (batchUpload) batchUpload.style.display = mode === "batch" ? "block" : "none";
    if (qrContainer) qrContainer.style.display = mode === "single" ? "block" : "none";
    if (verifyForm) verifyForm.style.display = mode === "api" ? "none" : "block";

    if (verificationResults) {
        verificationResults.innerHTML = "<p>Results will appear here.</p>";
    }
}

/* =========================
   Verification form init
   ========================= */
function initVerificationForm() {
    const verifyForm = $id("verifyForm");
    if (!verifyForm) return;

    verifyForm.addEventListener("submit", handleVerificationSubmit);

    const frontInput = $id("front") || $id("previewFrontInput");
    const backInput = $id("back") || $id("previewBackInput");
    const frontPreview = $id("previewFront") || $id("previewFrontContainer");
    const backPreview = $id("previewBack") || $id("previewBackContainer");

    if (frontInput && frontPreview) {
        frontInput.addEventListener("change", () => {
            if (frontInput.files && frontInput.files[0]) createImagePreview(frontPreview, frontInput.files[0]);
        });
    }

    if (backInput && backPreview) {
        backInput.addEventListener("change", () => {
            if (backInput.files && backInput.files[0]) createImagePreview(backPreview, backInput.files[0]);
        });
    }
}

/* =========================
   Spinner
   ========================= */
function showLoading(show) {
    const spinner = $id("loadingSpinner");
    if (!spinner) return;
    spinner.style.display = show ? "block" : "none";
}

/* =========================
   Verification (BACKEND)
   ========================= */
async function handleVerificationSubmit(e) {
    e.preventDefault();
    const resultsContainer = $id("verificationResults");
    if (resultsContainer) resultsContainer.innerHTML = "<p>Processing... please wait.</p>";

    showLoading(true);

    try {
        const formData = new FormData();

        if (AppState.mode === "single") {

            const front = $id("front") || $id("previewFrontInput");
            if (!front || !front.files || !front.files[0]) {
                alert("Please select a front image file.");
                showLoading(false);
                return;
            }
            formData.append("front", front.files[0]);

            const back = $id("back") || $id("previewBackInput");
            if (back && back.files && back.files[0]) {
                formData.append("back", back.files[0]);
            }

            const qrCheckEl = document.querySelector('input[name="qr"]') || $id("qrCheck");
            formData.append("qr", qrCheckEl && qrCheckEl.checked ? "true" : "false");

            /* FIXED URL — now correct */
            const resp = await fetch(`${API_BASE_URL}/api/verify_single`, {
                method: "POST",
                body: formData
            });

            if (!resp.ok) {
                const txt = await resp.text().catch(() => "");
                throw new Error(`Server error: ${resp.status} ${txt}`);
            }

            const json = await resp.json();
            showLoading(false);

            if (json.success && json.result) {
                displaySingleResult(json.result);
                ExtrasHistory.push({
                    time: new Date().toLocaleString(),
                    status: json.result.error ? "Error" : "Valid",
                    fraud: json.result.fraud_score ?? "-"
                });
                showToast("Verification successful", "success");

            } else if (json.result?.error === "NOT_AADHAAR") {
                displayNonAadhaarResult(json.result);
                ExtrasHistory.push({
                    time: new Date().toLocaleString(),
                    status: "Non-Aadhaar",
                    fraud: "-"
                });
                showToast("Not an Aadhaar", "error");

            } else {
                const errMsg = json.error || "Unexpected response";
                if (resultsContainer)
                    resultsContainer.innerHTML = `<p style="color:red">${errMsg}</p>`;
                showToast("Verification failed", "error");
            }

        } else if (AppState.mode === "batch") {

            const zip = $id("zip");
            if (!zip || !zip.files || !zip.files[0]) {
                alert("Please select a ZIP file.");
                showLoading(false);
                return;
            }
            formData.append("zip", zip.files[0]);

            /* FIXED URL */
            const resp = await fetch(`${API_BASE_URL}/api/verify_batch`, {
                method: "POST",
                body: formData
            });

            if (!resp.ok) {
                const txt = await resp.text().catch(() => "");
                throw new Error(`Server error: ${resp.status} ${txt}`);
            }

            const json = await resp.json();
            showLoading(false);

            if (json.success && (json.results || json.summary)) {
                displayBatchResults(json.results || json);
                ExtrasHistory.push({
                    time: new Date().toLocaleString(),
                    status: "Batch",
                    fraud: "-"
                });
                showToast("Batch processed", "success");

            } else {
                const msg = json.error || "Unexpected batch response";
                if (resultsContainer)
                    resultsContainer.innerHTML = `<p style="color:red">${msg}</p>`;
                showToast("Batch error", "error");
            }

        } else {
            showLoading(false);
            if (resultsContainer)
                resultsContainer.innerHTML = "<p>API mode — integrate with our API.</p>";
        }

    } catch (err) {
        console.error("Verification error", err);
        showLoading(false);
        if ($id("verificationResults"))
            $id("verificationResults").innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
        showToast("Verification error", "error");
    }
}

/* =========================
   RESULT RENDERERS
   ========================= */
function displaySingleResult(result) {
    AppState.lastSingleResult = result;
    window.__lastSingleResult = result || null;

    const out = $id("verificationResults");
    if (!out) return;

    if (!result || result.error === "NOT_AADHAAR") {
        displayNonAadhaarResult(result);
        return;
    }

    const riskLevel = result.assessment || "UNKNOWN";
    const fraudScore = result.fraud_score ?? 0;

    const riskClass = riskLevel === "HIGH" ? "risk-high"
                   : riskLevel === "MODERATE" ? "risk-medium"
                   : "risk-low";

    const riskTagClass = riskLevel === "HIGH" ? "risk-high-tag"
                     : riskLevel === "MODERATE" ? "risk-medium-tag"
                     : "risk-low-tag";

    const html = `
        <div class="result-card success" id="singleResultCard">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4>✅ Valid Aadhaar Card Detected</h4>
                <span class="risk-tag ${riskTagClass}">${riskLevel} RISK</span>
            </div>

            <div class="detail-item" style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span><strong>Fraud Score:</strong></span>
                <span class="${riskClass}">${fraudScore}</span>
            </div>

            <div class="detail-item" style="display:flex; justify-content:space-between; margin-bottom:12px;">
                <span><strong>Aadhaar Verification Confidence:</strong></span>
                <span>${result.aadhaar_verification?.confidence_score ?? "N/A"}%</span>
            </div>

            ${addDownloadButtonToSingle(result)}

            <div style="text-align:center; margin-top:10px;">
                <button id="viewFullBtn" class="btn" style="background:#6c757d;">View Full Details</button>
            </div>
        </div>
    `;
    out.innerHTML = html;

    const viewBtn = $id("viewFullBtn");
    if (viewBtn) viewBtn.addEventListener("click", () => showSingleFullDetails(result));

    out.scrollIntoView({ behavior: "smooth" });
}

function showSingleFullDetails(result) {
    result = result || AppState.lastSingleResult || window.__lastSingleResult;
    if (!result) return;

    window.__lastSingleResult = result;
    AppState.lastSingleResult = result;

    const out = $id("verificationResults");
    if (!out) return;

    const riskLevel = result.assessment || "UNKNOWN";
    const fraudScore = result.fraud_score ?? 0;

    const riskTagClass = riskLevel === "HIGH" ? "risk-high-tag"
                     : riskLevel === "MODERATE" ? "risk-medium-tag"
                     : "risk-low-tag";

    let html = `
        <div class="result-card success expanded">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4>✅ Valid Aadhaar Card Detected - Full Details</h4>
                <span class="risk-tag ${riskTagClass}">${riskLevel} RISK</span>
            </div>

            <div style="margin-top:10px;">
                <div class="detail-item" style="display:flex; justify-content:space-between;">
                    <span><strong>Fraud Score:</strong></span><span>${fraudScore}</span>
                </div>
                <div class="detail-item" style="display:flex; justify-content:space-between;">
                    <span><strong>Verification Confidence:</strong></span>
                    <span>${result.aadhaar_verification?.confidence_score ?? "N/A"}%</span>
                </div>
            </div>
    `;

    if (result.extracted) {
        html += `
            <h5 style="margin-top:20px;">Extracted Information:</h5>
            <div class="verification-details">
                <div class="detail-item"><span><strong>Name:</strong></span><span>${result.extracted.name || "Not found"}</span></div>
                <div class="detail-item"><span><strong>DOB:</strong></span><span>${result.extracted.dob || "Not found"}</span></div>
                <div class="detail-item"><span><strong>Gender:</strong></span><span>${result.extracted.gender || "Not found"}</span></div>
                <div class="detail-item"><span><strong>Aadhaar:</strong></span><span>${result.extracted.aadhaar || "Not found"}</span></div>
            </div>
        `;
    }

    if (result.indicators && Array.isArray(result.indicators) && result.indicators.length) {
        html += `<h5 style="margin-top:18px;">Verification Indicators:</h5><div class="verification-details">`;
        result.indicators.forEach(ind => {
            html += `<div class="detail-item"><span>${ind}</span></div>`;
        });
        html += `</div>`;
    }

    if (result.annotated_b64) {
        html += `
            <h5 style="margin-top:18px;">Processed Image:</h5>
            <div style="text-align:center; margin:12px 0;">
                <img src="data:image/jpeg;base64,${result.annotated_b64}"
                    alt="Annotated" style="max-width:100%; border-radius:8px; border:1px solid #e6e6e6;" />
            </div>
        `;
    }

    html += `
        <div style="text-align:center; margin-top:16px;">
            <button id="showLessBtn" class="btn" style="background:#6c757d;">Show Less</button>
            ${addDownloadButtonInline(result)}
        </div>
    </div>
    `;

    out.innerHTML = html;

    const showLessBtn = $id("showLessBtn");
    if (showLessBtn) showLessBtn.addEventListener("click", () => displaySingleResult(result));

    out.scrollIntoView({ behavior: "smooth" });
}

/* =========================
   NON-AADHAAR
   ========================= */
function displayNonAadhaarResult(result) {
    const out = $id("verificationResults");
    if (!out) return;

    const confidence = result?.confidence_score ?? result?.aadhaar_verification?.confidence_score ?? 0;
    const details = result?.aadhaar_verification_details || {};

    let barColor = "#d32f2f";
    if (confidence >= 50) barColor = "#ff9800";
    if (confidence >= 70) barColor = "#4caf50";

    const html = `
        <div class="non-aadhaar-alert">
            <h4>⚠️ Not an Aadhaar Card</h4>
            <p><strong>Message:</strong> ${result?.message || "Image not detected as Aadhaar."}</p>

            <div class="conf-box">
                <strong>Confidence: ${confidence}%</strong>
                <div class="conf-bar">
                    <div class="conf-fill" style="width:${confidence}%; background:${barColor};"></div>
                </div>
            </div>

            <h5>Verification Details:</h5>
            <div class="verification-details">
                <div class="detail-item"><span>Keywords Found:</span><span>${details.keywords_found || 0}</span></div>
                <div class="detail-item"><span>Aadhaar Patterns:</span><span>${details.aadhaar_numbers_found || 0}</span></div>
                <div class="detail-item"><span>Aspect Ratio:</span><span>${details.aspect_ratio_valid ? "Valid" : "Invalid"}</span></div>
                <div class="detail-item"><span>Image Size:</span><span>${details.size_valid ? "Adequate" : "Too Small"}</span></div>
            </div>

            <h5>Recommendation</h5>
            <ul>
                <li>Upload clear Aadhaar card image</li>
                <li>Show the 12-digit Aadhaar number</li>
                <li>Proper rectangular aspect ratio</li>
                <li>Readable text with “Aadhaar / UIDAI” keywords</li>
            </ul>
        </div>
    `;
    out.innerHTML = html;
    out.scrollIntoView({ behavior: "smooth" });
}

/* =========================
   BATCH
   ========================= */
function displayBatchResults(results, summary=null) {
    AppState.lastBatchResults = results;
    window.__lastBatchResults = results || [];

    const out = $id("verificationResults");
    if (!out) return;

    if (!Array.isArray(results) && results.results) {
        summary = results.summary || summary;
        results = results.results;
    }

    if (!Array.isArray(results) || results.length === 0) {
        out.innerHTML = `<div class="result-card error"><h4>❌ No Results</h4><p>No files processed.</p></div>`;
        return;
    }

    const total = results.length;
    const validCount = results.filter(r => !r.error).length;
    const nonAadhaarCount = results.filter(r => r.error === "NOT_AADHAAR").length;
    const errorCount = results.filter(r => r.error && r.error !== "NOT_AADHAAR").length;

    let html = `
        <div class="result-card info">
            <h4>📊 Batch Processing Complete</h4>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-top:12px;">
                <div class="batch-box"><strong>${total}</strong><div>Total</div></div>
                <div class="batch-box"><strong>${validCount}</strong><div>Processed</div></div>
                <div class="batch-box"><strong>${nonAadhaarCount}</strong><div>Non-Aadhaar</div></div>
                <div class="batch-box"><strong>${errorCount}</strong><div>Errors</div></div>
            </div>

            <div style="margin-top:16px; max-height:300px; overflow:auto; border-radius:8px;">
                <table class="batch-table">
                    <thead>
                        <tr><th>Filename</th><th>Status</th><th>Risk</th></tr>
                    </thead>
                    <tbody>
    `;

    const slice = results.slice(0, 30);
    slice.forEach((r, idx) => {
        const isNon = r.error === "NOT_AADHAAR";
        const isErr = r.error && r.error !== "NOT_AADHAAR";

        let status = "Valid Aadhaar";
        let color = "#28a745";
        if (isNon) { status = "Non-Aadhaar"; color = "#ff9800"; }
        if (isErr) { status = "Error"; color = "#d32f2f"; }

        const risk = (isNon || isErr) ? "N/A" : (r.assessment || "UNKNOWN");

        html += `
            <tr>
                <td>${r.filename || `File ${idx+1}`}</td>
                <td style="color:${color};">${status}</td>
                <td>${risk}</td>
            </tr>
        `;
    });

    if (results.length > slice.length) {
        html += `<tr><td colspan="3" style="text-align:center;">... ${results.length - slice.length} more files</td></tr>`;
    }

    html += `
                    </tbody>
                </table>
            </div>

            <div style="text-align:center; margin-top:16px;">
                <button class="btn" style="background:#28a745;" onclick="downloadBatchResultsFromUI()">📥 Download Full Report</button>
                <button class="btn" style="background:#0078d4;" onclick="showBatchFullDetails()">View All Details</button>
            </div>
        </div>
    `;

    out.innerHTML = html;
    out.scrollIntoView({ behavior: "smooth" });
}

function showBatchFullDetails(results) {
    results = results || AppState.lastBatchResults || window.__lastBatchResults || [];

    const out = $id("verificationResults");
    if (!out) return;

    if (!Array.isArray(results) || results.length === 0) {
        out.innerHTML = `<div class="result-card error"><h4>No batch results available</h4></div>`;
        return;
    }

    let html = `
        <div class="result-card info expanded">
            <div style="display:flex; justify-content:space-between;">
                <h4>📊 Batch Processing - Full Details</h4>
                <button class="btn" style="background:#6c757d;" onclick="displayBatchResults(window.__lastBatchResults)">Show Summary</button>
            </div>

            <div style="overflow-x:auto; margin-top:12px;">
                <table class="batch-table">
                    <thead>
                        <tr>
                            <th>Filename</th>
                            <th>Status</th>
                            <th>Risk</th>
                            <th>Fraud</th>
                            <th>Aadhaar</th>
                            <th>Confidence</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    results.forEach((r, i) => {
        const isNon = r.error === "NOT_AADHAAR";
        const isErr = r.error && r.error !== "NOT_AADHAAR";

        const filename = r.filename || `File ${i+1}`;
        const status = isNon ? "Non-Aadhaar" : isErr ? "Error" : "Valid Aadhaar";
        const risk = (isNon || isErr) ? "N/A" : (r.assessment || "UNKNOWN");
        const fraud = r.fraud_score ?? "N/A";
        const aadhaar = r.extracted?.aadhaar || "N/A";
        const confidence = isNon ? "N/A" :
            (r.aadhaar_verification?.confidence_score ? `${r.aadhaar_verification.confidence_score}%` : "N/A");

        html += `
            <tr>
                <td>${filename}</td>
                <td>${status}</td>
                <td>${risk}</td>
                <td>${fraud}</td>
                <td>${aadhaar}</td>
                <td>${confidence}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>

            <div style="text-align:center; margin-top:16px;">
                ${addDownloadButtonToBatchInline(results)}
            </div>
        </div>
    `;

    out.innerHTML = html;
    out.scrollIntoView({ behavior: "smooth" });
}

/* =========================
   DOWNLOAD HELPERS
   ========================= */
function downloadSingleResult(result) {
    result = result || AppState.lastSingleResult || window.__lastSingleResult;
    if (!result) return alert("No result to download");

    const filename = `aadhaar_single_${new Date().toISOString().replace(/[:.]/g, "-")}`;

    const payload = {
        verification_type: "single",
        timestamp: new Date().toISOString(),
        overall_assessment: result.assessment || "UNKNOWN",
        fraud_score: result.fraud_score || 0,
        confidence: result.aadhaar_verification?.confidence_score || "N/A",
        extracted: result.extracted || {},
        indicators: result.indicators || []
    };

    const json = JSON.stringify(payload, null, 2);
    const csv = convertSingleToCSV(payload);

    showDownloadOptions(filename, json, csv);
}

function downloadBatchResultsFromUI() {
    const results = AppState.lastBatchResults || window.__lastBatchResults || [];
    if (!results.length) return alert("No batch results");
    downloadBatchResults(results);
}

function downloadBatchResults(results) {
    const filename = `aadhaar_batch_${new Date().toISOString().replace(/[:.]/g, "-")}`;

    const data = {
        verification_type: "batch",
        timestamp: new Date().toISOString(),
        total_files: results.length,
        results: results.map(r => ({
            filename: r.filename,
            is_aadhaar: !(r.error && r.error === "NOT_AADHAAR"),
            error: r.error || null,
            assessment: r.assessment || "UNKNOWN",
            fraud: r.fraud_score || 0,
            confidence: r.aadhaar_verification?.confidence_score || "N/A",
            extracted: r.extracted || {}
        }))
    };

    const json = JSON.stringify(data, null, 2);
    const csv = convertBatchToCSV(data);

    showDownloadOptions(filename, json, csv);
}

function showDownloadOptions(filename, jsonData, csvData) {
    const old = $id("__download_modal");
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = "__download_modal";
    modal.className = "download-modal";

    modal.innerHTML = `
        <div class="download-box">
            <h3>Download Result</h3>
            <button class="btn" id="dl_json">JSON</button>
            <button class="btn" id="dl_csv">CSV</button>
            <button class="btn" id="dl_close" style="background:#555;">Cancel</button>
        </div>
    `;

    document.body.appendChild(modal);

    $id("dl_close").onclick = () => modal.remove();
    $id("dl_json").onclick = () => {
        downloadFile(`${filename}.json`, btoa(unescape(encodeURIComponent(jsonData))), "application/json");
        modal.remove();
    };
    $id("dl_csv").onclick = () => {
        downloadFile(`${filename}.csv`, btoa(unescape(encodeURIComponent(csvData))), "text/csv");
        modal.remove();
    };
}

function downloadFile(filename, base64, type) {
    const a = document.createElement("a");
    a.href = `data:${type};base64,${base64}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

/* =========================
   CSV converters
   ========================= */
function convertSingleToCSV(data) {
    const rows = [
        ["Field","Value"],
        ["Assessment", data.overall_assessment],
        ["Fraud Score", data.fraud_score],
        ["Confidence", data.confidence],
        ["Aadhaar Number", data.extracted.aadhaar || ""],
        ["Name", data.extracted.name || ""],
        ["DOB", data.extracted.dob || ""],
        ["Gender", data.extracted.gender || ""]
    ];
    return rows.map(r => r.map(v => `"${(v||"").toString().replace(/"/g,"\"\"")}"`).join(",")).join("\n");
}

function convertBatchToCSV(batch) {
    const headers = [
        "Filename","Is Aadhaar","Error","Assessment","Fraud Score","Confidence",
        "Aadhaar","Name","DOB","Gender"
    ];
    const lines = [headers.join(",")];

    batch.results.forEach(r => {
        lines.push([
            `"${(r.filename||"").replace(/"/g,"\"\"")}"`,
            `"${r.is_aadhaar ? "Yes" : "No"}"`,
            `"${(r.error||"").replace(/"/g,"\"\"")}"`,
            `"${(r.assessment||"").replace(/"/g,"\"\"")}"`,
            `"${r.fraud}"`,
            `"${r.confidence}"`,
            `"${(r.extracted?.aadhaar||"").replace(/"/g,"\"\"")}"`,
            `"${(r.extracted?.name||"").replace(/"/g,"\"\"")}"`,
            `"${(r.extracted?.dob||"").replace(/"/g,"\"\"")}"`,
            `"${(r.extracted?.gender||"").replace(/"/g,"\"\"")}"`,
        ].join(","));
    });

    return lines.join("\n");
}

/* =========================
   UI helper button injectors
   ========================= */
function addDownloadButtonToSingle(result) {
    return `
        <div style="text-align:center; margin-top:12px;">
            <button class="btn" style="background:#28a745;" id="dl_single_btn">
                📥 Download JSON/CSV
            </button>
        </div>
    `;
}

function addDownloadButtonInline(result) {
    return `
        <button class="btn" style="background:#28a745; margin-left:10px;" id="dl_single_btn_inline">
            📥 Download JSON/CSV
        </button>
    `;
}

function addDownloadButtonToBatchInline(results) {
    return `
        <button class="btn" style="background:#28a745;" id="dl_batch_btn">
            📥 Download Full Report
        </button>
    `;
}

/* Attach handlers */
function attachDownloadButtonHandlers() {
    const dlSingle = $id("dl_single_btn");
    if (dlSingle) dlSingle.addEventListener("click", () =>
        downloadSingleResult(window.__lastSingleResult || AppState.lastSingleResult)
    );

    const dlSingleInline = $id("dl_single_btn_inline");
    if (dlSingleInline) dlSingleInline.addEventListener("click", () =>
        downloadSingleResult(window.__lastSingleResult || AppState.lastSingleResult)
    );

    const dlBatchBtn = $id("dl_batch_btn");
    if (dlBatchBtn) dlBatchBtn.addEventListener("click", () =>
        downloadBatchResults(window.__lastBatchResults || AppState.lastBatchResults || [])
    );
}

/* =========================
   Modal close on outside click
   ========================= */
function initModalCloseOnOutside() {
    document.addEventListener("click", (e) => {
        const modal = document.querySelector(".download-modal");
        if (!modal) return;
        if (e.target === modal) modal.remove();
    });
}

/* =========================
   Dashboard / History / Analytics helpers
   ========================= */
function populateDashboardQuickStats() {
    const h = ExtrasHistory.get();
    const valid = h.filter(x => x.status === "Valid").length;
    const non = h.filter(x => x.status === "Non-Aadhaar").length;
    const err = h.filter(x => x.status === "Error").length;

    const q = $id("quickStats");
    if (q) {
        q.innerHTML = `
            <p><strong>Total Checks:</strong> ${h.length}</p>
            <p><strong>Valid Aadhaar:</strong> ${valid}</p>
            <p><strong>Non-Aadhaar:</strong> ${non}</p>
            <p><strong>Errors:</strong> ${err}</p>
        `;
    }

    if ($id("welcomeTitle"))
        $id("welcomeTitle").textContent = `Welcome, ${ExtrasAuth.getUser() || "User"}`;
    if ($id("welcomeRole"))
        $id("welcomeRole").textContent = `Role: ${ExtrasAuth.getRole() || "Unknown"}`;
}

function renderHistoryPage() {
    const list = ExtrasHistory.get();
    const out = $id("historyList");

    if (!out) return;
    if (!list.length) {
        out.innerHTML = "<p>No verification history found.</p>";
        return;
    }

    out.innerHTML = list.map(h => `
        <div class="history-item">
            <strong>${h.time}</strong><br>
            Status: <span>${h.status}</span><br>
            Fraud Score: <strong>${h.fraud}</strong>
        </div>
    `).join("");
}

function clearHistoryFromUI() {
    ExtrasHistory.clear();
    renderHistoryPage();
    showToast("History cleared", "success");
}

function renderAnalyticsCharts() {
    try {
        const h = ExtrasHistory.get();
        const valid = h.filter(x => x.status === "Valid").length;
        const non = h.filter(x => x.status === "Non-Aadhaar").length;
        const err = h.filter(x => x.status === "Error").length;

        const pie = $id("chartDistribution") || $id("chartTotal") || $id("chartValidVsInvalid");
        if (pie && typeof Chart !== "undefined") {
            try { if (pie.__chart) pie.__chart.destroy(); } catch {}
            pie.__chart = new Chart(pie, {
                type: "pie",
                data: {
                    labels: ["Valid", "Non-Aadhaar", "Error"],
                    datasets: [{ data:[valid, non, err] }]
                }
            });
        }

        const bar = $id("chartFraud") || $id("chartFraudDistribution");
        if (bar && typeof Chart !== "undefined") {
            try { if (bar.__chart) bar.__chart.destroy(); } catch {}
            const labels = h.map(x => x.time);
            const data = h.map(x => x.fraud === "-" ? 0 : Number(x.fraud) || 0);
            bar.__chart = new Chart(bar, {
                type: "bar",
                data: { labels, datasets:[{ label:"Fraud Score", data }] }
            });
        }

    } catch (e) {
        console.warn("renderAnalyticsCharts failed", e);
    }
}

/* =========================
   Enhanced Verification
   ========================= */
function bindEnhancedVerify() {
    const fIn = $id("previewFrontInput");
    const bIn = $id("previewBackInput");
    const fPrev = $id("previewFront");
    const bPrev = $id("previewBack");
    const runBtn = $id("runVerify");

    if (fIn && fPrev) {
        fIn.addEventListener("change", () => {
            if (fIn.files && fIn.files[0]) createImagePreview(fPrev, fIn.files[0]);
        });
    }

    if (bIn && bPrev) {
        bIn.addEventListener("change", () => {
            if (bIn.files && bIn.files[0]) createImagePreview(bPrev, bIn.files[0]);
        });
    }

    if (runBtn) {
        runBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const out = $id("verifyResult");

            if (!fIn || !fIn.files || !fIn.files[0]) {
                showToast("Select a front image", "error");
                return;
            }

            const formData = new FormData();
            formData.append("front", fIn.files[0]);
            if (bIn && bIn.files && bIn.files[0]) formData.append("back", bIn.files[0]);

            const qr = $id("qrCheck");
            formData.append("qr", qr && qr.checked ? "true" : "false");

            showToast("Verification started…");

            try {
                const resp = await fetch(`${API_BASE_URL}/api/verify_single`, {
                    method: "POST",
                    body: formData
                });

                if (!resp.ok) {
                    const txt = await resp.text().catch(() => "");
                    throw new Error(`Server ${resp.status} ${txt}`);
                }

                const json = await resp.json();

                if (json.result && !json.result.error) {
                    const r = json.result;
                    displaySingleResult(r);
                    ExtrasHistory.push({
                        time: new Date().toLocaleString(),
                        status: "Valid",
                        fraud: r.fraud_score
                    });
                    showToast("Verification successful", "success");

                } else if (json.result?.error === "NOT_AADHAAR") {
                    displayNonAadhaarResult(json.result);
                    ExtrasHistory.push({
                        time: new Date().toLocaleString(),
                        status: "Non-Aadhaar",
                        fraud: "-"
                    });
                    showToast("Not an Aadhaar", "error");

                } else {
                    out.innerHTML = `<p>Error during verification</p>`;
                    ExtrasHistory.push({
                        time: new Date().toLocaleString(),
                        status: "Error",
                        fraud: "-"
                    });
                    showToast("Error in verification", "error");
                }

            } catch (err) {
                console.error("Enhanced verify error", err);
                if (out) out.innerHTML = `<p style="color:red">${err.message}</p>`;
                showToast("Verification failed", "error");
            }
        });
    }
}

/* =========================
   Dashboard / History / Analytics Binding
   ========================= */
function bindDashboardPage() {
    try {
        populateDashboardQuickStats();

        const logoutLink = $id("logoutLink") || $id("logoutLink3") || $id("logoutLink2");
        if (logoutLink) {
            logoutLink.addEventListener("click", (e) => {
                e.preventDefault();
                ExtrasAuth.logout();
            });
        }

        const statsBtn = $id("refreshStats");
        if (statsBtn) statsBtn.addEventListener("click", populateDashboardQuickStats);

    } catch (e) {
        console.warn("bindDashboardPage failed", e);
    }
}

function bindHistoryPage() {
    const clearBtn = $id("clearHistory");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (confirm("Clear all history? This cannot be undone.")) clearHistoryFromUI();
        });
    }
    renderHistoryPage();
}

function bindAnalyticsPage() {
    renderAnalyticsCharts();
}

/* =========================
   STARTUP
   ========================= */
onDOMReady(() => {
    log("App initializing...");

    initThemeToggle();
    initServiceCards();
    initVerificationForm();
    bindEnhancedVerify();
    initModalCloseOnOutside();

    document.addEventListener("click", () => attachDownloadButtonHandlers());

    if ($id("quickStats")) bindDashboardPage();
    if ($id("historyList")) bindHistoryPage();
    if ($id("chartTotal") || $id("chartDistribution") || $id("chartFraud"))
        bindAnalyticsPage();

    const loginForm = $id("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const username = ($id("username") && $id("username").value.trim()) || "";
            const password = ($id("password") && $id("password").value.trim()) || "";
            const role = ($id("role") && $id("role").value) || "viewer";

            if (!username || !password) {
                Swal.fire("Missing fields", "Please enter username and password.", "warning");
                return;
            }

            const DEMO_USERS = {
                admin: "adminpass",
                analyst: "analystpass",
                viewer: "viewerpass"
            };

            if (DEMO_USERS[role] && DEMO_USERS[role] !== password) {
                Swal.fire("Invalid Password", "Incorrect password for selected role.", "error");
                return;
            }

            localStorage.setItem("user_name", username);
            localStorage.setItem("user_role", role);

            Swal.fire({
                title: "Login Successful",
                text: "Redirecting...",
                icon: "success",
                timer: 800,
                showConfirmButton: false
            });

            setTimeout(() => window.location.href = "dashboard.html", 900);
        });

        const demoBtn = $id("demoBtn");
        if (demoBtn) {
            demoBtn.addEventListener("click", () => {
                Swal.fire({
                    title: "Demo Users",
                    html:
                        `<b>Admin:</b> admin / adminpass<br>` +
                        `<b>Analyst:</b> analyst / analystpass<br>` +
                        `<b>Viewer:</b> viewer / viewerpass`,
                    icon: "info"
                });
            });
        }
    }

    if ($id("quickStats")) populateDashboardQuickStats();

    $qa("#logoutLink, #logoutLink2, #logoutLink3").forEach(el => {
        try {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                ExtrasAuth.logout();
            });
        } catch(e){}
    });

    if ($id("verifyResult")) $id("verifyResult").innerHTML = "";

    log("App ready");
});

/* =========================
   EXPOSE GLOBAL HELPERS
   ========================= */
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.setMode = (m) => setMode(m);
window.showSingleFullDetails = showSingleFullDetails;
window.collapseSingleDetails = () => displaySingleResult(AppState.lastSingleResult);
window.showBatchFullDetails = showBatchFullDetails;
window.downloadSingleResult = downloadSingleResult;
window.downloadBatchResults = downloadBatchResults;
window.downloadFile = downloadFile;

/* =========================
   End of file
   ========================= */
