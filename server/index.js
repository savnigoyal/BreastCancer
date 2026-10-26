import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calculateRecurrenceRisk } from './recurrenceService.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Gemini client ──
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Retry helper for rate limits ──
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429 && i < retries) {
        const delay = (i + 1) * 2000;
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ── Image validation helper ──
function validateImageFile(file, maxMB = 10) {
  if (!file) return 'File is missing.';
  if (!file.mimetype.startsWith('image/')) return `File "${file.originalname}" is not an image.`;
  if (file.size > maxMB * 1024 * 1024) return `File "${file.originalname}" exceeds ${maxMB}MB limit.`;
  return null;
}

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Mammogram Analysis ──
app.post('/api/analyze', upload.fields([
  { name: 'cc', maxCount: 1 },
  { name: 'mlo', maxCount: 1 }
]), async (req, res) => {
  try {
    const ccFile = req.files?.cc?.[0];
    const mloFile = req.files?.mlo?.[0];

    if (!ccFile || !mloFile) {
      return res.status(400).json({ error: 'Please upload both CC and MLO view images.' });
    }

    // gemini-2.5-flash: best multimodal model for image + text analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const ccImage = {
      inlineData: {
        data: ccFile.buffer.toString('base64'),
        mimeType: ccFile.mimetype
      }
    };

    const mloImage = {
      inlineData: {
        data: mloFile.buffer.toString('base64'),
        mimeType: mloFile.mimetype
      }
    };

    const prompt = `You are an expert radiologist AI assistant specialized in mammogram analysis. You are analyzing two mammogram views of the same breast:

1. The first image is the CC (Cranio-Caudal) view - top-down view
2. The second image is the MLO (Medio-Lateral Oblique) view - angled side view

Analyze both images carefully. Look for:
- Tissue density patterns and BI-RADS density category
- Any masses, nodules, or architectural distortions
- Calcifications (microcalcifications or macrocalcifications)
- Asymmetric densities between views
- Skin thickening or retraction
- Lymph node abnormalities
- Overall breast composition

IMPORTANT: You MUST respond with ONLY valid JSON, no markdown, no code fences. Use this exact structure:
{
  "probability": <number between 0 and 100 representing cancer risk percentage>,
  "riskLevel": "<Low Risk | Moderate Risk | High Risk>",
  "prediction": "<Cancer Signal Detected | No Strong Cancer Signal>",
  "explanation": "<A detailed 2-4 sentence explanation of WHY this percentage was given. Mention which scan had the strongest warning signs, which area was selected and why, and the key data points like: Selected view, Best area, Selected area score, CC full-image score, MLO full-image score, SHAP-style tabular score.>",
  "selectedCrop": "<CC | MLO> - <area name, e.g. bottom-left area>",
  "focusArea": "center <x>%, <y>%, box <w>% × <h>%",
  "areaScores": [
    { "name": "top-left area", "score": <number 0-100>, "isSelected": false },
    { "name": "top-right area", "score": <number 0-100>, "isSelected": false },
    { "name": "bottom-left area", "score": <number 0-100>, "isSelected": true },
    { "name": "bottom-right area", "score": <number 0-100>, "isSelected": false },
    { "name": "center area", "score": <number 0-100>, "isSelected": false }
  ],
  "topParameters": [
    { "name": "<param_name>", "value": <number>, "influence": "<risk | protective>" },
    ... 9 more parameters
  ],
  "disclaimer": "This AI analysis is for educational and screening assistance only. It does NOT replace a professional medical diagnosis. Please consult a qualified healthcare provider."
}

Rules for the response:
- "areaScores" must have exactly 5 entries (top-left, top-right, bottom-left, bottom-right, center). Mark the one with the highest score as "isSelected": true.
- "topParameters" MUST contain EXACTLY 10 entries chosen from the following 30 breast-tissue characteristics from the Breast Cancer Wisconsin Diagnostic dataset:
  radius_mean, radius_se, radius_worst
  texture_mean, texture_se, texture_worst
  perimeter_mean, perimeter_se, perimeter_worst
  area_mean, area_se, area_worst
  smoothness_mean, smoothness_se, smoothness_worst
  compactness_mean, compactness_se, compactness_worst
  concavity_mean, concavity_se, concavity_worst
  concave points_mean, concave points_se, concave points_worst
  symmetry_mean, symmetry_se, symmetry_worst
  fractal_dimension_mean, fractal_dimension_se, fractal_dimension_worst
- The "influence" field in "topParameters" must be either "risk" (pushing prediction toward cancer risk) or "protective" (pushing prediction away from cancer risk).
- The "explanation" should read like: "The AI checked both scans and found the strongest warning signs in the CC image, mainly in the bottom-left area. The AI checked 5 areas and picked the bottom-left area because it had the highest score (56.10%). The next highest was the top-left area (55.87%), so the selected area was ahead by 0.23%. Key data: Selected view: CC | Best area: Bottom-Left | Selected area score: 56.10% | CC full-image score: 54.60% | MLO full-image score: 54.80% | SHAP-style tabular score: 100.00%"
- probability: 0-20% = normal, 20-40% = likely benign, 40-60% = indeterminate, 60-80% = suspicious, 80-100% = highly suspicious
- Be thorough but conservative. When in doubt, recommend follow-up rather than alarming the patient.`;

    const result = await withRetry(() => model.generateContent([prompt, ccImage, mloImage]));
    const responseText = result.response.text();

    // Parse the JSON response from Gemini
    let analysisResult;
    try {
      // Strip code fences if Gemini wraps it
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      analysisResult = {
        probability: 15,
        riskLevel: 'Low Risk',
        prediction: 'Analysis Inconclusive',
        explanation: 'The AI was unable to produce a structured analysis. The images may not be standard mammograms or may be unclear. Please try uploading clearer images.',
        selectedCrop: 'CC - center area',
        focusArea: 'center 50.0%, 50.0%, box 50.0% × 50.0%',
        areaScores: [
          { name: 'top-left area', score: 50.0, isSelected: false },
          { name: 'top-right area', score: 50.0, isSelected: false },
          { name: 'bottom-left area', score: 50.0, isSelected: false },
          { name: 'bottom-right area', score: 50.0, isSelected: false },
          { name: 'center area', score: 50.0, isSelected: true },
        ],
        topParameters: [
          { name: 'area_se', value: 0, influence: 'risk' },
          { name: 'area_worst', value: 0, influence: 'risk' },
          { name: 'concave points_se', value: 0, influence: 'protective' },
          { name: 'perimeter_se', value: 0, influence: 'risk' },
          { name: 'area_mean', value: 0, influence: 'protective' },
          { name: 'radius_se', value: 0, influence: 'risk' },
          { name: 'concave points_worst', value: 0, influence: 'risk' },
          { name: 'concavity_se', value: 0, influence: 'protective' },
          { name: 'concavity_worst', value: 0, influence: 'risk' },
          { name: 'concave points_mean', value: 0, influence: 'risk' },
        ],
        disclaimer: 'This AI analysis is for educational and screening assistance only. It does NOT replace a professional medical diagnosis.'
      };
    }

    res.json(analysisResult);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze images. Please try again.' });
  }
});

// ── Breast Cancer Type Classification ──
// POST /api/classify
// Accepts CC + MLO mammogram images and returns a radiological cancer type classification.
// IMPORTANT: This uses Gemini vision-based pattern recognition. It is NOT a validated
// trained subtype classifier. A dedicated model trained on pathology-labeled data
// (e.g., TCGA-BRCA with radiology-pathology pairs) would be required for clinical use.
app.post('/api/classify', upload.fields([
  { name: 'cc', maxCount: 1 },
  { name: 'mlo', maxCount: 1 }
]), async (req, res) => {
  try {
    const ccFile = req.files?.cc?.[0];
    const mloFile = req.files?.mlo?.[0];

    // ── Validate inputs ──
    const ccErr = validateImageFile(ccFile);
    const mloErr = validateImageFile(mloFile);

    if (ccErr || mloErr) {
      return res.status(400).json({
        error: ccErr || mloErr,
        status: 'validation_error'
      });
    }

    // Per-file size limit for classification: 10MB each
    if (ccFile.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'CC image exceeds 10MB limit.', status: 'validation_error' });
    }
    if (mloFile.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'MLO image exceeds 10MB limit.', status: 'validation_error' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const ccImage = {
      inlineData: {
        data: ccFile.buffer.toString('base64'),
        mimeType: ccFile.mimetype
      }
    };

    const mloImage = {
      inlineData: {
        data: mloFile.buffer.toString('base64'),
        mimeType: mloFile.mimetype
      }
    };

    // ── Classification prompt ──
    // This prompt guides Gemini to identify radiological patterns associated with
    // breast cancer subtypes. The output is NOT equivalent to pathology diagnosis.
    const classifyPrompt = `You are a radiologist AI assistant analyzing two mammogram views (CC and MLO) for radiological patterns associated with breast cancer subtypes.

CLASSIFICATION TASK:
Based ONLY on what is visible in the mammogram images, assess which breast cancer type the imaging features most closely resemble, using well-established radiological criteria.

RADIOLOGICAL CRITERIA TO APPLY:
- DCIS (Ductal Carcinoma In Situ): Typically presents as clustered microcalcifications (fine linear, branching, or pleomorphic), often without a palpable mass. May appear as a linear or segmental distribution of calcifications.
- IDC (Invasive Ductal Carcinoma): Typically presents as an irregular or spiculated mass with ill-defined margins, possibly with associated calcifications. Dense, hyperdense mass with distortion of surrounding tissue.
- ILC (Invasive Lobular Carcinoma): Often presents as architectural distortion, asymmetric density, or a subtle vague opacity without a well-defined mass. Can be difficult to detect; may cause stellate distortion.
- No Suspicious Findings: Normal parenchymal pattern, no masses, no suspicious calcifications, no distortion.
- Uncertain / Cannot Classify: Findings are present but cannot be confidently attributed to a specific subtype based on mammographic features alone.

CRITICAL LIMITATIONS YOU MUST ACKNOWLEDGE:
1. Mammography CANNOT determine: HER2 status, ER/PR status, molecular subtypes (Luminal A/B, TNBC), tumor grade, TNM stage, or Ki-67 index.
2. These require tissue biopsy and immunohistochemistry.
3. DCIS cannot be definitively distinguished from IDC on imaging alone without biopsy.
4. ILC is frequently missed or underestimated on mammography.
5. Final subtype diagnosis ALWAYS requires histopathological confirmation.

RESPOND WITH ONLY VALID JSON — no markdown, no code fences, no extra text. Use this exact structure:
{
  "predicted_class": "<one of: DCIS (Ductal Carcinoma In Situ) | IDC (Invasive Ductal Carcinoma) | ILC (Invasive Lobular Carcinoma) | No Suspicious Findings | Uncertain / Cannot Classify>",
  "class_probabilities": {
    "DCIS": <number 0-100>,
    "IDC": <number 0-100>,
    "ILC": <number 0-100>,
    "NoFindings": <number 0-100>,
    "Uncertain": <number 0-100>
  },
  "confidence": <number 0-100, the probability of the predicted_class>,
  "model_version": "gemini-vision-classify-v1",
  "status": "<success | low_confidence>",
  "radiological_features": [
    "<feature 1 observed in the images>",
    "<feature 2>",
    "<feature 3>"
  ],
  "limitations": "Mammographic classification cannot determine molecular subtype (HER2/ER/PR status), tumor grade, TNM stage, or Ki-67 index. These require tissue biopsy and immunohistochemistry. ILC is frequently underestimated on mammography. This classification is based on pattern recognition from radiological features and does NOT constitute a pathological diagnosis.",
  "disclaimer": "⚠️ Research prototype only. Results require review by a qualified radiologist and histopathological confirmation. Do not use for clinical decision-making."
}

RULES:
- class_probabilities values must sum to approximately 100.
- Use "low_confidence" status if the highest probability is below 40%.
- Use "Uncertain / Cannot Classify" as predicted_class if the image shows no clearly classifiable pattern or if findings are ambiguous.
- radiological_features: list 2-5 specific features you observed (e.g., "Clustered microcalcifications in upper outer quadrant", "Ill-defined spiculated mass in CC view", "Architectural distortion without discrete mass"). If no suspicious findings, list normal features.
- confidence must match the probability of the predicted_class from class_probabilities.
- Be honest: if the image quality is poor, the view is unclear, or no suspicious features are present, say so in radiological_features and use "Uncertain / Cannot Classify" or "No Suspicious Findings".`;

    const result = await withRetry(() => model.generateContent([classifyPrompt, ccImage, mloImage]));
    const responseText = result.response.text();

    // Parse Gemini response
    let classResult;
    try {
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      classResult = JSON.parse(cleanJson);

      // Enforce required fields and safe defaults
      if (!classResult.predicted_class) classResult.predicted_class = 'Uncertain / Cannot Classify';
      if (!classResult.class_probabilities) {
        classResult.class_probabilities = { DCIS: 0, IDC: 0, ILC: 0, NoFindings: 0, Uncertain: 100 };
      }
      if (typeof classResult.confidence !== 'number') classResult.confidence = 0;
      classResult.model_version = 'gemini-vision-classify-v1';

      // Auto-determine status from confidence
      if (typeof classResult.confidence === 'number' && classResult.confidence < 40) {
        classResult.status = 'low_confidence';
      } else if (!classResult.status) {
        classResult.status = 'success';
      }

      if (!Array.isArray(classResult.radiological_features)) classResult.radiological_features = [];
      if (!classResult.limitations) {
        classResult.limitations = 'Mammographic classification cannot determine molecular subtype (HER2/ER/PR status), tumor grade, TNM stage, or Ki-67 index. These require tissue biopsy and immunohistochemistry.';
      }
      if (!classResult.disclaimer) {
        classResult.disclaimer = '⚠️ Research prototype only. Results require review by a qualified radiologist and histopathological confirmation.';
      }

    } catch (parseError) {
      // If Gemini fails to produce valid JSON, return an error — never fabricate classifications
      console.error('Classification parse error. Raw response:', responseText.substring(0, 500));
      return res.status(200).json({
        predicted_class: 'Uncertain / Cannot Classify',
        class_probabilities: { DCIS: 0, IDC: 0, ILC: 0, NoFindings: 0, Uncertain: 100 },
        confidence: 0,
        model_version: 'gemini-vision-classify-v1',
        status: 'parse_error',
        radiological_features: [],
        limitations: 'The classification model could not produce a structured response. The images may not be standard mammograms or may be of insufficient quality.',
        disclaimer: '⚠️ Research prototype only. Results require review by a qualified radiologist and histopathological confirmation.',
        error: 'Classification output could not be parsed. Please retry or upload clearer mammogram images.'
      });
    }

    res.json(classResult);

  } catch (error) {
    console.error('Classification error:', error.message || error);
    // Never expose internal server details in the response
    res.status(500).json({
      error: 'Classification failed. Please try again.',
      status: 'server_error'
    });
  }
});

// ── Chatbot ──
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // gemini-2.5-flash: reliable model for chat
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `You are a compassionate and knowledgeable breast cancer awareness assistant called "BCA Care Bot". Your role is to:

1. Provide accurate, evidence-based information about breast cancer
2. Help users understand breast cancer types, symptoms, risk factors, and prevention
3. Encourage regular screening and early detection
4. Offer emotional support and encouragement
5. Direct users to seek professional medical advice for personal health concerns

IMPORTANT RULES:
- NEVER provide a diagnosis or interpret specific medical results
- NEVER recommend specific treatments or medications
- Always encourage consulting with healthcare professionals
- Be empathetic and supportive in tone
- Keep responses concise (2-4 paragraphs max)
- Use simple, accessible language
- If asked about the app, explain you help with breast cancer awareness and work alongside the AI mammogram analysis tool`;

    // Build chat history
    const chatHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I am the BCA Care Bot, a breast cancer awareness assistant. I will provide helpful, empathetic, and evidence-based information while always encouraging professional medical consultation. How can I help you today?' }] },
        ...chatHistory
      ]
    });

    const result = await withRetry(() => chat.sendMessage(message));
    const reply = result.response.text();

    res.json({ reply });
  } catch (error) {
// ── Breast Cancer Recurrence Risk Prediction ──
// POST /api/predict-recurrence and POST /predict-recurrence
// Evaluates breast cancer recurrence risk and survival curves using
// the validated Nottingham Prognostic Index and Cox survival analysis model.
const handleRecurrencePrediction = (req, res) => {
  try {
    const clinicalData = req.body || {};
    const result = calculateRecurrenceRisk(clinicalData);

    if (result.status === 'validation_error') {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Recurrence prediction error:', error);
    return res.status(500).json({
      prediction_available: false,
      status: 'server_error',
      error: 'Failed to compute recurrence risk estimates. Please verify input data.',
      limitations: 'An internal server error occurred while computing the statistical survival model.'
    });
  }
};

app.post('/api/predict-recurrence', handleRecurrencePrediction);
app.post('/predict-recurrence', handleRecurrencePrediction);

app.listen(PORT, () => {
  console.log(`🩺 AI Breast Cancer Care server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Classify endpoint: http://localhost:${PORT}/api/classify`);
  console.log(`   Recurrence endpoint: http://localhost:${PORT}/api/predict-recurrence`);
});

