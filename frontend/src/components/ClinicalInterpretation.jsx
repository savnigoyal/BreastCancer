/**
 * ClinicalInterpretation Component
 *
 * Section 4 of the comprehensive AI Breast Cancer Care Analysis Report.
 * Summarizes the clinical scope, boundaries, and validation status of all
 * 3 AI modalities in the workflow.
 */

export default function ClinicalInterpretation() {
  return (
    <div className="clinical-interpretation-card" id="clinical-interpretation">
      <div className="clinical-interpretation-card__header">
        <span className="clinical-interpretation-card__icon">🩺</span>
        <div>
          <h3 className="clinical-interpretation-card__title">
            Clinical Interpretation & Multidisciplinary Limitations
          </h3>
          <p className="clinical-interpretation-card__subtitle">
            Safety boundaries, modality distinctions, and clinical decision-support framework
          </p>
        </div>
      </div>

      <div className="interpretation-grid">
        {/* Modality 1 */}
        <div className="modality-col">
          <div className="modality-badge modality-badge--detection">1. Mammogram Detection</div>
          <h4 className="modality-title">Screening Lesion Detection</h4>
          <p className="modality-desc">
            Analyzes dual-view CC and MLO mammogram density and morphological features. Highlights suspicious regions and computes Wisconsin-style tissue parameters (smoothness, concavity, texture).
          </p>
          <div className="modality-scope">
            <strong>Scope:</strong> Suspicious signal vs normal tissue; region-of-interest localization.
          </div>
          <div className="modality-limitation">
            <strong>Limitation:</strong> High detection score indicates radiographic suspicion; it does <em>not</em> confirm malignancy without biopsy.
          </div>
        </div>

        {/* Modality 2 */}
        <div className="modality-col">
          <div className="modality-badge modality-badge--classification">2. Type Classification</div>
          <h4 className="modality-title">Radiological Pattern Assessment</h4>
          <p className="modality-desc">
            Evaluates radiological patterns associated with DCIS (calcification clusters), IDC (spiculated masses), or ILC (architectural distortion) using vision pattern recognition.
          </p>
          <div className="modality-scope">
            <strong>Scope:</strong> Imaging pattern categorization and confidence breakdown.
          </div>
          <div className="modality-limitation">
            <strong>Limitation:</strong> Cannot infer receptor status (ER/PR/HER2), tumor grade, or genomic subtypes. Definitive diagnosis requires histology.
          </div>
        </div>

        {/* Modality 3 */}
        <div className="modality-col">
          <div className="modality-badge modality-badge--recurrence">3. Recurrence Analysis</div>
          <h4 className="modality-title">Histopathological Survival Modeling</h4>
          <p className="modality-desc">
            Applies the Nottingham Prognostic Index (NPI) and multivariable Cox proportional hazards modeling to estimate 5- and 10-year recurrence-free trajectories.
          </p>
          <div className="modality-scope">
            <strong>Scope:</strong> 10-year cumulative recurrence curves and recurrence-free survival probability.
          </div>
          <div className="modality-limitation">
            <strong>Limitation:</strong> Operates strictly on confirmed pathology and biomarker data. Mammograms alone cannot estimate recurrence.
          </div>
        </div>
      </div>

      <div className="multidisciplinary-notice">
        <h4 className="multidisciplinary-title">👩‍⚕️ Multidisciplinary Oncology Governance</h4>
        <p className="multidisciplinary-text">
          No automated algorithm can replace a comprehensive tumor board evaluation. Clinical breast cancer management requires a cohesive consensus among:
        </p>
        <ul className="multidisciplinary-list">
          <li><strong>Diagnostic Radiologist:</strong> Full-field digital mammography (FFDM), 3D tomosynthesis, ultrasound, and contrast MRI review.</li>
          <li><strong>Pathologist:</strong> Core needle biopsy, Nottingham histologic grading, and immunohistochemistry (ER, PR, HER2, Ki-67).</li>
          <li><strong>Surgical Oncologist:</strong> Clinical TNM staging, breast-conserving surgery vs mastectomy, and sentinel lymph node biopsy.</li>
          <li><strong>Medical & Radiation Oncologist:</strong> Adjuvant systemic therapy selection (endocrine, chemotherapy, CDK4/6 inhibitors, immunotherapy) and radiotherapy planning.</li>
        </ul>
      </div>

      <div className="regulatory-disclaimer-banner">
        ⚠️ <strong>Prototype Advisory:</strong> This software is an investigational research and educational prototype. It has not received FDA clearance or CE mark approval as a diagnostic medical device. It must not be used as the sole basis for clinical decisions or withholding standard medical care.
      </div>
    </div>
  );
}
