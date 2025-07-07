import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReadingEditor from './ReadingEditor';
import './css/GenerateReading.css';

const ReadingPage = () => {
  const { moduleId, submoduleId, activity_idx } = useParams();
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    // images: [],
    pdfs: [],
    documents: [],
    urls: '',
    userGuideline: ''
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

        const hasContent = parsedCourse?.modules?.[moduleId]?.submodules?.[submoduleId]?.activities?.[activity_idx]?.content?.readingMaterial;
        setShowForm(!hasContent);
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
      if (type === 'images') {
        return file.type.match('image.*') && file.size <= 200 * 1024;
      }
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

//   const handleSubmit = (e) => {
//     e.preventDefault();
    
//     try {
//       if (!courseData) {
//         throw new Error('Course data not loaded');
//       }

//       // Create deep copy of courseData
//       const updatedCourse = JSON.parse(JSON.stringify(courseData));
      
//       // Initialize structure if needed
//       if (!updatedCourse.modules) updatedCourse.modules = {};
//       if (!updatedCourse.modules[moduleId]) updatedCourse.modules[moduleId] = { submodules: {} };
//       if (!updatedCourse.modules[moduleId].submodules[submoduleId]) {
//         updatedCourse.modules[moduleId].submodules[submoduleId] = { activities: {} };
//       }
//       if (!updatedCourse.modules[moduleId].submodules[submoduleId].activities[activity_idx]) {
//         updatedCourse.modules[moduleId].submodules[submoduleId].activities[activity_idx] = { content: {} };
//       }

//       const initialContent = `
//         # Reading Material
        
//         ${formData.urls ? `## Resources\n${formData.urls.split(',').filter(url => url.trim()).map(url => `- [${url.trim()}](${url.trim()})`).join('\n')}` : ''}
        
//         ${formData.images.length ? `## Images\n${formData.images.map(img => `![${img.name}](${URL.createObjectURL(img)})`).join('\n')}` : ''}
        
//         ${formData.pdfs.length ? `## PDF Documents\n${formData.pdfs.map(pdf => `- [${pdf.name}](${URL.createObjectURL(pdf)})`).join('\n')}` : ''}
        
//         ${formData.documents.length ? `## Text Documents\n${formData.documents.map(doc => `- [${doc.name}](${URL.createObjectURL(doc)})`).join('\n')}` : ''}
//       `;
//       console.log(initialContent);
//       console.log("Updated Course Saving to LocalStorage:", updatedCourse);
//       updatedCourse.modules[moduleId].submodules[submoduleId].activities[activity_idx].content = {
//         ...updatedCourse.modules[moduleId].submodules[submoduleId].activities[activity_idx].content,
//         readingMaterial: initialContent
//       };

//       localStorage.setItem('generatedCourse', JSON.stringify(updatedCourse));
//       setShowForm(false);
//     } catch (error) {
//       console.error('Error saving reading material:', error);
//       alert('Failed to save reading material. Please try again.');
//     }
//   };
    const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!courseData) throw new Error('Course data not loaded');

      const updatedCourse = JSON.parse(JSON.stringify(courseData));

      const module = updatedCourse.modules?.[moduleId];
      if (!module) throw new Error('Invalid module index');
        console.log(module);
      const submodule = module.submodules?.[submoduleId];
      if (!submodule) throw new Error('Invalid submodule index');
        console.log(submodule);
        console.log(activity_idx);
      const activity = submodule.activities?.[activity_idx];
      if (!activity) throw new Error('Invalid activity index');
        console.log(activity);
      if (!activity.content) activity.content = {};

      const requestBody = {
      course_outline: courseData.courseOutline || {}, // Adjust if your outline is stored elsewhere
      module_name: module.module_title || module.moduleName,
      submodule_name: submodule.submodule_title || submodule.submoduleName,
      user_prompt: formData.userGuideline || '',
      previous_material_summary: '', // could be filled if editing
      url: formData.urls?.split(',')[0]?.trim() || null,
      pdf_path: null,           // Skipping file handling unless backend supports uploads
      notes_path: null
    };

    // 🔄 API call to generate reading material
    const response = await fetch('http://localhost:8000/course/generate-reading-material', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to generate reading material');
    }

    const data = await response.json();
    const readingMaterial = data.reading_material;
    console.log(data.reading_material);
    // ✅ Save returned content into localStorage
    activity.content.readingMaterial = readingMaterial;

      localStorage.setItem('generatedCourse', JSON.stringify(updatedCourse));
      setCourseData(updatedCourse); // 👈 ensures latest data in state
      setShowForm(false);
    } catch (error) {
      console.error('Error saving reading material:', error);
      alert('Failed to save reading material. Please try again.');
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
          <h2>Create Reading Material</h2>
          <p className="activity-path">
            Module {parseInt(moduleId) + 1} • Submodule {parseInt(submoduleId) + 1} • Activity {parseInt(activity_idx) + 1}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="upload-form">
          {/* Images Upload */}
          {/* <div className="form-section">
            <label className="section-label">
              Upload Images
              <span className="hint">(JPEG/PNG, max 200KB each)</span>
            </label>
            <div className="file-upload-container">
              <label className="file-upload-button">
                Choose Images
                <input
                  type="file"
                  accept="image/jpeg, image/png"
                  multiple
                  onChange={(e) => handleFileUpload(e, 'images')}
                  className="file-input"
                />
              </label>
              {formData.images.length > 0 && (
                <div className="file-preview">
                  {formData.images.map((img, index) => (
                    <div key={index} className="file-item">
                      <span className="file-name">{img.name}</span>
                      <span className="file-size">{(img.size / 1024).toFixed(1)}KB</span>
                      <button 
                        type="button" 
                        className="remove-file-button"
                        onClick={() => removeFile('images', index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div> */}

          {/* PDFs Upload */}
          <div className="form-section">
            <label className="section-label">
              Upload PDFs
              <span className="hint">(max 5MB each)</span>
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
                      <button 
                        type="button" 
                        className="remove-file-button"
                        onClick={() => removeFile('pdfs', index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Documents Upload */}
          <div className="form-section">
            <label className="section-label">
              Upload Documents
              <span className="hint">(TXT/DOC/DOCX, max 2MB each)</span>
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
                      <button 
                        type="button" 
                        className="remove-file-button"
                        onClick={() => removeFile('documents', index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* URLs Input */}
          <div className="form-section">
            <label className="section-label">
              Resource URLs
              <span className="hint">(comma separated)</span>
            </label>
            <textarea
              value={formData.urls}
              onChange={handleUrlChange}
              placeholder="https://example.com, https://another-example.com"
              className="url-textarea"
            />
          </div>
          {/* User Guidelines Input */}
            <div className="form-section">
              <label className="section-label">
                User Guidelines
                <span className="hint">(optional instructions or notes for students)</span>
              </label>
              <textarea
                value={formData.userGuideline}
                onChange={handleGuidelineChange}
                placeholder="Example: Read through all materials before attempting the quiz."
                className="url-textarea"
              />
            </div>

          <div className="form-actions">
            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Reading Material'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <h2>Edit Reading Material</h2>
        <p className="activity-path">
          Module {parseInt(moduleId) + 1} • Submodule {parseInt(submoduleId) + 1} • Activity {parseInt(activity_idx) + 1}
        </p>
      </div>
      <ReadingEditor generatingcontext="readingMaterial" />
    </div>
  );
};

export default ReadingPage;