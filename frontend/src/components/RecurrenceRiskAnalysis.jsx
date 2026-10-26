import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { predictRecurrence } from '../utils/api';

/**
 * RecurrenceRiskAnalysis Component
 *
 * Provides evidence-based breast cancer recurrence risk and survival analysis
 * using the validated Nottingham Prognostic Index (NPI) and Cox Proportional
 * Hazards survival modeling calibrated on 10-year follow-up cohorts.
 *
 * CRITICAL MEDICAL SAFETY REQUIREMENTS:
 * - Mammogram imaging alone cannot determine recurrence risk.
 * - Recurrence estimates require histopathological and biomarker inputs.
 * - Cumulative recurrence risk and recurrence-free survival (RFS) are mathematically
 *   distinguished and clearly labeled.
 * - Curves are generated exclusively from statistical survival equations, never mock drawings.
 */

const CLINICAL_PRESETS = [
  {
    label: 'Early-Stage ER+ (T1c N0 G1)',
    data: {
      tumor_size_cm: 1.5,
      positive_nodes: 0,
      tumor_grade: 1,
      er_status: 'Positive',
      pr_status: 'Positive',
      her2_status: 'Negative',
      age: 58,
      hormone_therapy: true,
      chemotherapy: false
    }
  },
  {
    label: 'Moderate-Risk Luminal B (T2 N1 G2)',
    data: {
      tumor_size_cm: 2.8,
      positive_nodes: 2,
      tumor_grade: 2,
      er_status: 'Positive',
      pr_status: 'Negative',
      her2_status: 'Negative',
      age: 52,
      hormone_therapy: true,
      chemotherapy: true
    }
  },
  {
    label: 'High-Risk Triple Negative (T2 N2 G3)',
    data: {
      tumor_size_cm: 3.2,
      positive_nodes: 4,
      tumor_grade: 3,
      er_status: 'Negative',
      pr_status: 'Negative',
      her2_status: 'Negative',
      age: 44,
      hormone_therapy: false,
      chemotherapy: true
    }
  }
];

export default function RecurrenceRiskAnalysis() {
  const [formData, setFormData] = useState({
    tumor_size_cm: '',
    positive_nodes: '',
    tumor_grade: '2',
    er_status: 'Positive',
    pr_status: 'Positive',
    her2_status: 'Negative',
    age: '',
    hormone_therapy: true,
    chemotherapy: false
  });

  const [activeMetric, setActiveMetric] = useState('recurrence'); // 'recurrence' | 'rfs'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showInputForm, setShowInputForm] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const applyPreset = (presetData) => {
    setFormData(presetData);
    setShowInputForm(true);
  };

  const handleCalculate = useCallback(async (customData) => {
    const dataToSend = customData || formData;
    setLoading(true);
    setError(null);

    try {
      const data = await predictRecurrence(dataToSend);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Recurrence prediction failed. Please verify clinical inputs.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [formData]);

  // Initial load: test with baseline to determine if inputs are missing
  useEffect(() => {
    // Check initial state
    predictRecurrence({})
      .then(initialResp => {
        setResult(initialResp);
      })
      .catch(() => {
        // Safe initial missing-input state
        setResult({
          prediction_available: false,
          status: 'missing_clinical_inputs',
          message: 'Recurrence risk prediction requires confirmed histopathological inputs.'
        });
      });
  }, []);

  // Format Recharts tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="recurrence-chart-tooltip">
          <p className="tooltip-title">📅 Year {label} Post-Treatment</p>
          <div className="tooltip-item">
            <span className="tooltip-bullet" style={{ background: '#d81b60' }} />
            <span>Cumulative Recurrence: <strong>{dataPoint.recurrence_risk_pct}%</strong></span>
          </div>
          <div className="tooltip-sub">
            95% CI: [{dataPoint.recurrence_ci_lower_pct}% – {dataPoint.recurrence_ci_upper_pct}%]
          </div>
          <div className="tooltip-item" style={{ marginTop: 6 }}>
            <span className="tooltip-bullet" style={{ background: '#1e88e5' }} />
            <span>Recurrence-Free Survival: <strong>{dataPoint.rfs_probability_pct}%</strong></span>
          </div>
          <div className="tooltip-sub">
            95% CI: [{dataPoint.rfs_ci_lower_pct}% – {dataPoint.rfs_ci_upper_pct}%]
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="recurrence-card" id="recurrence-analysis">
      {/* ── Section Header ── */}
      <div className="recurrence-card__header">
        <span className="recurrence-card__icon">📈</span>
        <div>
          <h3 className="recurrence-card__title">Breast Cancer Recurrence Risk Analysis</h3>
          <p className="recurrence-card__subtitle">
            Long-term prognosis and recurrence-free survival modeling based on validated clinical histopathology
          </p>
        </div>
      </div>

      {/* ── State: Prediction Unavailable / Missing Inputs ── */}
      {result && !result.prediction_available && (
        <div className="recurrence-notice recurrence-notice--warn">
          <div className="recurrence-notice__title">
            ⚠️ Clinical Pathology Inputs Required
          </div>
          <p className="recurrence-notice__body">
            <strong>Mammogram imaging alone cannot determine recurrence risk.</strong> Mammogram scans reveal
            anatomical densities, calcification clusters, and mass margins, but recurrence biology fundamentally
            depends on surgical tumor size, axillary lymph node involvement, histological grade, and hormonal receptor status (ER/PR/HER2).
          </p>
          <p className="recurrence-notice__sub">
            To generate a validated 10-year recurrence and survival trajectory, please provide the patient’s histopathology values or select a standard clinical reference scenario below.
          </p>

          {/* Quick preset selector */}
          <div className="recurrence-presets">
            <span className="recurrence-presets__label">Test with standard clinical scenarios:</span>
            <div className="recurrence-presets__btns">
              {CLINICAL_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  className="preset-btn"
                  onClick={() => {
                    applyPreset(preset.data);
                    handleCalculate(preset.data);
                  }}
                >
                  ⚡ {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Input Toggle / Clinical Data Drawer ── */}
      <div className="recurrence-form-toggle">
        <button
          className="form-toggle-btn"
          onClick={() => setShowInputForm(prev => !prev)}
        >
          {showInputForm ? '▲ Hide Histopathology Input Form' : '▼ Enter / Edit Clinical Histopathology Data'}
        </button>
      </div>

      {showInputForm && (
        <form
          className="recurrence-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCalculate();
          }}
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Tumor Diameter (cm) *</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="15"
                placeholder="e.g. 2.1"
                value={formData.tumor_size_cm}
                onChange={(e) => handleInputChange('tumor_size_cm', e.target.value)}
                required
              />
              <span className="field-hint">Invasive tumor size (0.1 - 15.0 cm)</span>
            </div>

            <div className="form-group">
              <label>Positive Axillary Nodes *</label>
              <input
                type="number"
                min="0"
                max="50"
                placeholder="e.g. 0"
                value={formData.positive_nodes}
                onChange={(e) => handleInputChange('positive_nodes', e.target.value)}
                required
              />
              <span className="field-hint">Number of histologically positive nodes</span>
            </div>

            <div className="form-group">
              <label>Nottingham Histological Grade *</label>
              <select
                value={formData.tumor_grade}
                onChange={(e) => handleInputChange('tumor_grade', e.target.value)}
              >
                <option value="1">Grade 1 (Well differentiated)</option>
                <option value="2">Grade 2 (Moderately differentiated)</option>
                <option value="3">Grade 3 (Poorly differentiated)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Estrogen Receptor (ER)</label>
              <select
                value={formData.er_status}
                onChange={(e) => handleInputChange('er_status', e.target.value)}
              >
                <option value="Positive">Positive (ER+)</option>
                <option value="Negative">Negative (ER-)</option>
                <option value="Unknown">Unknown / Pending</option>
              </select>
            </div>

            <div className="form-group">
              <label>Progesterone Receptor (PR)</label>
              <select
                value={formData.pr_status}
                onChange={(e) => handleInputChange('pr_status', e.target.value)}
              >
                <option value="Positive">Positive (PR+)</option>
                <option value="Negative">Negative (PR-)</option>
                <option value="Unknown">Unknown / Pending</option>
              </select>
            </div>

            <div className="form-group">
              <label>HER2 Receptor Status</label>
              <select
                value={formData.her2_status}
                onChange={(e) => handleInputChange('her2_status', e.target.value)}
              >
                <option value="Negative">Negative (HER2-)</option>
                <option value="Positive">Positive (HER2+)</option>
                <option value="Unknown">Unknown / Pending</option>
              </select>
            </div>

            <div className="form-group">
              <label>Patient Age (years)</label>
              <input
                type="number"
                min="18"
                max="100"
                placeholder="e.g. 54"
                value={formData.age}
                onChange={(e) => handleInputChange('age', e.target.value)}
              />
            </div>

            <div className="form-group checkboxes-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.hormone_therapy}
                  onChange={(e) => handleInputChange('hormone_therapy', e.target.checked)}
                />
                Endocrine Therapy (e.g. Tamoxifen/AI)
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.chemotherapy}
                  onChange={(e) => handleInputChange('chemotherapy', e.target.checked)}
                />
                Adjuvant Chemotherapy
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="calculate-btn" disabled={loading}>
              {loading ? '⏳ Calculating Survival Statistics...' : '🔬 Calculate Recurrence & Survival Trajectory'}
            </button>
          </div>
        </form>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="recurrence-notice recurrence-notice--error">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* ── Successful Recurrence Prediction Results ── */}
      {result && result.prediction_available && (
        <div className="recurrence-results">
          {/* ── Summary Card ── */}
          <div className="recurrence-summary-grid">
            {/* 5-Year Horizon */}
            <div className="summary-metric-card summary-metric-card--primary">
              <div className="summary-metric-label">5-Year Cumulative Recurrence Risk</div>
              <div className="summary-metric-value">
                {result.primary_horizon?.recurrence_risk_pct}%
              </div>
              <div className="summary-metric-ci">
                95% CI: [{result.primary_horizon?.confidence_interval_95?.lower_pct}% – {result.primary_horizon?.confidence_interval_95?.upper_pct}%]
              </div>
              <div className="summary-metric-sub">
                Corresponding 5-Year RFS: <strong>{result.primary_horizon?.recurrence_free_survival_pct}%</strong>
              </div>
            </div>

            {/* 10-Year Horizon */}
            <div className="summary-metric-card">
              <div className="summary-metric-label">10-Year Cumulative Recurrence Risk</div>
              <div className="summary-metric-value" style={{ color: '#c2185b' }}>
                {result.ten_year_horizon?.recurrence_risk_pct}%
              </div>
              <div className="summary-metric-ci">
                95% CI: [{result.ten_year_horizon?.confidence_interval_95?.lower_pct}% – {result.ten_year_horizon?.confidence_interval_95?.upper_pct}%]
              </div>
              <div className="summary-metric-sub">
                Corresponding 10-Year RFS: <strong>{result.ten_year_horizon?.recurrence_free_survival_pct}%</strong>
              </div>
            </div>

            {/* Prognostic Index Card */}
            <div className="summary-metric-card">
              <div className="summary-metric-label">Nottingham Prognostic Index (NPI)</div>
              <div className="summary-metric-value" style={{ color: '#4a148c' }}>
                {result.classic_npi_score}
              </div>
              <div className="prognostic-group-badge">
                {result.prognostic_group}
              </div>
              <div className="summary-metric-sub">
                Multivariable Adjusted PI: <strong>{result.prognostic_index}</strong>
              </div>
            </div>
          </div>

          {/* ── Interactive Recurrence Graph ── */}
          <div className="recurrence-chart-container">
            <div className="chart-header-row">
              <div>
                <h4 className="chart-title">
                  {activeMetric === 'recurrence'
                    ? '📈 Cumulative Recurrence Risk Curve (10-Year Follow-up)'
                    : '🛡️ Recurrence-Free Survival Probability Curve (10-Year Follow-up)'}
                </h4>
                <p className="chart-subtitle">
                  Model-generated trajectory with 95% confidence intervals based on Nottingham & EBCTCG cohort calibration
                </p>
              </div>

              {/* Metric Toggle */}
              <div className="metric-toggle-group">
                <button
                  className={`toggle-btn ${activeMetric === 'recurrence' ? 'toggle-btn--active' : ''}`}
                  onClick={() => setActiveMetric('recurrence')}
                >
                  Recurrence Risk (%)
                </button>
                <button
                  className={`toggle-btn ${activeMetric === 'rfs' ? 'toggle-btn--active' : ''}`}
                  onClick={() => setActiveMetric('rfs')}
                >
                  Recurrence-Free Survival (%)
                </button>
              </div>
            </div>

            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={340}>
                {activeMetric === 'recurrence' ? (
                  <AreaChart data={result.survival_curve} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="recurrenceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e91e63" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#e91e63" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff80ab" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ff80ab" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0e6eb" />
                    <XAxis
                      dataKey="year"
                      label={{ value: 'Time Since Diagnosis / Surgery (Years)', position: 'insideBottom', offset: -12, fill: '#666', fontSize: 12 }}
                      stroke="#888"
                    />
                    <YAxis
                      domain={[0, 100]}
                      label={{ value: 'Recurrence Probability (%)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 12 }}
                      stroke="#888"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} />
                    <Area
                      type="monotone"
                      dataKey="recurrence_ci_upper_pct"
                      name="95% CI Upper"
                      stroke="none"
                      fill="url(#ciGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="recurrence_risk_pct"
                      name="Estimated Recurrence Risk (%)"
                      stroke="#d81b60"
                      strokeWidth={3}
                      fill="url(#recurrenceGrad)"
                    />
                    <Line
                      type="monotone"
                      dataKey="recurrence_ci_lower_pct"
                      name="95% CI Lower"
                      stroke="#f48fb1"
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </AreaChart>
                ) : (
                  <AreaChart data={result.survival_curve} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="rfsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e88e5" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#1e88e5" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3f2fd" />
                    <XAxis
                      dataKey="year"
                      label={{ value: 'Time Since Diagnosis / Surgery (Years)', position: 'insideBottom', offset: -12, fill: '#666', fontSize: 12 }}
                      stroke="#888"
                    />
                    <YAxis
                      domain={[0, 100]}
                      label={{ value: 'Recurrence-Free Survival (%)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 12 }}
                      stroke="#888"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} />
                    <Area
                      type="monotone"
                      dataKey="rfs_probability_pct"
                      name="Recurrence-Free Survival (%)"
                      stroke="#1565c0"
                      strokeWidth={3}
                      fill="url(#rfsGrad)"
                    />
                    <Line
                      type="monotone"
                      dataKey="rfs_ci_lower_pct"
                      name="95% CI Lower"
                      stroke="#90caf9"
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Explanation of the curve */}
            <div className="chart-explanation-box">
              <strong>🔬 Understanding This Trajectory:</strong>
              <p>
                {activeMetric === 'recurrence' ? (
                  <>
                    The <strong>Cumulative Recurrence Risk</strong> curve represents the estimated probability of a breast cancer event (local, regional, or distant recurrence) accumulating over time up to 10 years. In breast oncology, recurrence risk is not constant: hormone receptor-negative tumors typically experience higher recurrence rates in years 1–5, while hormone receptor-positive tumors maintain a steady annual recurrence risk through years 5–10.
                  </>
                ) : (
                  <>
                    The <strong>Recurrence-Free Survival (RFS)</strong> curve shows the estimated percentage of patients expected to remain alive without recurrence over time. Mathematically, <code>RFS(t) = 1.0 - RecurrenceRisk(t)</code>.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* ── Clinical Inputs & Model Metadata ── */}
          <div className="recurrence-metadata-grid">
            <div className="metadata-card">
              <h5>📋 Inputs Used</h5>
              <ul>
                <li>Tumor size: <strong>{result.inputs_used?.tumor_size_cm} cm</strong></li>
                <li>Positive lymph nodes: <strong>{result.inputs_used?.positive_nodes}</strong></li>
                <li>Histological grade: <strong>Grade {result.inputs_used?.tumor_grade}</strong></li>
                {result.inputs_used?.er_status && <li>ER: <strong>{result.inputs_used.er_status}</strong></li>}
                {result.inputs_used?.pr_status && <li>PR: <strong>{result.inputs_used.pr_status}</strong></li>}
                {result.inputs_used?.her2_status && <li>HER2: <strong>{result.inputs_used.her2_status}</strong></li>}
                {result.inputs_used?.age && <li>Age at diagnosis: <strong>{result.inputs_used.age} years</strong></li>}
                {result.inputs_used?.hormone_therapy !== undefined && (
                  <li>Endocrine therapy: <strong>{result.inputs_used.hormone_therapy ? 'Prescribed' : 'None'}</strong></li>
                )}
                {result.inputs_used?.chemotherapy !== undefined && (
                  <li>Adjuvant chemotherapy: <strong>{result.inputs_used.chemotherapy ? 'Prescribed' : 'None'}</strong></li>
                )}
              </ul>
            </div>

            <div className="metadata-card">
              <h5>⚕️ Model Information & Calibration</h5>
              <p className="model-info-line">Model: <code>{result.model_name}</code> (v{result.model_version})</p>
              <p className="model-info-line">Architecture: {result.model_architecture}</p>
              <p className="model-info-line">Cohort Reference: {result.validation_reference}</p>
              {result.missing_or_defaulted_inputs?.length > 0 && (
                <p className="model-info-line text-warning">
                  Defaulted assumptions: {result.missing_or_defaulted_inputs.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* ── Clinical Limitations & Safety Notice ── */}
          <div className="recurrence-limitations-box">
            <h5>⚠️ Medical & Oncological Limitations</h5>
            <p>{result.clinical_limitations}</p>
            <p className="sub-disclaimer">{result.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
