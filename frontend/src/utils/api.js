const API_BASE = (import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3001/api' : '/api')).replace(/\/+$/, '');
//base api
/**
 * Analyze mammogram images via Gemini API
 * @param {File} ccFile - CC view image
 * @param {File} mloFile - MLO view image
 * @returns {Promise<Object>} Analysis result
 */
export async function analyzeImages(ccFile, mloFile) {
  const formData = new FormData();
  formData.append('cc', ccFile);
  formData.append('mlo', mloFile);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Analysis failed. Please try again.');
  }

  return response.json();
}

/**
 * Classify breast cancer type from mammogram images via Gemini vision API.
 * Returns radiological pattern-based classification — NOT a validated pathology diagnosis.
 * Requires a dedicated trained classifier for clinical use.
 * @param {File} ccFile - CC view image
 * @param {File} mloFile - MLO view image
 * @returns {Promise<Object>} Classification result with predicted_class, class_probabilities, etc.
 */
export async function classifyImages(ccFile, mloFile) {
  const formData = new FormData();
  formData.append('cc', ccFile);
  formData.append('mlo', mloFile);

  const response = await fetch(`${API_BASE}/classify`, {
    method: 'POST',
    body: formData,
  });

  // For classification, even 200 responses with status=parse_error or similar should pass through
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Classification failed. Please try again.');
  }

  return response.json();
}

/**
 * Send a chat message to the AI chatbot
 * @param {string} message - User message
 * @param {Array} history - Chat history [{role, content}]
 * @returns {Promise<{reply: string}>}
 */
export async function sendChatMessage(message, history = []) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get response.');
  }

  return response.json();
}

/**
 * Predict breast cancer recurrence risk and survival curves
 * using validated clinical and histopathological parameters.
 * @param {Object} clinicalData - Patient clinical and histopathological data
 * @returns {Promise<Object>} Recurrence risk prediction and survival curve
 */
export async function predictRecurrence(clinicalData = {}) {
  const response = await fetch(`${API_BASE}/predict-recurrence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clinicalData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Recurrence prediction failed. Please check inputs.');
  }

  return response.json();
}

