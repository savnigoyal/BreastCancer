const API_BASE = 'https://ai-breast-cancer-care-backend.vercel.app/api';
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
