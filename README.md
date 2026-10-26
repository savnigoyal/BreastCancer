# AI Breast Cancer Care 🩺

An AI-powered web application for breast cancer detection and type classification using mammogram images (CC and MLO views).

> ⚠️ **Research & Educational Prototype** — Not a medical device. All results require review by a qualified radiologist and appropriate diagnostic testing. Do not use for clinical decision-making.

---

## ✨ Features

### Existing Detection (Preserved)
- **Dual-View Analysis**: Upload CC (Cranio-Caudal) and MLO (Medio-Lateral Oblique) mammogram views
- **AI Detection**: Gemini vision-powered analysis for cancer signal detection
- **Regional Analysis**: Evaluates 5 image regions with probability scores
- **SHAP-style Explanations**: 30 breast-tissue parameters with risk/protective influence bars
- **Bounding Box Visualization**: Highlights highest-probability region
- **Risk Stratification**: Low / Moderate / High risk classification
- **AI Chatbot**: Breast cancer awareness assistant (BCA Care Bot)

### NEW: Cancer Type Classification
- **Breast Cancer Type Classification Card**: Appears after detection analysis
- **Supported Classes**:
  - `DCIS (Ductal Carcinoma In Situ)` — clustered microcalcifications pattern
  - `IDC (Invasive Ductal Carcinoma)` — spiculated/irregular mass pattern
  - `ILC (Invasive Lobular Carcinoma)` — architectural distortion pattern
  - `No Suspicious Findings`
  - `Uncertain / Cannot Classify`
- **Probability Breakdown**: Visual bar chart for all 5 class scores
- **Radiological Features**: Lists the specific features that influenced classification
- **Confidence Score**: Clearly labeled as model output score, not cancer probability
- **Low-Confidence Detection**: Automatically flags uncertain predictions
- **Limitations Panel**: Explicit statement of what mammography cannot determine
- **Safety Messaging**: Prototype notice, disclaimer, retry option

---

## 🏗️ Architecture

### Project Structure

```
AI-Breast-Cancer-Care--main/
├── frontend/                        # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── RiskAnalysis.jsx      # Detection + triggers classification card
│   │   │   ├── CancerTypeClassification.jsx  # ← NEW classification card
│   │   │   ├── Chatbot.jsx
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── api.js               # analyzeImages + classifyImages (NEW) + sendChatMessage
│   │   └── styles/
│   │       └── index.css            # + classification card CSS (NEW)
│   └── package.json
│
├── server/                          # Node.js/Express backend
│   ├── index.js                     # /api/analyze + /api/classify (NEW) + /api/chat
│   └── package.json
│
├── tests/
│   └── classify.test.js             # ← NEW test suite (156 tests)
│
├── AI-Breast-Cancer-Care--main/     # Legacy Python Flask backend
│   └── backend/
│       ├── app.py                   # Flask server with /predict endpoint
│       ├── model_def.py             # MultiView_CBIS model definition
│       └── best_model.keras         # Binary detection model (benign vs malignant)
│
└── README.md
```

### Detection Model (`best_model.keras`)

| Property | Value |
|---|---|
| Architecture | MultiView_CBIS (ResNet50 + EfficientNetB0 dual-backbone) |
| Inputs | `cc_full` (512×512), `cc_roi` (224×224), `mlo_full` (512×512), `mlo_roi` (224×224) |
| Output | `cancer_cls` (sigmoid, 0–1), `bbox` (4 coordinates) |
| Training data | CBIS-DDSM (binary: benign vs malignant) |
| Size | ~137 MB |
| **Cannot classify** | DCIS / IDC / ILC subtypes — these require pathology-labeled data |

### Classification Module

The classification module uses **Gemini AI vision** to identify radiological patterns associated with breast cancer subtypes. It is **not a validated trained classifier**:

- No subtype-labeled mammogram dataset is bundled
- No CNN model trained on DCIS/IDC/ILC labels exists in this repo
- Results are radiological pattern assessments from a foundation vision model
- **A dedicated trained classifier requires**: pathology-labeled mammogram dataset (e.g., TCGA-BRCA with radiology-pathology pairs), patient-level train/val/test splits, per-class evaluation metrics

---

## 🛠️ Setup & Installation

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Gemini API Key** (get one at [Google AI Studio](https://aistudio.google.com))

### 1. Clone the Repository

```bash
git clone https://github.com/savnigoyal/AI-Breast-Cancer-Care-.git
cd AI-Breast-Cancer-Care--main
```

### 2. Configure Environment Variables

Create `server/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
```

> 🔒 Never commit `.env` to version control. Keep your API key private.

### 3. Install Server Dependencies

```bash
cd server
npm install
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 5. Run the Server

```bash
cd server
node index.js
```

Server starts at `http://localhost:3001`

### 6. Configure Frontend API Base (Local Development)

Edit [`frontend/src/utils/api.js`](frontend/src/utils/api.js) line 1:

```js
const API_BASE = 'http://localhost:3001/api';
```

### 7. Run the Frontend

```bash
cd frontend
npm run dev
```

Frontend available at `http://localhost:5173`

---

## 🔌 API Reference

### `GET /api/health`

Health check endpoint.

```json
{ "status": "ok", "timestamp": "2026-10-26T22:00:00.000Z" }
```

---

### `POST /api/analyze`

Binary cancer detection from CC + MLO mammogram views.

**Request:** `multipart/form-data`
- `cc` — CC view image file
- `mlo` — MLO view image file

**Response:**
```json
{
  "probability": 55.3,
  "riskLevel": "Moderate Risk (Consultation Recommended)",
  "prediction": "Cancer Signal Detected",
  "explanation": "The AI checked both scans...",
  "selectedCrop": "CC - center area",
  "focusArea": "center 50%, 50%, box 50% × 50%",
  "areaScores": [
    { "name": "top-left area", "score": 45, "isSelected": false },
    { "name": "center area", "score": 60, "isSelected": true }
  ],
  "topParameters": [
    { "name": "radius_worst", "value": 1.23, "influence": "risk" }
  ],
  "disclaimer": "..."
}
```

---

### `POST /api/classify` ← NEW

Radiological pattern-based breast cancer type classification.

**Request:** `multipart/form-data`
- `cc` — CC view image file (max 10MB, must be image/*)
- `mlo` — MLO view image file (max 10MB, must be image/*)

**Response (success):**
```json
{
  "predicted_class": "IDC (Invasive Ductal Carcinoma)",
  "class_probabilities": {
    "DCIS": 10,
    "IDC": 71,
    "ILC": 8,
    "NoFindings": 3,
    "Uncertain": 8
  },
  "confidence": 71,
  "model_version": "gemini-vision-classify-v1",
  "status": "success",
  "radiological_features": [
    "Irregular spiculated mass in the central breast on CC view",
    "Associated architectural distortion"
  ],
  "limitations": "Mammographic classification cannot determine molecular subtype (HER2/ER/PR status), tumor grade, TNM stage...",
  "disclaimer": "⚠️ Research prototype only. Results require review by a qualified radiologist..."
}
```

**Status values:**
| Status | Meaning |
|---|---|
| `success` | Prediction with confidence ≥ 40% |
| `low_confidence` | Highest class probability < 40% |
| `parse_error` | Gemini output could not be parsed |
| `validation_error` | Invalid/missing image input |
| `server_error` | Internal server error |

**Supported `predicted_class` values:**
- `DCIS (Ductal Carcinoma In Situ)`
- `IDC (Invasive Ductal Carcinoma)`
- `ILC (Invasive Lobular Carcinoma)`
- `No Suspicious Findings`
- `Uncertain / Cannot Classify`

**Error response (400):**
```json
{ "error": "CC image exceeds 10MB limit.", "status": "validation_error" }
```

---

### `POST /api/chat`

Breast cancer awareness chatbot.

**Request:** `application/json`
```json
{ "message": "What is DCIS?", "history": [] }
```

**Response:**
```json
{ "reply": "DCIS stands for Ductal Carcinoma In Situ..." }
```

---

## 🧪 Tests

Run the test suite (no dependencies required):

```bash
node tests/classify.test.js
```

**Test coverage (156 tests):**

| Suite | Tests |
|---|---|
| Response structure — DCIS | 16 |
| Response structure — IDC | 16 |
| Response structure — ILC | 16 |
| Response structure — No Findings | 16 |
| Low-confidence prediction | 16 |
| Uncertain / Cannot Classify | 15 |
| Parse error handling | 17 |
| Class probability sum validation | 7 |
| Safety — limitations field | 7 |
| Safety — confidence range | 7 |
| Backwards-compat: /api/analyze | 8 |
| Frontend: classifyImages export | 4 |
| Frontend: CancerTypeClassification | 6 |
| Backend: /api/classify route | 6 |

---

## ⚕️ Clinical Limitations

| What this app CAN indicate | What this app CANNOT determine |
|---|---|
| Radiological patterns resembling DCIS, IDC, or ILC | Definitive histopathological diagnosis |
| Cancer signal probability score | HER2, ER, or PR status |
| Regions of interest in the mammogram | Tumor grade (I, II, III) |
| Tissue texture and density features | TNM stage |
| Risk stratification (Low/Moderate/High) | Ki-67 proliferation index |
| | Molecular subtype (Luminal A/B, TNBC, HER2-enriched) |

> **ILC-specific limitation**: Invasive Lobular Carcinoma is frequently missed or underestimated on mammography and may appear as architectural distortion without a discrete mass.

---

## 📊 What a Validated Subtype Classifier Would Require

To build a **validated** breast cancer type classifier (not yet implemented):

1. **Dataset**: Pathology-labeled mammogram dataset with matched radiology-pathology annotations
   - Example: TCGA-BRCA images + pathology reports
   - Example: CBIS-DDSM with pathology-confirmed subtype labels
   - Must include: DCIS, IDC, ILC, benign cases

2. **Model architecture**: EfficientNet-B3 or ResNet-50 with transfer learning from ImageNet + medical pre-training

3. **Splits**: Patient-level train/validation/test (no patient leakage across splits)

4. **Preprocessing**: Consistent with training pipeline (resize, normalize, augment)

5. **Class imbalance**: SMOTE, class-weighted loss, or oversampling

6. **Evaluation**: Per-class precision, recall, F1, AUC-ROC, confusion matrix, sensitivity/specificity

7. **Artifacts**: Saved model + class mapping JSON + preprocessing config + evaluation metadata

---

## 🔒 Security & Privacy

- Uploaded images are processed in memory — no disk persistence in the Node server
- No patient data or images are logged or stored after the request completes
- API keys are stored only in environment variables, never in code
- Internal server errors are logged server-side only — stack traces are never exposed in API responses

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/YourFeature`
3. Commit changes: `git commit -m 'Add YourFeature'`
4. Push: `git push origin feature/YourFeature`
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.