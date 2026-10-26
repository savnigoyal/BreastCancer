# AI Breast Cancer Care 🩺

An advanced AI-powered web platform for comprehensive breast cancer care: dual-view mammogram detection, cancer type classification, evidence-based recurrence risk prediction with interactive survival curves, and clinical interpretation.

> ⚠️ **Research & Educational Decision-Support Prototype** — Not an FDA-cleared diagnostic medical device. All outputs require review by qualified radiologists, pathologists, and oncologists. Do not use as the sole basis for clinical decisions or treatment withholding.

---

## 🌟 Integrated 4-Stage Clinical Analysis Workflow

The platform unites four distinct clinical and diagnostic evaluation modalities into one responsive dashboard:

```
[Mammogram Upload: CC & MLO Views]
           │
           ▼
[Stage 1: Lesion Detection & Risk Analysis]
  - Probability score & risk badge (Low/Moderate/High)
  - 5-region candidate crop scoring (Center, Top-Left, Top-Right, Bottom-Left, Bottom-Right)
  - Automated bounding box localization on primary suspect area
  - 30-parameter SHAP-style tissue feature bars (radius, texture, concavity, etc.)
           │
           ▼
[Stage 2: Breast Cancer Type Classification]
  - Radiological pattern assessment (DCIS, IDC, ILC, No Findings, Uncertain)
  - Visual probability breakdown across 5 categories
  - Observed radiological features list
  - Explicit limitations statement (mammogram cannot detect ER/PR/HER2 or grade)
           │
           ▼
[Stage 3: Breast Cancer Recurrence Risk Analysis & Interactive Graph]
  - 10-year cumulative recurrence risk and recurrence-free survival (RFS) trajectories
  - Validated Nottingham Prognostic Index (NPI) score and clinical grouping
  - 5-Year and 10-Year risk summaries with 95% Confidence Intervals
  - Interactive Recharts trajectory graph with metric toggle and tooltips
  - Strict missing-input handling: informs user that mammograms alone cannot predict recurrence
  - Histopathology parameter input drawer & quick clinical preset scenarios
           │
           ▼
[Stage 4: Clinical Interpretation & Multidisciplinary Limitations]
  - Modality distinction matrix (Screening Imaging vs Biopsy Pathology vs Systemic Prognosis)
  - Oncology governance guidelines (Radiology, Pathology, Surgical Oncology, Medical Oncology)
  - Regulatory investigational disclaimer
```

---

## 🏗️ Project Architecture

```
AI-Breast-Cancer-Care--main/
├── frontend/                                # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── RiskAnalysis.jsx             # Unified 4-stage analysis container
│   │   │   ├── CancerTypeClassification.jsx # Stage 2: Subtype classification card
│   │   │   ├── RecurrenceRiskAnalysis.jsx   # Stage 3: Recurrence graph & summary
│   │   │   ├── ClinicalInterpretation.jsx   # Stage 4: Safety & modality matrix
│   │   │   ├── Chatbot.jsx                  # BCA Care Bot assistance
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── api.js                      # API client (analyze, classify, recurrence, chat)
│   │   └── styles/
│   │       └── index.css                   # Medical-themed pink, purple & teal styles
│   └── package.json
│
├── server/                                 # Node.js/Express backend
│   ├── index.js                            # Express API endpoints & middleware
│   ├── recurrenceService.js                # Nottingham & Cox survival analysis engine
│   └── package.json
│
├── tests/
│   ├── recurrence.test.js                  # Recurrence math, validation & CI tests (48 tests)
│   └── classify.test.js                    # Classification & structure tests (156 tests)
│
└── README.md
```

---

## 📈 Recurrence Risk Prediction Model & Mathematics

### Why Mammograms Cannot Predict Recurrence Alone
Mammograms depict macroscopic tissue radiodensity and microcalcifications. In oncology, **recurrence risk** (local or distant metastatic relapse) is dictated by microscopic tumor biology, axillary lymph node status, histological differentiation grade, and receptor biomarkers (ER, PR, HER2). When clinical pathology inputs are absent, the system refuses to generate arbitrary curves and explicitly displays a **"Clinical Pathology Inputs Required"** state.

### Mathematical Formulation (`NPI-ClinicalCox-v1.2`)
The recurrence survival engine is calibrated from the **Nottingham Ten-Year Breast Cancer Survival Study** (Haybittle et al., Galea et al.) and the **Early Breast Cancer Trialists' Collaborative Group (EBCTCG)** systemic therapy meta-analyses:

1. **Classic Nottingham Prognostic Index (NPI)**:
   $$\text{NPI} = (0.2 \times \text{Tumor Size [cm]}) + \text{Node Score} + \text{Tumor Grade}$$
   - **Node Score**:
     - $0$ positive nodes: $\text{Score} = 1$
     - $1 - 3$ positive nodes: $\text{Score} = 2$
     - $\ge 4$ positive nodes: $\text{Score} = 3$
   - **Tumor Grade**: 1 (well differentiated), 2 (moderately differentiated), 3 (poorly differentiated)

2. **Multivariable Biomarker & Treatment Hazard Adjustment**:
   $$\text{Adjusted PI} = \text{NPI} + \Delta_{\text{ER}} + \Delta_{\text{PR}} + \Delta_{\text{HER2}} + \Delta_{\text{Age}} + \Delta_{\text{Endocrine}} + \Delta_{\text{Chemo}}$$
   - ER Negative: $+0.32$
   - PR Negative: $+0.12$
   - HER2 Positive: $+0.28$
   - Age $< 40$ years: $+0.15$
   - Adjuvant Endocrine Therapy (if ER+): $-0.43$ (Hazard Ratio $\approx 0.65$)
   - Adjuvant Chemotherapy: $-0.29$ (Hazard Ratio $\approx 0.75$)

3. **Relative Hazard ($\theta$)**:
   $$\theta = \exp(\text{Adjusted PI} - 3.4)$$
   Centered around reference population index $\text{PI}_0 = 3.4$, clamped to $[0.15, 8.0]$.

4. **10-Year Recurrence-Free Survival (RFS) Trajectory**:
   $$S(t) = S_0(t)^\theta \quad \text{for } t \in \{1, 2, \dots, 10\} \text{ years}$$
   Using baseline survival parameters $S_0(t)$:
   $S_0 = [0.985, 0.965, 0.940, 0.915, 0.890, 0.870, 0.852, 0.838, 0.825, 0.812]$

5. **Cumulative Recurrence Probability**:
   $$R(t) = 1.0 - S(t)$$

6. **95% Confidence Intervals**:
   Computed using log-log standard error transformation:
   $$\text{SE}(\ln(-\ln S(t))) \approx \sqrt{\frac{0.008}{t} + 0.005}$$

---

## 🔌 API Reference

### 1. `POST /api/predict-recurrence` (and `/predict-recurrence`)
Computes evidence-based recurrence risk and 10-year survival trajectory.

**Request Body (`application/json`):**
```json
{
  "tumor_size_cm": 2.1,
  "positive_nodes": 1,
  "tumor_grade": 2,
  "er_status": "Positive",
  "pr_status": "Positive",
  "her2_status": "Negative",
  "age": 54,
  "hormone_therapy": true,
  "chemotherapy": false
}
```

**Response (200 OK):**
```json
{
  "prediction_available": true,
  "status": "success",
  "model_name": "NPI-ClinicalCox-v1.2",
  "model_version": "1.2.0",
  "classic_npi_score": 3.82,
  "prognostic_group": "Moderate Prognostic Group (3.4 < NPI ≤ 5.4)",
  "primary_horizon": {
    "horizon_years": 5,
    "metric_name": "Estimated 5-Year Cumulative Recurrence Risk",
    "recurrence_risk_pct": 11.2,
    "recurrence_free_survival_pct": 88.8,
    "confidence_interval_95": { "lower_pct": 8.1, "upper_pct": 14.8 }
  },
  "ten_year_horizon": {
    "horizon_years": 10,
    "recurrence_risk_pct": 18.5,
    "recurrence_free_survival_pct": 81.5,
    "confidence_interval_95": { "lower_pct": 13.9, "upper_pct": 23.6 }
  },
  "survival_curve": [
    {
      "year": 1,
      "recurrence_risk_pct": 1.5,
      "rfs_probability_pct": 98.5,
      "recurrence_ci_lower_pct": 0.8,
      "recurrence_ci_upper_pct": 2.6
    }
  ]
}
```

**Missing Inputs Response (when clinical inputs are absent):**
```json
{
  "prediction_available": false,
  "status": "missing_clinical_inputs",
  "missing_fields": ["tumor_size_cm", "positive_nodes", "tumor_grade"],
  "message": "Recurrence risk prediction requires confirmed histopathological inputs..."
}
```

---

### 2. `POST /api/analyze`
Dual-view CC and MLO mammogram screening analysis (detection probability, crop scores, Wisconsin SHAP parameters).

### 3. `POST /api/classify`
Radiological pattern recognition for cancer categories (DCIS, IDC, ILC, No Findings, Uncertain).

### 4. `POST /api/chat`
Supportive breast cancer awareness chatbot assistant.

---

## 🧪 Automated Testing

The project includes unit, statistical, and integration test suites:

```bash
# 1. Run Recurrence Risk Model & Survival Curve Tests (48 tests)
node tests/recurrence.test.js

# 2. Run Cancer Type Classification & Detection Tests (156 tests)
node tests/classify.test.js
```

**Total Test Coverage: 204 Passing Tests (0 Failures)**

| Test Category | Suite | Passed |
|---|---|---|
| Recurrence Input Validation & Bounds | `recurrence.test.js` | 6 |
| Missing Clinical Data Handling | `recurrence.test.js` | 9 |
| Early-Stage / High-Risk NPI Calculation | `recurrence.test.js` | 14 |
| Curve Monotonicity & Mathematical Coherence | `recurrence.test.js` | 8 |
| 95% Confidence Interval Guarantees | `recurrence.test.js` | 3 |
| Component & Architecture Contracts | `recurrence.test.js` | 8 |
| Classification Labels & Response Shapes | `classify.test.js` | 156 |

---

## 🛠️ Setup & Execution

### Prerequisites
- Node.js 18+
- npm or yarn

### 1. Install Server Dependencies & Start Backend
```bash
cd server
npm install
node index.js
```
*Server runs at `http://localhost:3001` with endpoints: `/api/analyze`, `/api/classify`, `/api/predict-recurrence`, `/api/chat`.*

### 2. Install Frontend Dependencies & Start App
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173`.*

---

## ⚖️ Medical & Regulatory Disclaimer
This application is strictly an investigational research prototype developed for educational and decision-support exploration. It does not provide medical diagnoses or guaranteed prognostic outcomes. All patients must consult with certified medical oncologists and multidisciplinary cancer care teams.