import { useState, useRef } from 'react';
import { analyzeImages } from '../utils/api';
import CancerTypeClassification from './CancerTypeClassification';
import RecurrenceRiskAnalysis from './RecurrenceRiskAnalysis';
import ClinicalInterpretation from './ClinicalInterpretation';

export default function RiskAnalysis() {
  const [ccFile, setCcFile] = useState(null);
  const [mloFile, setMloFile] = useState(null);
  const [ccPreview, setCcPreview] = useState(null);
  const [mloPreview, setMloPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const ccRef = useRef(null);
  const mloRef = useRef(null);
  const resultRef = useRef(null);

  const handleFile = (file, type) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'cc') {
        setCcFile(file);
        setCcPreview(e.target.result);
      } else {
        setMloFile(file);
        setMloPreview(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file, type);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleAnalyze = async () => {
    if (!ccFile || !mloFile) {
      setError('Please upload both CC and MLO view images.');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await analyzeImages(ccFile, mloFile);
      setResult(data);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskClass = (level) => {
    if (!level) return '';
    const l = level.toLowerCase();
    if (l.includes('high')) return 'risk-high';
    if (l.includes('moderate')) return 'risk-moderate';
    return 'risk-low';
  };

  const getProbColor = (prob) => {
    if (prob >= 60) return '#c62828';
    if (prob >= 20) return '#ef6c00';
    return '#2e7d32';
  };

  // Compute max value for scaling parameter bars
  const getMaxParamValue = () => {
    if (!result?.topParameters?.length) return 1;
    return Math.max(...result.topParameters.map((p) => Math.abs(p.value)));
  };

  return (
    <section className="section" id="predict">
      <h2 className="section__title">🔬 AI Risk Analysis</h2>
      <p className="section__subtitle">
        Upload <strong>CC</strong> (Cranio-Caudal) and <strong>MLO</strong> (Medio-Lateral Oblique)
        mammogram views for comprehensive analysis.
      </p>

      <div className="analysis">
        {/* Upload Zones */}
        <div className="analysis__upload-zone">
          {/* CC Upload */}
          <div
            className="upload-box"
            onDrop={(e) => handleDrop(e, 'cc')}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => ccRef.current?.click()}
          >
            <span className="upload-box__label">📋 CC View</span>
            <label className="upload-box__btn" onClick={(e) => e.stopPropagation()}>
              ☁️ Choose Image
              <input
                ref={ccRef}
                type="file"
                className="upload-box__input"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files[0], 'cc')}
              />
            </label>
            <div className="upload-box__preview">
              {ccPreview ? (
                <img
                  src={ccPreview}
                  alt="CC Preview"
                  className="upload-box__preview-img"
                  onClick={(e) => { e.stopPropagation(); setLightboxSrc(ccPreview); }}
                />
              ) : (
                <span className="upload-box__placeholder">No image selected</span>
              )}
            </div>
          </div>

          {/* MLO Upload */}
          <div
            className="upload-box"
            onDrop={(e) => handleDrop(e, 'mlo')}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => mloRef.current?.click()}
          >
            <span className="upload-box__label">📋 MLO View</span>
            <label className="upload-box__btn" onClick={(e) => e.stopPropagation()}>
              ☁️ Choose Image
              <input
                ref={mloRef}
                type="file"
                className="upload-box__input"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files[0], 'mlo')}
              />
            </label>
            <div className="upload-box__preview">
              {mloPreview ? (
                <img
                  src={mloPreview}
                  alt="MLO Preview"
                  className="upload-box__preview-img"
                  onClick={(e) => { e.stopPropagation(); setLightboxSrc(mloPreview); }}
                />
              ) : (
                <span className="upload-box__placeholder">No image selected</span>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p style={{ textAlign: 'center', color: '#c62828', marginBottom: 16, fontWeight: 600 }}>
            ⚠️ {error}
          </p>
        )}

        {/* Analyze Button */}
        <button
          className="analyze-btn"
          onClick={handleAnalyze}
          disabled={loading || !ccFile || !mloFile}
        >
          {loading ? '⏳ Analyzing...' : '🧠 Analyze Risk'}
        </button>

        {/* Loading */}
        {loading && (
          <div className="loading-indicator">
            <div className="loading-spinner" />
            <p className="loading-text">Analyzing mammograms... please wait...</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            RESULTS — matches screenshot format
            ═══════════════════════════════════════════ */}
        {result && (
          <div className="results-card" ref={resultRef}>
            {/* Header: probability + risk badge */}
            <div className="results__header">
              <p className="results__probability-label">Cancer Probability</p>
              <div
                className="results__probability"
                style={{ color: getProbColor(result.probability) }}
              >
                {result.probability}
                <span style={{ fontSize: '1.5rem' }}>%</span>
              </div>
              <span className={`results__risk-badge ${getRiskClass(result.riskLevel)}`}>
                {result.riskLevel}
              </span>
            </div>

            {/* ── Why this percentage was shown ── */}
            {result.explanation && (
              <div className="results__why-section">
                <h4 className="results__why-title">Why this percentage was shown</h4>
                <p className="results__why-text">{result.explanation}</p>

                {/* Pills row */}
                <div className="results__pills-row">
                  {result.selectedCrop && (
                    <span className="analysis-pill">
                      Selected crop: <strong>{result.selectedCrop}</strong>
                    </span>
                  )}
                  {result.focusArea && (
                    <span className="analysis-pill">
                      Focus area: <strong>{result.focusArea}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── How each area scored ── */}
            {result.areaScores && result.areaScores.length > 0 && (
              <div className="results__area-scores">
                <h4 className="results__area-scores-title">How each area scored</h4>
                {result.areaScores.map((area, i) => (
                  <div
                    key={i}
                    className={`area-score-row${area.isSelected ? ' area-score-row--selected' : ''}`}
                  >
                    <span className="area-score-row__name">{area.name}</span>
                    <span className="area-score-row__value">{area.score.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Top 10 parameters (filled bars) ── */}
            {result.topParameters && result.topParameters.length > 0 && (
              <div className="results__top-params">
                <h4 className="results__top-params-title">Top 10 parameters (filled bars)</h4>
                {result.topParameters.map((param, i) => {
                  const maxVal = getMaxParamValue();
                  const barWidth = Math.max(5, (Math.abs(param.value) / maxVal) * 100);
                  return (
                    <div key={i} className="shap-row" style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="shap-row-header">
                        <span className="shap-feature">{param.name}</span>
                        <span className="shap-value">
                          {typeof param.value === 'number' ? param.value.toFixed(3) : param.value}
                        </span>
                      </div>
                      <div className="shap-track">
                        <div
                          className={`shap-fill ${param.influence === 'protective' ? 'shap-fill-protect' : 'shap-fill-risk'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Explanation of parameters */}
            <div className="results__params-legend">
              <details className="params-legend-details">
                <summary className="params-legend-summary">What The Parameters Indicate</summary>
                <div className="params-legend-content">
                  <p><strong>The model explanation uses 30 core parameters. They are built from 10 breast-tissue characteristics, each measured in 3 ways:</strong></p>
                  <ul>
                    <li><strong>Mean:</strong> Average value across sampled regions.</li>
                    <li><strong>SE (Standard Error):</strong> Variation/instability of that feature across regions.</li>
                    <li><strong>Worst:</strong> Highest (most extreme) observed value across regions.</li>
                  </ul>
                  <p><strong>The 10 Core Characteristics:</strong></p>
                  <ul>
                    <li><strong>radius:</strong> Approximate size of suspicious structures; larger values can indicate larger abnormal regions.</li>
                    <li><strong>texture:</strong> Intensity variation/roughness in tissue; higher values can reflect heterogeneous tissue patterns.</li>
                    <li><strong>perimeter:</strong> Boundary length of suspected regions; higher values can indicate more spread/irregular borders.</li>
                    <li><strong>area:</strong> Pixel area of suspected regions; larger area can indicate larger lesion-like regions.</li>
                    <li><strong>smoothness:</strong> How smooth or noisy the boundary/region is; lower smoothness can indicate irregular tissue patterns.</li>
                    <li><strong>compactness:</strong> How dense and shape-compressed a region is; high compactness can reflect non-round abnormal shapes.</li>
                    <li><strong>concavity:</strong> Degree of inward boundary curvature; higher concavity can indicate indented/irregular lesion contours.</li>
                    <li><strong>concave points:</strong> Number/strength of inward boundary points; higher values can indicate complex malignant-like edges.</li>
                    <li><strong>symmetry:</strong> Left-right structural balance of region appearance; lower symmetry can indicate abnormal morphology.</li>
                    <li><strong>fractal_dimension:</strong> Edge complexity/roughness at multiple scales; higher values can indicate more complex boundaries.</li>
                  </ul>
                  <p><strong>How To Interpret The Bars:</strong></p>
                  <ul>
                    <li><strong>Longer bars</strong> = stronger influence on the current prediction.</li>
                    <li><strong>Pink/Red bars</strong> = pushing prediction toward cancer risk.</li>
                    <li><strong>Blue bars</strong> = pushing prediction away from cancer risk.</li>
                  </ul>
                  <p><em>These values are decision-support explanations and should not replace radiologist diagnosis.</em></p>
                </div>
              </details>
            </div>

            {/* Disclaimer */}
            <div className="results__disclaimer">
              ⚠️ {result.disclaimer || 'This AI analysis is for educational and screening assistance only. It does NOT replace a professional medical diagnosis. Please consult a qualified healthcare provider.'}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SECTION 2: CANCER TYPE CLASSIFICATION CARD
            Shown after detection analysis is available.
            ═══════════════════════════════════════════ */}
        {(result || (!loading && ccFile && mloFile)) && (
          <CancerTypeClassification ccFile={ccFile} mloFile={mloFile} />
        )}

        {/* ═══════════════════════════════════════════
            SECTION 3: BREAST CANCER RECURRENCE RISK GRAPH
            Interactive 10-year survival trajectory,
            Nottingham Prognostic Index, and clinical
            pathology inputs.
            ═══════════════════════════════════════════ */}
        <RecurrenceRiskAnalysis />

        {/* ═══════════════════════════════════════════
            SECTION 4: CLINICAL INTERPRETATION & LIMITATIONS
            Consolidated multidisciplinary framework,
            modality distinctions, and safety disclaimers.
            ═══════════════════════════════════════════ */}
        <ClinicalInterpretation />
      </div>


      {/* Lightbox */}
      {lightboxSrc && (
        <div className="lightbox" onClick={() => setLightboxSrc(null)}>
          <button className="lightbox__close" onClick={() => setLightboxSrc(null)}>
            ×
          </button>
          <img src={lightboxSrc} alt="Zoomed view" className="lightbox__img" />
        </div>
      )}
    </section>
  );
}
