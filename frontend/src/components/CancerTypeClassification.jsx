import { useState } from 'react';
import { classifyImages } from '../utils/api';

/**
 * CancerTypeClassification
 *
 * Integrates with the /api/classify endpoint to display radiological
 * pattern-based breast cancer type assessment.
 *
 * IMPORTANT SAFETY NOTE:
 * This component displays output from Gemini vision-based pattern recognition.
 * It is NOT a validated pathological classifier. No trained subtype model
 * exists in this project — the existing best_model.keras is a binary
 * detection model (benign vs malignant) trained on CBIS-DDSM and cannot
 * classify DCIS / IDC / ILC subtypes. A dedicated model trained on
 * pathology-labeled mammogram datasets (e.g., TCGA-BRCA with radiology
 * pairs) would be required for any clinical classification system.
 *
 * @param {File|null} ccFile  - CC view image file (passed from RiskAnalysis)
 * @param {File|null} mloFile - MLO view image file (passed from RiskAnalysis)
 */
export default function CancerTypeClassification({ ccFile, mloFile }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [hasRun, setHasRun] = useState(false);

  const CLASS_META = {
    'DCIS (Ductal Carcinoma In Situ)': {
      color: '#8e24aa',
      bg: '#f3e5f5',
      icon: '🔬',
      key: 'DCIS',
      short: 'DCIS',
    },
    'IDC (Invasive Ductal Carcinoma)': {
      color: '#c62828',
      bg: '#ffebee',
      icon: '⚠️',
      key: 'IDC',
      short: 'IDC',
    },
    'ILC (Invasive Lobular Carcinoma)': {
      color: '#e65100',
      bg: '#fff3e0',
      icon: '🔍',
      key: 'ILC',
      short: 'ILC',
    },
    'No Suspicious Findings': {
      color: '#2e7d32',
      bg: '#e8f5e9',
      icon: '✅',
      key: 'NoFindings',
      short: 'None',
    },
    'Uncertain / Cannot Classify': {
      color: '#546e7a',
      bg: '#eceff1',
      icon: '❓',
      key: 'Uncertain',
      short: 'Uncertain',
    },
  };

  const handleClassify = async () => {
    if (!ccFile || !mloFile) {
      setError('Please upload both CC and MLO images in the Risk Analysis section above before classifying.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setHasRun(true);

    try {
      const data = await classifyImages(ccFile, mloFile);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Classification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setResult(null);
    setHasRun(false);
  };

  const meta = result ? CLASS_META[result.predicted_class] || CLASS_META['Uncertain / Cannot Classify'] : null;

  // Ordered list for probability bars
  const probabilityOrder = [
    { label: 'DCIS', key: 'DCIS', color: '#8e24aa' },
    { label: 'IDC', key: 'IDC', color: '#c62828' },
    { label: 'ILC', key: 'ILC', color: '#e65100' },
    { label: 'No Findings', key: 'NoFindings', color: '#2e7d32' },
    { label: 'Uncertain', key: 'Uncertain', color: '#546e7a' },
  ];

  const canClassify = !!(ccFile && mloFile);

  return (
    <div className="classification-card">
      {/* ── Card Header ── */}
      <div className="classification-card__header">
        <span className="classification-card__icon">🧬</span>
        <div>
          <h3 className="classification-card__title">Breast Cancer Type Classification</h3>
          <p className="classification-card__subtitle">
            Radiological pattern analysis — for research and educational use only
          </p>
        </div>
      </div>

      {/* ── Prototype Notice ── */}
      <div className="classification-notice classification-notice--info">
        <strong>ℹ️ Research Prototype:</strong> This module uses Gemini AI vision to identify
        radiological patterns associated with breast cancer subtypes. It is{' '}
        <strong>not a validated clinical classifier</strong>. No trained pathology-labeled
        subtype model is bundled — that requires a dedicated dataset (e.g., TCGA-BRCA with
        radiology-pathology pairs). Results must be confirmed by a radiologist and tissue biopsy.
      </div>

      {/* ── Action Button ── */}
      {!hasRun && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            className="classify-btn"
            onClick={handleClassify}
            disabled={loading || !canClassify}
            title={!canClassify ? 'Upload CC and MLO images above first' : ''}
          >
            {loading ? '⏳ Classifying...' : '🧬 Run Type Classification'}
          </button>
          {!canClassify && (
            <p className="classification-notice--warn" style={{ marginTop: 10, fontSize: '0.85rem', color: '#888' }}>
              Upload CC and MLO images in the Risk Analysis section first.
            </p>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="classification-loading">
          <div className="loading-spinner" />
          <p className="loading-text">Analyzing mammogram patterns for subtype classification...</p>
        </div>
      )}

      {/* ── Error State ── */}
      {error && (
        <div className="classification-notice classification-notice--error">
          <p>⚠️ {error}</p>
          <button className="classify-retry-btn" onClick={handleRetry}>
            🔄 Try Again
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {result && meta && (
        <div className="classification-results">

          {/* Status badge for low-confidence or parse errors */}
          {result.status !== 'success' && (
            <div className="classification-notice classification-notice--warn">
              {result.status === 'low_confidence' && (
                <>⚠️ <strong>Low Confidence:</strong> The model could not reliably identify a subtype from the available imaging features.</>
              )}
              {result.status === 'parse_error' && (
                <>⚠️ <strong>Parsing Issue:</strong> The classification model returned an unexpected response. Results below may be incomplete.</>
              )}
            </div>
          )}

          {/* ── Predicted Class ── */}
          <div
            className="classification-predicted"
            style={{ background: meta.bg, borderLeft: `4px solid ${meta.color}` }}
          >
            <div className="classification-predicted__icon">{meta.icon}</div>
            <div>
              <div className="classification-predicted__label" style={{ color: meta.color }}>
                Most Likely Pattern
              </div>
              <div className="classification-predicted__class" style={{ color: meta.color }}>
                {result.predicted_class}
              </div>
              <div className="classification-predicted__confidence">
                Model confidence: <strong>{typeof result.confidence === 'number' ? result.confidence.toFixed(1) : '—'}%</strong>
                <span className="classification-predicted__confidence-note">
                  &nbsp;(model output score, not cancer probability)
                </span>
              </div>
            </div>
          </div>

          {/* ── Class Probability Breakdown ── */}
          {result.class_probabilities && (
            <div className="classification-probs">
              <h4 className="classification-probs__title">Pattern Score Breakdown</h4>
              {probabilityOrder.map(({ label, key, color }) => {
                const val = typeof result.class_probabilities[key] === 'number'
                  ? result.class_probabilities[key]
                  : 0;
                const isPredicted = meta.key === key;
                return (
                  <div key={key} className={`classif-bar-row${isPredicted ? ' classif-bar-row--selected' : ''}`}>
                    <span className="classif-bar-row__label">{label}</span>
                    <div className="classif-bar-track">
                      <div
                        className="classif-bar-fill"
                        style={{
                          width: `${Math.max(2, val)}%`,
                          background: color,
                          opacity: isPredicted ? 1 : 0.45,
                        }}
                      />
                    </div>
                    <span className="classif-bar-row__value" style={{ color: isPredicted ? color : '#888' }}>
                      {val.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Observed Radiological Features ── */}
          {Array.isArray(result.radiological_features) && result.radiological_features.length > 0 && (
            <div className="classification-features">
              <h4 className="classification-features__title">Observed Radiological Features</h4>
              <ul className="classification-features__list">
                {result.radiological_features.map((feat, i) => (
                  <li key={i} className="classification-features__item">
                    <span className="classification-features__bullet">•</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Model Info ── */}
          <div className="classification-meta">
            <span>Model: <code>{result.model_version || 'gemini-vision-classify-v1'}</code></span>
          </div>

          {/* ── Limitations Box ── */}
          <div className="classification-limitations">
            <h4 className="classification-limitations__title">⚕️ What This Cannot Determine</h4>
            <p>{result.limitations}</p>
          </div>

          {/* ── Disclaimer ── */}
          <div className="results__disclaimer" style={{ marginTop: 16 }}>
            {result.disclaimer}
          </div>

          {/* ── Retry ── */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button className="classify-retry-btn" onClick={handleRetry}>
              🔄 Run Classification Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
