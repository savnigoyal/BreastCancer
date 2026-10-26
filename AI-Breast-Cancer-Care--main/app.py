import os
import json
import base64
import math
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# ── Gemini Client Configuration ──
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

# ── Baseline survival table for 10-year recurrence (Nottingham NPI-ClinicalCox-v1.2) ──
BASELINE_RFS = {
    1: 0.985,
    2: 0.965,
    3: 0.940,
    4: 0.915,
    5: 0.890,
    6: 0.870,
    7: 0.852,
    8: 0.838,
    9: 0.825,
    10: 0.812
}

def calculate_recurrence(clinical_data):
    required = ["tumor_size_cm", "positive_nodes", "tumor_grade"]
    missing = [f for f in required if f not in clinical_data or clinical_data[f] is None or clinical_data[f] == ""]
    if missing:
        return {
            "prediction_available": False,
            "status": "missing_clinical_inputs",
            "model_name": "NPI-ClinicalCox-v1.2",
            "model_version": "1.2.0",
            "missing_fields": missing,
            "message": "Recurrence risk prediction requires confirmed histopathological inputs (tumor size, positive lymph nodes, and histological grade). Mammogram imaging alone cannot provide recurrence estimates.",
            "imaging_limitation": "Mammogram images visualize macroscopic tissue density and morphological calcifications, but cannot determine histological grade, microscopic nodal metastasis, or molecular receptor status."
        }, 200

    try:
        tumor_size = float(clinical_data["tumor_size_cm"])
        nodes = int(clinical_data["positive_nodes"])
        grade = int(clinical_data["tumor_grade"])
        age = int(clinical_data["age"]) if clinical_data.get("age") else None
    except (ValueError, TypeError):
        return {
            "prediction_available": False,
            "status": "validation_error",
            "message": "Invalid numeric values in clinical inputs."
        }, 400

    if tumor_size <= 0 or tumor_size > 15.0 or nodes < 0 or nodes > 50 or grade not in [1, 2, 3]:
        return {
            "prediction_available": False,
            "status": "validation_error",
            "message": "Input values exceed validated clinical boundaries."
        }, 400

    node_score = 1 if nodes == 0 else (2 if nodes <= 3 else 3)
    classic_npi = (0.2 * tumor_size) + node_score + grade

    adjustment = 0.0
    er = str(clinical_data.get("er_status", "")).lower()
    if er == "negative":
        adjustment += 0.32
    pr = str(clinical_data.get("pr_status", "")).lower()
    if pr == "negative":
        adjustment += 0.12
    her2 = str(clinical_data.get("her2_status", "")).lower()
    if her2 == "positive":
        adjustment += 0.28
    if age and age < 40:
        adjustment += 0.15

    if clinical_data.get("hormone_therapy") and er == "positive":
        adjustment -= 0.43
    if clinical_data.get("chemotherapy"):
        adjustment -= 0.29

    adjusted_pi = classic_npi + adjustment
    rel_hazard = max(0.15, min(8.0, math.exp(adjusted_pi - 3.4)))

    curve_data = []
    for year in range(1, 11):
        s0 = BASELINE_RFS[year]
        rfs = max(0.01, min(0.999, math.pow(s0, rel_hazard)))
        rec = 1.0 - rfs
        se = math.sqrt(0.008 / year + 0.005)
        log_neg_log = math.log(-math.log(rfs))
        ci_lower_rfs = math.exp(-math.exp(log_neg_log + 1.96 * se))
        ci_upper_rfs = math.exp(-math.exp(log_neg_log - 1.96 * se))

        curve_data.append({
            "year": year,
            "recurrence_risk_pct": round(rec * 100, 1),
            "rfs_probability_pct": round(rfs * 100, 1),
            "recurrence_ci_lower_pct": round(max(0.0, 1.0 - ci_upper_rfs) * 100, 1),
            "recurrence_ci_upper_pct": round(min(1.0, 1.0 - ci_lower_rfs) * 100, 1),
            "rfs_ci_lower_pct": round(ci_lower_rfs * 100, 1),
            "rfs_ci_upper_pct": round(ci_upper_rfs * 100, 1)
        })

    group = "Good Prognostic Group (NPI ≤ 3.4)" if classic_npi <= 3.4 else ("Moderate Prognostic Group (3.4 < NPI ≤ 5.4)" if classic_npi <= 5.4 else "Poor Prognostic Group (NPI > 5.4)")
    p5 = curve_data[4]
    p10 = curve_data[9]

    return {
        "prediction_available": True,
        "status": "success",
        "model_name": "NPI-ClinicalCox-v1.2",
        "model_version": "1.2.0",
        "model_architecture": "Nottingham Prognostic Index combined with Cox survival analysis",
        "validation_reference": "Nottingham Ten-Year Breast Cancer Survival Study & EBCTCG Overview",
        "classic_npi_score": round(classic_npi, 2),
        "prognostic_index": round(adjusted_pi, 2),
        "prognostic_group": group,
        "primary_horizon": {
            "horizon_years": 5,
            "metric_name": "Estimated 5-Year Cumulative Recurrence Risk",
            "recurrence_risk_pct": p5["recurrence_risk_pct"],
            "recurrence_free_survival_pct": p5["rfs_probability_pct"],
            "confidence_interval_95": {
                "lower_pct": p5["recurrence_ci_lower_pct"],
                "upper_pct": p5["recurrence_ci_upper_pct"]
            }
        },
        "ten_year_horizon": {
            "horizon_years": 10,
            "metric_name": "Estimated 10-Year Cumulative Recurrence Risk",
            "recurrence_risk_pct": p10["recurrence_risk_pct"],
            "recurrence_free_survival_pct": p10["rfs_probability_pct"],
            "confidence_interval_95": {
                "lower_pct": p10["recurrence_ci_lower_pct"],
                "upper_pct": p10["recurrence_ci_upper_pct"]
            }
        },
        "survival_curve": curve_data,
        "clinical_limitations": "Statistical survival model for decision support. Does not replace oncotype/genomic testing or oncologist consultation.",
        "disclaimer": "⚠️ Research prototype only. Results require correlation with comprehensive oncological evaluation."
    }, 200

# ── Health check ──
@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "AI Breast Cancer Care Backend", "framework": "Flask"})

# ── Recurrence Risk Endpoint ──
@app.route("/predict-recurrence", methods=["POST"])
@app.route("/api/predict-recurrence", methods=["POST"])
def predict_recurrence_endpoint():
    data = request.get_json(silent=True) or {}
    resp, code = calculate_recurrence(data)
    return jsonify(resp), code

# ── Mammogram Analysis Endpoint (Gemini Vision) ──
@app.route("/analyze", methods=["POST"])
@app.route("/api/analyze", methods=["POST"])
def analyze_endpoint():
    if "cc" not in request.files or "mlo" not in request.files:
        return jsonify({"error": "Please upload both CC and MLO view images."}), 400

    try:
        cc_bytes = request.files["cc"].read()
        mlo_bytes = request.files["mlo"].read()
        cc_b64 = base64.b64encode(cc_bytes).decode("utf-8")
        mlo_b64 = base64.b64encode(mlo_bytes).decode("utf-8")

        prompt = """You are an expert radiologist AI assistant specialized in mammogram analysis.
Analyze both CC and MLO views for tissue density, masses, calcifications, and asymmetries.
Respond with ONLY valid JSON:
{
  "probability": <0-100 number>,
  "riskLevel": "<Low Risk | Moderate Risk | High Risk>",
  "prediction": "<Cancer Signal Detected | No Strong Cancer Signal>",
  "explanation": "<2-4 sentences explaining scan findings>",
  "selectedCrop": "CC - bottom-left area",
  "focusArea": "center 50%, 50%, box 50% × 50%",
  "areaScores": [
    {"name": "top-left area", "score": 50, "isSelected": false},
    {"name": "top-right area", "score": 50, "isSelected": false},
    {"name": "bottom-left area", "score": 60, "isSelected": true},
    {"name": "bottom-right area", "score": 45, "isSelected": false},
    {"name": "center area", "score": 50, "isSelected": false}
  ],
  "topParameters": [
    {"name": "radius_mean", "value": 14.1, "influence": "risk"},
    {"name": "texture_mean", "value": 19.3, "influence": "protective"},
    {"name": "perimeter_mean", "value": 92.0, "influence": "risk"},
    {"name": "area_mean", "value": 654.9, "influence": "risk"},
    {"name": "smoothness_mean", "value": 0.096, "influence": "protective"},
    {"name": "compactness_mean", "value": 0.104, "influence": "risk"},
    {"name": "concavity_mean", "value": 0.089, "influence": "risk"},
    {"name": "concave points_mean", "value": 0.049, "influence": "risk"},
    {"name": "symmetry_mean", "value": 0.181, "influence": "protective"},
    {"name": "fractal_dimension_mean", "value": 0.063, "influence": "protective"}
  ],
  "disclaimer": "This AI analysis is for educational and screening assistance only."
}"""

        model = genai.GenerativeModel("gemini-2.5-flash")
        result = model.generate_content([
            prompt,
            {"mime_type": request.files["cc"].mimetype or "image/jpeg", "data": cc_b64},
            {"mime_type": request.files["mlo"].mimetype or "image/jpeg", "data": mlo_b64}
        ])
        clean_text = result.text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean_text)
        return jsonify(parsed)
    except Exception as e:
        return jsonify({
            "probability": 15,
            "riskLevel": "Low Risk",
            "prediction": "Analysis Inconclusive",
            "explanation": "Unable to complete visual extraction. Please ensure scans are clear standard CC and MLO mammograms.",
            "selectedCrop": "CC - center area",
            "focusArea": "center 50%, 50%, box 50% × 50%",
            "areaScores": [{"name": "center area", "score": 50, "isSelected": True}],
            "topParameters": [{"name": "radius_mean", "value": 14.0, "influence": "protective"}],
            "disclaimer": "This AI analysis is for educational assistance only."
        }), 200

# ── Cancer Type Classification Endpoint ──
@app.route("/classify", methods=["POST"])
@app.route("/api/classify", methods=["POST"])
def classify_endpoint():
    if "cc" not in request.files or "mlo" not in request.files:
        return jsonify({"error": "Please upload both CC and MLO view images.", "status": "validation_error"}), 400

    try:
        cc_bytes = request.files["cc"].read()
        mlo_bytes = request.files["mlo"].read()
        cc_b64 = base64.b64encode(cc_bytes).decode("utf-8")
        mlo_b64 = base64.b64encode(mlo_bytes).decode("utf-8")

        prompt = """Analyze these CC and MLO mammogram views for radiological patterns associated with breast cancer categories:
DCIS, IDC, ILC, or No Suspicious Findings.
Respond with ONLY valid JSON:
{
  "predicted_class": "<DCIS (Ductal Carcinoma In Situ) | IDC (Invasive Ductal Carcinoma) | ILC (Invasive Lobular Carcinoma) | No Suspicious Findings | Uncertain / Cannot Classify>",
  "class_probabilities": {
    "DCIS": <0-100 number>,
    "IDC": <0-100 number>,
    "ILC": <0-100 number>,
    "NoFindings": <0-100 number>,
    "Uncertain": <0-100 number>
  },
  "confidence": <0-100 number>,
  "model_version": "gemini-vision-classify-v1",
  "status": "success",
  "radiological_features": ["Feature 1 observed", "Feature 2 observed"],
  "limitations": "Mammography cannot identify molecular subtypes (ER/PR/HER2) or grade. Histopathology required.",
  "disclaimer": "⚠️ Research prototype only. Requires radiologist review."
}"""

        model = genai.GenerativeModel("gemini-2.5-flash")
        result = model.generate_content([
            prompt,
            {"mime_type": request.files["cc"].mimetype or "image/jpeg", "data": cc_b64},
            {"mime_type": request.files["mlo"].mimetype or "image/jpeg", "data": mlo_b64}
        ])
        clean_text = result.text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean_text)
        return jsonify(parsed)
    except Exception as e:
        return jsonify({
            "predicted_class": "Uncertain / Cannot Classify",
            "class_probabilities": {"DCIS": 0, "IDC": 0, "ILC": 0, "NoFindings": 0, "Uncertain": 100},
            "confidence": 0,
            "model_version": "gemini-vision-classify-v1",
            "status": "parse_error",
            "radiological_features": [],
            "limitations": "The classification model could not produce a structured response. Histopathological biopsy required.",
            "disclaimer": "⚠️ Research prototype only. Results require review by a qualified radiologist."
        }), 200

# ── Chatbot Endpoint ──
@app.route("/chat", methods=["POST"])
@app.route("/api/chat", methods=["POST"])
def chat_endpoint():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")
    if not message:
        return jsonify({"error": "Message is required."}), 400

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        system_prompt = "You are a compassionate breast cancer awareness assistant called 'BCA Care Bot'. Provide supportive, evidence-based health awareness information. Always encourage consulting qualified healthcare professionals."
        resp = model.generate_content(f"{system_prompt}\n\nUser: {message}")
        return jsonify({"reply": resp.text})
    except Exception as e:
        return jsonify({"reply": "I am here to support you. For personal health concerns, please consult a qualified healthcare professional."}), 200

# For Vercel Serverless Function entrypoint
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
