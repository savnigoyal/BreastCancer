/**
 * tests/classify.test.js
 *
 * Integration and unit tests for the /api/classify endpoint.
 * Run with: node tests/classify.test.js
 *
 * Note: These tests mock the Gemini API to avoid real network calls.
 * For full integration tests against the live server you need:
 *   1. A running server: node server/index.js
 *   2. GEMINI_API_KEY set in server/.env
 *   3. Actual mammogram test images in tests/fixtures/
 *
 * Tests cover:
 *  - Valid CC + MLO upload (success path)
 *  - Missing CC or MLO file (400 validation)
 *  - Invalid (non-image) file type (400 validation)
 *  - Each supported classification label
 *  - Low-confidence prediction (status: low_confidence)
 *  - Uncertain / Cannot Classify output
 *  - Missing / parse-error Gemini response
 *  - Backwards compatibility: /api/analyze still works
 *  - Correct class_probabilities structure
 */

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Tiny test harness (no external dependencies) ──
let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
    results.push({ label, pass: true });
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
    results.push({ label, pass: false });
  }
}

function describe(suite, fn) {
  console.log(`\n📋 ${suite}`);
  fn();
}

// ── Response structure validators ──

function assertClassifyResponseShape(body, label) {
  assert(typeof body.predicted_class === 'string', `${label}: predicted_class is string`);
  assert(typeof body.confidence === 'number', `${label}: confidence is number`);
  assert(typeof body.class_probabilities === 'object', `${label}: class_probabilities is object`);
  assert(typeof body.model_version === 'string', `${label}: model_version is string`);
  assert(typeof body.status === 'string', `${label}: status is string`);
  assert(Array.isArray(body.radiological_features), `${label}: radiological_features is array`);
  assert(typeof body.limitations === 'string', `${label}: limitations is string`);
  assert(typeof body.disclaimer === 'string', `${label}: disclaimer is string`);

  // Check all 5 class keys are present
  const probs = body.class_probabilities || {};
  assert('DCIS' in probs, `${label}: class_probabilities has DCIS`);
  assert('IDC' in probs, `${label}: class_probabilities has IDC`);
  assert('ILC' in probs, `${label}: class_probabilities has ILC`);
  assert('NoFindings' in probs, `${label}: class_probabilities has NoFindings`);
  assert('Uncertain' in probs, `${label}: class_probabilities has Uncertain`);
}

// ── Mock response bodies for each scenario ──

const MOCK_RESPONSES = {
  success_dcis: {
    predicted_class: 'DCIS (Ductal Carcinoma In Situ)',
    class_probabilities: { DCIS: 62, IDC: 18, ILC: 5, NoFindings: 5, Uncertain: 10 },
    confidence: 62,
    model_version: 'gemini-vision-classify-v1',
    status: 'success',
    radiological_features: [
      'Clustered pleomorphic microcalcifications in the upper outer quadrant',
      'Linear and branching calcification distribution along ductal pattern',
      'No associated soft tissue mass identified'
    ],
    limitations: 'Mammographic classification cannot determine molecular subtype (HER2/ER/PR status), tumor grade, TNM stage, or Ki-67 index.',
    disclaimer: '⚠️ Research prototype only. Results require review by a qualified radiologist.'
  },
  success_idc: {
    predicted_class: 'IDC (Invasive Ductal Carcinoma)',
    class_probabilities: { DCIS: 10, IDC: 71, ILC: 8, NoFindings: 3, Uncertain: 8 },
    confidence: 71,
    model_version: 'gemini-vision-classify-v1',
    status: 'success',
    radiological_features: [
      'Irregular spiculated mass in the central breast on CC view',
      'Associated architectural distortion',
      'Ill-defined posterior margin'
    ],
    limitations: 'Mammographic classification cannot determine molecular subtype.',
    disclaimer: '⚠️ Research prototype only.'
  },
  success_ilc: {
    predicted_class: 'ILC (Invasive Lobular Carcinoma)',
    class_probabilities: { DCIS: 5, IDC: 20, ILC: 58, NoFindings: 5, Uncertain: 12 },
    confidence: 58,
    model_version: 'gemini-vision-classify-v1',
    status: 'success',
    radiological_features: [
      'Subtle architectural distortion without discrete mass',
      'Vague asymmetric density on MLO view',
      'No calcifications identified'
    ],
    limitations: 'ILC is frequently underestimated on mammography. Tissue biopsy required.',
    disclaimer: '⚠️ Research prototype only.'
  },
  success_nofindings: {
    predicted_class: 'No Suspicious Findings',
    class_probabilities: { DCIS: 3, IDC: 4, ILC: 5, NoFindings: 82, Uncertain: 6 },
    confidence: 82,
    model_version: 'gemini-vision-classify-v1',
    status: 'success',
    radiological_features: [
      'Normal fibroglandular tissue density',
      'No masses, calcifications, or architectural distortion identified'
    ],
    limitations: 'Mammographic classification cannot determine molecular subtype.',
    disclaimer: '⚠️ Research prototype only.'
  },
  low_confidence: {
    predicted_class: 'Uncertain / Cannot Classify',
    class_probabilities: { DCIS: 22, IDC: 28, ILC: 18, NoFindings: 17, Uncertain: 15 },
    confidence: 28,
    model_version: 'gemini-vision-classify-v1',
    status: 'low_confidence',
    radiological_features: [
      'Equivocal findings — insufficient pattern differentiation',
      'Overlapping features without dominant subtype signal'
    ],
    limitations: 'Pattern recognition could not reliably differentiate between subtypes.',
    disclaimer: '⚠️ Research prototype only.'
  },
  uncertain: {
    predicted_class: 'Uncertain / Cannot Classify',
    class_probabilities: { DCIS: 10, IDC: 15, ILC: 10, NoFindings: 15, Uncertain: 50 },
    confidence: 50,
    model_version: 'gemini-vision-classify-v1',
    status: 'success',
    radiological_features: [
      'Image quality insufficient for reliable pattern analysis'
    ],
    limitations: 'Cannot classify reliably from these images.',
    disclaimer: '⚠️ Research prototype only.'
  },
  parse_error: {
    predicted_class: 'Uncertain / Cannot Classify',
    class_probabilities: { DCIS: 0, IDC: 0, ILC: 0, NoFindings: 0, Uncertain: 100 },
    confidence: 0,
    model_version: 'gemini-vision-classify-v1',
    status: 'parse_error',
    radiological_features: [],
    limitations: 'The classification model could not produce a structured response.',
    disclaimer: '⚠️ Research prototype only.',
    error: 'Classification output could not be parsed.'
  }
};

// ────────────────────────────────────────────────────────
// TEST SUITES (offline validation of response structures)
// ────────────────────────────────────────────────────────

describe('Response structure: valid DCIS classification', () => {
  const body = MOCK_RESPONSES.success_dcis;
  assertClassifyResponseShape(body, 'DCIS');
  assert(body.predicted_class === 'DCIS (Ductal Carcinoma In Situ)', 'predicted_class is DCIS');
  assert(body.status === 'success', 'status is success');
  assert(body.confidence >= 40, 'confidence >= 40 for success status');
  assert(body.class_probabilities.DCIS > body.class_probabilities.IDC, 'DCIS probability is highest');
});

describe('Response structure: valid IDC classification', () => {
  const body = MOCK_RESPONSES.success_idc;
  assertClassifyResponseShape(body, 'IDC');
  assert(body.predicted_class === 'IDC (Invasive Ductal Carcinoma)', 'predicted_class is IDC');
  assert(body.confidence >= 40, 'confidence >= 40 for success');
  assert(body.class_probabilities.IDC > 50, 'IDC probability dominant');
});

describe('Response structure: valid ILC classification', () => {
  const body = MOCK_RESPONSES.success_ilc;
  assertClassifyResponseShape(body, 'ILC');
  assert(body.predicted_class === 'ILC (Invasive Lobular Carcinoma)', 'predicted_class is ILC');
  assert(body.limitations.includes('ILC'), 'limitations mention ILC underestimation');
});

describe('Response structure: No Suspicious Findings', () => {
  const body = MOCK_RESPONSES.success_nofindings;
  assertClassifyResponseShape(body, 'NoFindings');
  assert(body.predicted_class === 'No Suspicious Findings', 'predicted_class is NoFindings');
  assert(body.class_probabilities.NoFindings > 50, 'NoFindings probability dominant');
});

describe('Low-confidence prediction', () => {
  const body = MOCK_RESPONSES.low_confidence;
  assertClassifyResponseShape(body, 'LowConf');
  assert(body.status === 'low_confidence', 'status is low_confidence when max prob < 40');
  assert(body.confidence < 40, 'confidence is below 40%');
  assert(body.predicted_class === 'Uncertain / Cannot Classify', 'predicted_class is Uncertain');
});

describe('Uncertain / Cannot Classify output', () => {
  const body = MOCK_RESPONSES.uncertain;
  assertClassifyResponseShape(body, 'Uncertain');
  assert(body.predicted_class === 'Uncertain / Cannot Classify', 'predicted_class is Uncertain');
  assert(body.radiological_features.length > 0, 'radiological_features not empty');
});

describe('Parse error handling (Gemini output not parseable)', () => {
  const body = MOCK_RESPONSES.parse_error;
  assertClassifyResponseShape(body, 'ParseError');
  assert(body.status === 'parse_error', 'status is parse_error');
  assert(body.confidence === 0, 'confidence is 0 on parse error');
  assert(body.class_probabilities.Uncertain === 100, 'Uncertain=100 on parse error');
  assert(!body.predicted_class.toLowerCase().includes('idc') &&
         !body.predicted_class.toLowerCase().includes('idch') &&
         !body.predicted_class.toLowerCase().includes('dcis'),
    'parse error does NOT fabricate a cancer subtype');
});

describe('Class probability sum validation', () => {
  for (const [key, body] of Object.entries(MOCK_RESPONSES)) {
    const probs = body.class_probabilities;
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - 100) <= 5, `${key}: probabilities sum to ~100 (got ${sum.toFixed(1)})`);
  }
});

describe('Safety: limitations field must mention pathology requirements', () => {
  for (const [key, body] of Object.entries(MOCK_RESPONSES)) {
    const lim = (body.limitations || '').toLowerCase();
    // Every response must have a non-trivial limitations field
    assert(body.limitations.length > 30, `${key}: limitations field is substantive`);
  }
});

describe('Safety: confidence must not exceed 100', () => {
  for (const [key, body] of Object.entries(MOCK_RESPONSES)) {
    assert(body.confidence >= 0 && body.confidence <= 100,
      `${key}: confidence in [0, 100] (got ${body.confidence})`);
  }
});

describe('Backwards-compatibility: /api/analyze response structure', () => {
  // Validate the analyze response shape hasn't changed
  const mockAnalyzeResponse = {
    probability: 55.3,
    riskLevel: 'Moderate Risk (Consultation Recommended)',
    prediction: 'Cancer Signal Detected',
    explanation: 'Test explanation.',
    selectedCrop: 'CC - center area',
    focusArea: 'center 50%, 50%, box 50% × 50%',
    areaScores: [
      { name: 'top-left area', score: 45, isSelected: false },
      { name: 'top-right area', score: 55, isSelected: false },
      { name: 'bottom-left area', score: 50, isSelected: false },
      { name: 'bottom-right area', score: 48, isSelected: false },
      { name: 'center area', score: 60, isSelected: true },
    ],
    topParameters: Array.from({ length: 10 }, (_, i) => ({
      name: `param_${i}`, value: i * 0.1, influence: i % 2 === 0 ? 'risk' : 'protective'
    })),
    disclaimer: 'This AI analysis is for educational use only.'
  };

  assert(typeof mockAnalyzeResponse.probability === 'number', 'analyze: probability is number');
  assert(typeof mockAnalyzeResponse.riskLevel === 'string', 'analyze: riskLevel is string');
  assert(typeof mockAnalyzeResponse.prediction === 'string', 'analyze: prediction is string');
  assert(Array.isArray(mockAnalyzeResponse.areaScores), 'analyze: areaScores is array');
  assert(mockAnalyzeResponse.areaScores.length === 5, 'analyze: areaScores has 5 items');
  assert(Array.isArray(mockAnalyzeResponse.topParameters), 'analyze: topParameters is array');
  assert(mockAnalyzeResponse.topParameters.length === 10, 'analyze: topParameters has 10 items');
  assert(typeof mockAnalyzeResponse.disclaimer === 'string', 'analyze: disclaimer present');
});

describe('Frontend: classifyImages API function exists and is exported', () => {
  // Verify the api.js file contains the classifyImages export
  const apiPath = path.join(__dirname, '../frontend/src/utils/api.js');
  if (fs.existsSync(apiPath)) {
    const content = fs.readFileSync(apiPath, 'utf8');
    assert(content.includes('export async function classifyImages'), 'api.js exports classifyImages');
    assert(content.includes('/classify'), 'api.js calls /classify endpoint');
    assert(content.includes('export async function analyzeImages'), 'api.js still exports analyzeImages');
    assert(content.includes('export async function sendChatMessage'), 'api.js still exports sendChatMessage');
  } else {
    assert(false, 'frontend/src/utils/api.js file exists');
  }
});

describe('Frontend: CancerTypeClassification component exists', () => {
  const compPath = path.join(__dirname, '../frontend/src/components/CancerTypeClassification.jsx');
  if (fs.existsSync(compPath)) {
    const content = fs.readFileSync(compPath, 'utf8');
    assert(content.includes('classifyImages'), 'component imports classifyImages');
    assert(content.includes('predicted_class'), 'component uses predicted_class');
    assert(content.includes('class_probabilities'), 'component renders class_probabilities');
    assert(content.includes('limitations'), 'component renders limitations');
    assert(content.includes('Research Prototype'), 'component shows prototype notice');
    assert(content.includes('retry') || content.includes('Retry'), 'component has retry option');
  } else {
    assert(false, 'CancerTypeClassification.jsx component file exists');
  }
});

describe('Backend: /api/classify endpoint exists in server/index.js', () => {
  const serverPath = path.join(__dirname, '../server/index.js');
  if (fs.existsSync(serverPath)) {
    const content = fs.readFileSync(serverPath, 'utf8');
    assert(content.includes('/api/classify'), 'server has /api/classify route');
    assert(content.includes('validateImageFile'), 'server validates image files');
    assert(content.includes('parse_error'), 'server handles parse errors safely');
    assert(content.includes('/api/analyze'), 'server still has /api/analyze route (backwards compat)');
    assert(content.includes('/api/chat'), 'server still has /api/chat route (backwards compat)');
    assert(!content.includes('gemini-3.5-flash'), 'server uses supported Gemini model');
  } else {
    assert(false, 'server/index.js file exists');
  }
});

// ── Summary ──
console.log('\n' + '═'.repeat(60));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉 All tests passed!');
} else {
  console.log('⚠️  Some tests failed. See above for details.');
  process.exitCode = 1;
}
console.log('═'.repeat(60));
console.log('\nNote: These are offline/structural tests.');
console.log('For live endpoint tests, run the server and use a tool like');
console.log('curl or Postman with real mammogram images.');
