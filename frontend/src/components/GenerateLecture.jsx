import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReadingEditor from './ReadingEditor';
import './css/GenerateReading.css';

const LecturePage = () => {
  const { moduleId, submoduleId, activity_idx } = useParams();
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    pdfs: [],
    documents: [],
    urls: '',
    userGuideline: '',
    duration: ''
  });
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    const storedCourse = localStorage.getItem('generatedCourse');
    if (storedCourse) {
      try {
        const parsedCourse = JSON.parse(storedCourse);
        setCourseData(parsedCourse);

        const hasLectureScript = parsedCourse?.modules?.[moduleId]?.submodules?.[submoduleId]?.activities?.[activity_idx]?.content?.lectureScript;
        setShowForm(!hasLectureScript);
      } catch (error) {
        console.error('Error parsing course data:', error);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [moduleId, submoduleId, activity_idx]);

  const handleFileUpload = (e, type) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      if (type === 'pdfs') {
        return file.type === 'application/pdf' && file.size <= 5 * 1024 * 1024;
      }
      if (type === 'documents') {
        return (
          file.type.match('text.*') ||
          file.type === 'application/msword' ||
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) && file.size <= 2 * 1024 * 1024;
      }
      return false;
    });

    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], ...validFiles]
    }));
  };

  const handleUrlChange = (e) => {
    setFormData(prev => ({
      ...prev,
      urls: e.target.value
    }));
  };

  const handleGuidelineChange = (e) => {
    setFormData(prev => ({
      ...prev,
      userGuideline: e.target.value
    }));
  };

  const removeFile = (type, index) => {
    setFormData(prev => {
      const updatedFiles = [...prev[type]];
      updatedFiles.splice(index, 1);
      return {
        ...prev,
        [type]: updatedFiles
      };
    });
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);
  try {
    if (!courseData) throw new Error('Course data not loaded');

    const updatedCourse = JSON.parse(JSON.stringify(courseData));
    const module = updatedCourse.modules?.[moduleId];
    const submodule = module?.submodules?.[submoduleId];
    const activity = submodule?.activities?.[activity_idx];

    if (!module || !submodule || !activity) throw new Error('Invalid path');
    if (!activity.content) activity.content = {};

    // ✅ Prepare payload for API
    const requestBody = {
      course_outline: courseData.courseOutline || {}, // adjust if needed
      module_name: module.module_title || module.moduleName,
      submodule_name: submodule.submodule_title || submodule.submoduleName,
      user_prompt: formData.userGuideline || '',
      prev_activities_summary: '', // can be added later
      notes_path: null,
      pdf_path: null,
      text_examples: null,
      duration_minutes: parseInt(formData.duration || '0', 10)
    };

    const firstUrl = formData.urls?.split(',')?.[0]?.trim();
    if (firstUrl) {
      requestBody.url = firstUrl;
    }

    const response = await fetch('http://localhost:8000/course/generate-lecture-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to generate lecture script');
    }

    const data = await response.json();

    // ✅ Save generated content
    activity.content.lectureScript = data.lecture_script;
    activity.content.summary = data.lecture_script_summary||`# Summary\n\n(Add summary here or generate one using Gemini)`;

    localStorage.setItem('generatedCourse', JSON.stringify(updatedCourse));
    setCourseData(updatedCourse);
    setShowForm(false);

  } catch (error) {
    console.error('Error saving content:', error);
    alert(error.message || 'Failed to save. Please try again.');
  }finally{
    setIsSubmitting(false);
  }
};


  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  if (showForm) {
    return (
      <div className="reading-page-container">
        <div className="form-header">
          <h2>Create Lecture Script</h2>
          <p className="activity-path">
            Module {parseInt(moduleId) + 1} • Submodule {parseInt(submoduleId) + 1} • Activity {parseInt(activity_idx) + 1}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* PDF Upload */}
          <div className="form-section">
            <label className="section-label">
              Upload PDFs <span className="hint">(max 5MB each)</span>
            </label>
            <div className="file-upload-container">
              <label className="file-upload-button">
                Choose PDFs
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) => handleFileUpload(e, 'pdfs')}
                  className="file-input"
                />
              </label>
              {formData.pdfs.length > 0 && (
                <div className="file-preview">
                  {formData.pdfs.map((pdf, index) => (
                    <div key={index} className="file-item">
                      <span className="file-name">{pdf.name}</span>
                      <span className="file-size">{(pdf.size / (1024 * 1024)).toFixed(2)}MB</span>
                      <button type="button" className="remove-file-button" onClick={() => removeFile('pdfs', index)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Document Upload */}
          <div className="form-section">
            <label className="section-label">
              Upload Documents <span className="hint">(TXT/DOC/DOCX, max 2MB each)</span>
            </label>
            <div className="file-upload-container">
              <label className="file-upload-button">
                Choose Documents
                <input
                  type="file"
                  accept=".txt,.doc,.docx,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  onChange={(e) => handleFileUpload(e, 'documents')}
                  className="file-input"
                />
              </label>
              {formData.documents.length > 0 && (
                <div className="file-preview">
                  {formData.documents.map((doc, index) => (
                    <div key={index} className="file-item">
                      <span className="file-name">{doc.name}</span>
                      <span className="file-size">{(doc.size / (1024 * 1024)).toFixed(2)}MB</span>
                      <button type="button" className="remove-file-button" onClick={() => removeFile('documents', index)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* URL and Guidelines */}
          <div className="form-section">
            <label className="section-label">
              Resource URLs <span className="hint">(comma separated)</span>
            </label>
            <textarea
              value={formData.urls}
              onChange={handleUrlChange}
              placeholder="https://example.com, https://another-example.com"
              className="url-textarea"
            />
          </div>

          <div className="form-section">
            <label className="section-label">
              User Guidelines <span className="hint">(optional)</span>
            </label>
            <textarea
              value={formData.userGuideline}
              onChange={handleGuidelineChange}
              placeholder="Example: Please read the materials before the class."
              className="url-textarea"
            />
          </div>
        <div className="form-section">
            <label className="section-label">
                Estimated Duration <span className="hint">(in minutes)</span>
            </label>
            <input
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="Enter duration (e.g. 30)"
                className="duration-input"
            />
        </div>

          <div className="form-actions">
            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Lecture Script'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <h2>Edit Lecture Script & Summary</h2>
        <p className="activity-path">
          Module {parseInt(moduleId) + 1} • Submodule {parseInt(submoduleId) + 1} • Activity {parseInt(activity_idx) + 1}
        </p>
      </div>
      <div className="section-header">Lecture Script</div>
      <ReadingEditor generatingcontext="lectureScript" />
      <div className="section-header">Lecture Summary</div>
      <ReadingEditor generatingcontext="summary" />
      
    </div>
  );
};

export default LecturePage;
