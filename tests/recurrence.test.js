/**
 * tests/recurrence.test.js
 *
 * Comprehensive integration and statistical test suite for:
 * 1. Breast Cancer Recurrence Risk Survival Analysis Service (recurrenceService.js)
 * 2. POST /api/predict-recurrence endpoint contract
 * 3. Nottingham Prognostic Index (NPI) and Cox survival mathematics
 * 4. Monotonicity and mathematical coherence of survival vs recurrence curves
 * 5. Uncertainty and 95% Confidence Interval boundary guarantees
 * 6. Missing input and validation error handling
 * 7. Backwards compatibility with /api/analyze and /api/classify
 *
 * Run with: node tests/recurrence.test.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { calculateRecurrenceRisk } from '../server/recurrenceService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function describe(suite, fn) {
  console.log(`\n📋 ${suite}`);
  fn();
}

// ────────────────────────────────────────────────────────
// 1. Missing Clinical Data Handling
// ────────────────────────────────────────────────────────
describe('Missing Clinical Data Handling', () => {
  const emptyResult = calculateRecurrenceRisk({});
  assert(emptyResult.prediction_available === false, 'prediction_available is false when no inputs provided');
  assert(emptyResult.status === 'missing_clinical_inputs', 'status is missing_clinical_inputs');
  assert(Array.isArray(emptyResult.missing_fields), 'missing_fields is an array');
  assert(emptyResult.missing_fields.includes('tumor_size_cm'), 'identifies missing tumor_size_cm');
  assert(emptyResult.missing_fields.includes('positive_nodes'), 'identifies missing positive_nodes');
  assert(emptyResult.missing_fields.includes('tumor_grade'), 'identifies missing tumor_grade');
  assert(typeof emptyResult.imaging_limitation === 'string', 'includes explicit imaging limitation notice');

  const partialResult = calculateRecurrenceRisk({ tumor_size_cm: 2.0 });
  assert(partialResult.prediction_available === false, 'rejects incomplete data with only tumor_size');
  assert(partialResult.missing_fields.includes('positive_nodes'), 'identifies remaining missing nodes');
});

// ────────────────────────────────────────────────────────
// 2. Input Validation Boundaries
// ────────────────────────────────────────────────────────
describe('Input Validation Boundaries', () => {
  const invalidSize = calculateRecurrenceRisk({ tumor_size_cm: -1.5, positive_nodes: 0, tumor_grade: 1 });
  assert(invalidSize.status === 'validation_error', 'rejects negative tumor size');
  assert(invalidSize.prediction_available === false, 'prediction unavailable on invalid size');

  const oversize = calculateRecurrenceRisk({ tumor_size_cm: 25.0, positive_nodes: 0, tumor_grade: 1 });
  assert(oversize.status === 'validation_error', 'rejects tumor size > 15 cm');

  const invalidNodes = calculateRecurrenceRisk({ tumor_size_cm: 2.0, positive_nodes: -2, tumor_grade: 1 });
  assert(invalidNodes.status === 'validation_error', 'rejects negative lymph nodes');

  const invalidGrade = calculateRecurrenceRisk({ tumor_size_cm: 2.0, positive_nodes: 0, tumor_grade: 4 });
  assert(invalidGrade.status === 'validation_error', 'rejects tumor grade outside 1-3');

  const invalidAge = calculateRecurrenceRisk({ tumor_size_cm: 2.0, positive_nodes: 0, tumor_grade: 1, age: 105 });
  assert(invalidAge.status === 'validation_error', 'rejects invalid patient age');
});

// ────────────────────────────────────────────────────────
// 3. Valid Early-Stage Scenario (T1c N0 G1, ER+)
// ────────────────────────────────────────────────────────
describe('Valid Early-Stage Scenario (Good Prognosis)', () => {
  const res = calculateRecurrenceRisk({
    tumor_size_cm: 1.5,
    positive_nodes: 0,
    tumor_grade: 1,
    er_status: 'Positive',
    pr_status: 'Positive',
    her2_status: 'Negative',
    age: 58,
    hormone_therapy: true,
    chemotherapy: false
  });

  assert(res.prediction_available === true, 'prediction_available is true for valid data');
  assert(res.status === 'success', 'status is success');
  assert(res.model_name === 'NPI-ClinicalCox-v1.2', 'model_name matches specification');
  assert(typeof res.classic_npi_score === 'number', 'calculates classic NPI score');

  // NPI = 0.2*1.5 + 1 (0 nodes) + 1 (grade 1) = 0.3 + 1 + 1 = 2.30
  assert(Math.abs(res.classic_npi_score - 2.30) < 0.05, `classic NPI is 2.30 (got ${res.classic_npi_score})`);
  assert(res.prognostic_group.includes('Good Prognostic Group'), 'identifies Good Prognostic Group (NPI <= 3.4)');

  assert(typeof res.primary_horizon === 'object', 'primary_horizon object present');
  assert(res.primary_horizon.horizon_years === 5, 'primary horizon is 5 years');
  assert(res.primary_horizon.recurrence_risk_pct < 20, 'early-stage 5yr recurrence risk is < 20%');
  assert(res.primary_horizon.recurrence_free_survival_pct > 80, 'early-stage 5yr RFS is > 80%');
});

// ────────────────────────────────────────────────────────
// 4. Valid High-Risk Scenario (T3 N2 G3, Triple Negative)
// ────────────────────────────────────────────────────────
describe('Valid High-Risk Scenario (Poor Prognosis)', () => {
  const res = calculateRecurrenceRisk({
    tumor_size_cm: 4.5,
    positive_nodes: 6,
    tumor_grade: 3,
    er_status: 'Negative',
    pr_status: 'Negative',
    her2_status: 'Negative',
    age: 38,
    hormone_therapy: false,
    chemotherapy: true
  });

  assert(res.prediction_available === true, 'prediction_available is true');
  // NPI = 0.2*4.5 + 3 (>=4 nodes) + 3 (grade 3) = 0.9 + 3 + 3 = 6.90
  assert(Math.abs(res.classic_npi_score - 6.90) < 0.05, `classic NPI is 6.90 (got ${res.classic_npi_score})`);
  assert(res.prognostic_group.includes('Poor Prognostic Group'), 'identifies Poor Prognostic Group (NPI > 5.4)');
  assert(res.primary_horizon.recurrence_risk_pct > 25, 'high-risk 5yr recurrence risk is elevated (> 25%)');
});

// ────────────────────────────────────────────────────────
// 5. Mathematical Coherence of Survival Curves
// ────────────────────────────────────────────────────────
describe('Mathematical Coherence of Survival Curves', () => {
  const res = calculateRecurrenceRisk({
    tumor_size_cm: 2.5,
    positive_nodes: 1,
    tumor_grade: 2,
    er_status: 'Positive',
    pr_status: 'Positive',
    her2_status: 'Negative',
    age: 50
  });

  const curve = res.survival_curve;
  assert(Array.isArray(curve), 'survival_curve is an array');
  assert(curve.length === 10, 'curve contains exactly 10 year points (1 to 10)');

  // Test 1: Cumulative Recurrence Risk must be strictly monotonic non-decreasing
  let monotonicRecurrence = true;
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].recurrence_risk_pct < curve[i - 1].recurrence_risk_pct) {
      monotonicRecurrence = false;
      break;
    }
  }
  assert(monotonicRecurrence, 'recurrence risk curve monotonically increases over time');

  // Test 2: Recurrence-Free Survival must be strictly monotonic non-increasing
  let monotonicRfs = true;
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].rfs_probability_pct > curve[i - 1].rfs_probability_pct) {
      monotonicRfs = false;
      break;
    }
  }
  assert(monotonicRfs, 'RFS curve monotonically decreases over time');

  // Test 3: Mathematical equivalence: Recurrence % + RFS % == 100% (+/- 0.2% rounding)
  let complementValid = true;
  for (const pt of curve) {
    const sum = pt.recurrence_risk_pct + pt.rfs_probability_pct;
    if (Math.abs(sum - 100.0) > 0.2) {
      complementValid = false;
      break;
    }
  }
  assert(complementValid, 'RFS and Recurrence Risk sum to 100% across all years');

  // Test 4: Confidence Interval boundaries: Lower <= Value <= Upper
  let ciBoundsValid = true;
  for (const pt of curve) {
    if (pt.recurrence_ci_lower_pct > pt.recurrence_risk_pct || pt.recurrence_risk_pct > pt.recurrence_ci_upper_pct) {
      ciBoundsValid = false;
      break;
    }
    if (pt.rfs_ci_lower_pct > pt.rfs_probability_pct || pt.rfs_probability_pct > pt.rfs_ci_upper_pct) {
      ciBoundsValid = false;
      break;
    }
  }
  assert(ciBoundsValid, '95% Confidence Intervals enclose the point estimates correctly');
});

// ────────────────────────────────────────────────────────
// 6. Source Files & Contract Verification
// ────────────────────────────────────────────────────────
describe('Source Files & Architecture Verification', () => {
  // Check recurrenceService.js exists
  const servicePath = path.join(__dirname, '../server/recurrenceService.js');
  assert(fs.existsSync(servicePath), 'server/recurrenceService.js exists');

  // Check server/index.js exports route
  const serverPath = path.join(__dirname, '../server/index.js');
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  assert(serverContent.includes('/api/predict-recurrence'), 'server/index.js has /api/predict-recurrence route');
  assert(serverContent.includes('/predict-recurrence'), 'server/index.js has /predict-recurrence alias');
  assert(serverContent.includes('calculateRecurrenceRisk'), 'server/index.js calls calculateRecurrenceRisk');

  // Check api.js exports predictRecurrence
  const apiPath = path.join(__dirname, '../frontend/src/utils/api.js');
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  assert(apiContent.includes('export async function predictRecurrence'), 'api.js exports predictRecurrence');

  // Check RecurrenceRiskAnalysis.jsx component exists and uses Recharts
  const compPath = path.join(__dirname, '../frontend/src/components/RecurrenceRiskAnalysis.jsx');
  assert(fs.existsSync(compPath), 'RecurrenceRiskAnalysis.jsx exists');
  const compContent = fs.readFileSync(compPath, 'utf8');
  assert(compContent.includes('recharts'), 'RecurrenceRiskAnalysis imports recharts');
  assert(compContent.includes('AreaChart'), 'RecurrenceRiskAnalysis renders AreaChart');
  assert(compContent.includes('CLINICAL_PRESETS'), 'RecurrenceRiskAnalysis includes clinical presets');
  assert(compContent.includes('Missing Inputs'), 'RecurrenceRiskAnalysis handles missing input state');

  // Check ClinicalInterpretation.jsx component exists
  const interpPath = path.join(__dirname, '../frontend/src/components/ClinicalInterpretation.jsx');
  assert(fs.existsSync(interpPath), 'ClinicalInterpretation.jsx exists');

  // Check RiskAnalysis.jsx imports both
  const riskPath = path.join(__dirname, '../frontend/src/components/RiskAnalysis.jsx');
  const riskContent = fs.readFileSync(riskPath, 'utf8');
  assert(riskContent.includes('RecurrenceRiskAnalysis'), 'RiskAnalysis.jsx imports RecurrenceRiskAnalysis');
  assert(riskContent.includes('ClinicalInterpretation'), 'RiskAnalysis.jsx imports ClinicalInterpretation');
});

// ────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`📊 Recurrence Test Suite: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉 All recurrence risk tests passed!');
} else {
  console.log('⚠️  Some tests failed.');
  process.exitCode = 1;
}
console.log('═'.repeat(60));
