import { useState } from 'react';

const sections = [
  {
    title: 'Overview',
    content:
      'Breast cancer is a disease where cells in the breast grow out of control. There are different kinds of breast cancer, depending on which cells in the breast turn into cancer. Breast cancer can begin in different parts of the breast, such as the ducts or lobules. It can spread outside the breast through blood vessels and lymph vessels. When breast cancer spreads to other parts of the body, it is said to have metastasized. While it occurs almost entirely in women, men can get breast cancer too. Early detection and advancements in personalized medicine have significantly improved survival rates in recent years.',
  },
  {
    title: 'Breast Anatomy',
    content:
      'To understand breast cancer, it helps to structurally understand the breast. The breast is primarily made up of three main parts: lobules, ducts, and connective tissue. The lobules are the glands that produce milk, and the ducts are the tiny tubes that carry milk to the nipple. The connective tissue, consisting of fibrous and fatty tissue, surrounds and holds everything together. Blood vessels and lymph vessels also run throughout the breast, providing nourishment and draining waste. Most breast cancers begin in the ducts or lobules, though occasionally they start in the stromal tissues.',
  },
  {
    title: 'Types of Breast Cancer',
    content:
      'There are two main categories: invasive and non-invasive. Ductal carcinoma in situ (DCIS) is non-invasive, meaning it is confined to the milk duct. Invasive ductal carcinoma (IDC) makes up about 80% of all breast cancers, starting in the duct and breaking through the wall into fatty tissue. Invasive lobular carcinoma (ILC) begins in the milk-producing glands and can be harder to detect on a mammogram. Other types include Triple-Negative Breast Cancer (TNBC), which lacks estrogen, progesterone, and HER2 receptors, making it more challenging to treat; and Inflammatory Breast Cancer (IBC), an aggressive state where cancer cells block lymph vessels in the skin, causing swelling and redness.',
  },
  {
    title: 'Causes and Risk Factors',
    content:
      'The exact cause of breast cancer remains unknown, but several risk factors can increase the likelihood of developing the disease. Genetic factors play a crucial role, particularly mutations in the BRCA1 and BRCA2 genes, which significantly elevate risk. Other unavoidable risk factors include being female, advancing age, a family history of breast cancer, and early onset of menstruation or late menopause. Modifiable risk factors related to lifestyle include alcohol consumption, being overweight or obese after menopause, lack of physical activity, and utilizing certain types of hormone replacement therapy for prolonged periods.',
  },
  {
    title: 'Signs and Symptoms',
    content:
      'The most common symptom of breast cancer is a new lump or mass. A painless, hard mass with irregular edges is more likely to be cancer, but some cancers are tender, soft, or round. Therefore, it is important to have any new mass checked by a healthcare professional. Other possible signs include: swelling of all or part of a breast; skin dimpling (sometimes looking like an orange peel); breast or nipple pain; nipple retraction (turning inward); nipple or breast skin that is red, dry, flaking, or thickened; and nipple discharge other than breast milk. Swollen lymph nodes under the arm or around the collar bone may also indicate cancer spreading.',
  },
  {
    title: 'Stages of Breast Cancer',
    content:
      'Breast cancer stages range from 0 to IV and indicate how far the cancer has spread. Stage 0 indicates non-invasive cancer (like DCIS) that remains in its original location. Stage I means the tumor is small and has barely spread into nearby tissue. Stage II means the cancer is growing but is still contained in the breast or regional lymph nodes affecting the armpit. Stage III indicates a more advanced, larger tumor with heavier lymph node involvement, but it hasn\'t spread to distant organs. Stage IV, or metastatic breast cancer, means the cancer has spread from the breast to other parts of the body, such as the bones, lungs, liver, or brain.',
  },
  {
    title: 'Diagnosis',
    content:
      'Diagnosis typically begins when a screening mammogram shows an abnormality, or a patient discovers a lump. Healthcare providers utilize multiple tools for diagnosis. Diagnostic Mammograms provide detailed x-ray images of suspicious areas. Ultrasounds use sound waves to determine whether a lump is a solid mass or a fluid-filled cyst. Magnetic Resonance Imaging (MRI) offers detailed cross-sectional images using magnetic fields, often used for women at high risk. The definitive diagnosis comes from a Biopsy, where a small tissue sample is removed and examined under a microscope to confirm the presence of cancer cells and determine their characteristics.',
  },
  {
    title: 'Treatment Options',
    content:
      'Breast cancer treatment is highly individualized. Local treatments target the tumor directly and include Surgery (lumpectomy or mastectomy) to remove the tumor, and Radiation Therapy to destroy remaining cancer cells in the breast region. Systemic treatments reach cancer cells throughout the body and include Chemotherapy, which uses drugs to kill fast-growing cancer cells; Hormone Therapy, which blocks estrogen or progesterone for receptor-positive cancers; Targeted Therapy, which aims at specific characteristics of cancer cells (like HER2-targeted drugs); and increasingly, Immunotherapy, which helps the body\'s immune system recognize and destroy cancer cells.',
  },
  {
    title: 'Prevention and Early Detection',
    content:
      'While breast cancer cannot be completely prevented, certain lifestyle choices may lower the risk. These include maintaining a healthy body weight, engaging in regular physical activity, limiting alcohol intake, and breastfeeding if possible. Regular screening is the most reliable way to find breast cancer early when it is most treatable. Screening guidelines generally recommend women with an average risk begin annual mammograms at age 40, though women should consult their doctors regarding a personalized screening plan. Clinical breast exams and being familiar with how your breasts normally look and feel are also important components of early detection.',
  },
  {
    title: 'Emotional and Social Impact',
    content:
      'A breast cancer diagnosis is life-altering and brings intense emotional challenges. Patients often experience a wide range of feelings including shock, fear, anger, and sadness. The psychological toll extends not only to the patient but also to their families, friends, and caregivers. Treatment side effects like hair loss and fatigue can further impact body image and mental well-being. Finding robust support systems is crucial. Support groups, counseling therapies, and open communication with loved ones can provide immense relief. Surrounding oneself with a compassionate community helps navigate the anxiety of treatment and survivorship.',
  },
  {
    title: 'Awareness and Hope',
    content:
      'Breast cancer awareness initiatives, universally recognized by the pink ribbon, have dramatically transformed public understanding and funding for research. Driven by advocacy and scientific innovation, the medical community is moving toward more personalized and effective treatments with fewer side effects. Every year, survival rates are improving, and millions of breast cancer survivors worldwide stand as testaments to the progress being made. The continuous march of research offers profound hope that one day, breast cancer will be an entirely manageable or preventable condition, allowing patients to lead fully vibrant and healthy lives.',
  },
];

export default function KnowMore() {
  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section className="section" id="info">
      <h2 className="section__title">Know More About Breast Cancer</h2>
      <p className="section__subtitle">
        Understanding breast cancer is the first step toward prevention and early detection
      </p>

      <div className="knowmore">
        {sections.map((s, idx) => (
          <div className="accordion-item" key={idx}>
            <button
              className={`accordion-trigger${openIdx === idx ? ' open' : ''}`}
              onClick={() => toggle(idx)}
            >
              {s.title}
              <span className="accordion-trigger__icon">▾</span>
            </button>
            <div className={`accordion-content${openIdx === idx ? ' open' : ''}`}>
              <div className="accordion-content__inner">{s.content}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
