import React, { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronUp, FiArrowRight, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import './css/Blueprint_freezed.css';

const GenerationPage = () => {
  const [course, setCourse] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const [expandedSubmodules, setExpandedSubmodules] = useState({});
  const [contentStatus, setContentStatus] = useState({});
  const [showAddDocumentModal, setShowAddDocumentModal] = useState({});
  const [newDocumentName, setNewDocumentName] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("generatedCourse");
    if (stored) {
      const parsedCourse = JSON.parse(stored);
      setCourse(parsedCourse);
      
      const status = {};
      parsedCourse.modules?.forEach((module, modIdx) => {
        module.submodules?.forEach((submodule, subIdx) => {
          submodule.activities?.forEach((activity, actIdx) => {
            const key = `${modIdx}-${subIdx}-${actIdx}`;
            status[key] = !!activity.content;
          });
        });
      });
      setContentStatus(status);
    }
  }, []);

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const toggleSubmodule = (moduleId, submoduleId) => {
    const key = `${moduleId}-${submoduleId}`;
    setExpandedSubmodules(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleActivityClick = (moduleId, submoduleId, activity, activityIndex) => {
    if (activity.activity_type === 'document') {
      navigate(`/view_document/${moduleId}/${submoduleId}/${activityIndex}`);
    } else {
      const routeMap = {
        'reading': 'generate_reading',
        'lecture': 'generate_lecture',
        'quiz': 'generate_quiz',
        'assignment': 'generate_assignment',
        'Reading': 'generate_reading',
        'Lecture': 'generate_lecture',
        'Quiz': 'generate_quiz',
        'Assignment': 'generate_assignment',
      };
      const baseRoute = routeMap[activity.activity_type] || 'generate_reading';
      navigate(`/${baseRoute}/${moduleId}/${submoduleId}/${activityIndex}`);
    }
  };

  const handleAddDocument = (moduleId, submoduleId) => {
    setShowAddDocumentModal(prev => ({
      ...prev,
      [`${moduleId}-${submoduleId}`]: true
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => 
      file.type === 'application/pdf' || 
      file.type.match('text.*') || 
      file.type === 'application/msword' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    setUploadedFiles(validFiles);
  };

  // const saveNewDocument = (moduleId, submoduleId) => {
  //   if (!newDocumentName.trim() || uploadedFiles.length === 0) return;

  //   const updatedCourse = JSON.parse(JSON.stringify(course));
    
  //   // Initialize structure if needed
  //   if (!updatedCourse.modules[moduleId]) {
  //     updatedCourse.modules[moduleId] = {
  //       module_id: `module-${moduleId}`,
  //       submodules: {}
  //     };
  //   }
  //   if (!updatedCourse.modules[moduleId].submodules[submoduleId]) {
  //     updatedCourse.modules[moduleId].submodules[submoduleId] = {
  //       submodule_id: `submodule-${submoduleId}`,
  //       activities: []
  //     };
  //   }

  //   // Store files in localStorage
  //   const storedFiles = uploadedFiles.map(file => {
  //     const reader = new FileReader();
  //     reader.readAsDataURL(file);
  //     return {
  //       name: file.name,
  //       type: file.type,
  //       size: file.size,
  //       lastModified: file.lastModified
  //     };
  //   });

  //   const newActivity = {
  //     activity_type: 'document',
  //     activity_name: newDocumentName,
  //     content: {
  //       documents: storedFiles
  //     }
  //   };

  //   updatedCourse.modules[moduleId].submodules[submoduleId].activities.push(newActivity);
    
  //   localStorage.setItem("generatedCourse", JSON.stringify(updatedCourse));
  //   setCourse(updatedCourse);
  //   setShowAddDocumentModal({});
  //   setNewDocumentName('');
  //   setUploadedFiles([]);
  // };

  const saveNewDocument = async (moduleId, submoduleId) => {
  if (!newDocumentName.trim() || uploadedFiles.length === 0) return;

  const updatedCourse = JSON.parse(JSON.stringify(course));
  
  // Initialize structure if needed
  if (!updatedCourse.modules[moduleId]) {
    updatedCourse.modules[moduleId] = {
      module_id: `module-${moduleId}`,
      submodules: {}
    };
  }
  if (!updatedCourse.modules[moduleId].submodules[submoduleId]) {
    updatedCourse.modules[moduleId].submodules[submoduleId] = {
      submodule_id: `submodule-${submoduleId}`,
      activities: []
    };
  }

  const storedFiles = await Promise.all(uploadedFiles.map(async (file) => {
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // ✅ store full data URL
    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    data: dataUrl // ✅ now includes full "data:application/pdf;base64,..."
  };
}));


  const newActivity = {
    activity_type: 'document',
    activity_name: newDocumentName,
    content: {
      documents: storedFiles
    }
  };

  updatedCourse.modules[moduleId].submodules[submoduleId].activities.push(newActivity);
  
  localStorage.setItem("generatedCourse", JSON.stringify(updatedCourse));
  setCourse(updatedCourse);
  setShowAddDocumentModal({});
  setNewDocumentName('');
  setUploadedFiles([]);
};

  const deleteDocument = (moduleId, submoduleId, activityIndex) => {
    const updatedCourse = JSON.parse(JSON.stringify(course));
    // Only allow deletion of document activities
    if (updatedCourse.modules[moduleId]?.submodules[submoduleId]?.activities[activityIndex]?.activity_type === 'document') {
      updatedCourse.modules[moduleId].submodules[submoduleId].activities.splice(activityIndex, 1);
      localStorage.setItem("generatedCourse", JSON.stringify(updatedCourse));
      setCourse(updatedCourse);
    }
  };

  if (!course) return <div className="loading-spinner">Loading Blueprint...</div>;

  return (
    <div className="blueprint-container-generate">
      <div className="structure-section-blueprint-generate">
        <div className="title-generate"><h2>Course Structure</h2></div>
        
        <div className="modules-dropdown-generate">
          {course.modules?.length > 0 ? (
            course.modules.map((module, modIdx) => (
              <div key={modIdx} className="module-dropdown-item-generate">
                <div 
                  className="module-dropdown-header-generate"
                  onClick={() => toggleModule(modIdx)}
                >
                  <div className="module-title-generate">
                    <span className="toggle-icon-generate">
                      {expandedModules[modIdx] ? <FiChevronUp /> : <FiChevronDown />}
                    </span>
                    <h3>Module {modIdx + 1}: {module.module_title}</h3>
                  </div>
                </div>

                {expandedModules[modIdx] && (
                  <div className="submodules-dropdown-generate">
                    {module.submodules?.length > 0 ? (
                      module.submodules.map((submodule, subIdx) => (
                        <div key={subIdx} className="submodule-dropdown-item-generate">
                          <div 
                            className="submodule-dropdown-header-generate"
                            onClick={() => toggleSubmodule(modIdx, subIdx)}
                          >
                            <div className="submodule-title-generate">
                              <span className="toggle-icon-generate">
                                {expandedSubmodules[`${modIdx}-${subIdx}`] ? <FiChevronUp /> : <FiChevronDown />}
                              </span>
                              <h4>Submodule {subIdx + 1}: {submodule.submodule_title}</h4>
                            </div>
                          </div>

                          {expandedSubmodules[`${modIdx}-${subIdx}`] && (
                            <div className="activities-list-generate">
                              <button 
                                className="add-document-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddDocument(modIdx, subIdx);
                                }}
                              >
                                <FiPlus /> Add Document
                              </button>
                              {submodule.activities?.length > 0 ? (
                                submodule.activities.map((activity, actIdx) => {
                                  const contentKey = `${modIdx}-${subIdx}-${actIdx}`;
                                  const hasContent = contentStatus[contentKey] || !!activity.content;
                                  
                                  return (
                                    <div 
                                      key={actIdx} 
                                      className="activity-item-generate"
                                    >
                                      <div 
                                        className="activity-content-wrapper-generate"
                                        onClick={() => handleActivityClick(modIdx, subIdx, activity, actIdx)}
                                      >
                                        <div className="activity-info-generate">
                                          <div 
                                            className="activity-type-generate" 
                                            data-type={activity.activity_type}
                                          >
                                            {activity.activity_type}
                                          </div>
                                          <div className="activity-name-generate">{activity.activity_name}</div>
                                        </div>
                                        <div className="activity-manage-generate">
                                          <span className="activity-manage-text-generate">
                                            {hasContent ? "Manage Content" : "Generate Content"}
                                          </span>
                                          <FiArrowRight className="activity-manage-icon-generate" />
                                        </div>
                                      </div>
                                      {activity.activity_type === 'document' && (
                                        <button 
                                          className="delete-document-button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteDocument(modIdx, subIdx, actIdx);
                                          }}
                                        >
                                          <FiTrash2 />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="empty-state-generate">
                                  No activities generated yet for this submodule
                                </div>
                              )}
                            </div>
                          )}

                          {/* Add Document Modal */}
                          {showAddDocumentModal[`${modIdx}-${subIdx}`] && (
                            <div className="add-document-modal">
                              <div className="modal-content">
                                <h3>Add New Document</h3>
                                <div className="form-group">
                                  <label>Document Name</label>
                                  <input
                                    type="text"
                                    value={newDocumentName}
                                    onChange={(e) => setNewDocumentName(e.target.value)}
                                    placeholder="Enter document name"
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Upload Files (PDF/DOC/DOCX/TXT)</label>
                                  <input
                                    type="file"
                                    multiple
                                    onChange={handleFileUpload}
                                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                  />
                                  {uploadedFiles.length > 0 && (
                                    <div className="file-preview">
                                      {uploadedFiles.map((file, idx) => (
                                        <div key={idx} className="file-item">
                                          {file.name} ({Math.round(file.size / 1024)}KB)
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="modal-actions">
                                  <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={() => setShowAddDocumentModal({})}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="save-button"
                                    onClick={() => saveNewDocument(modIdx, subIdx)}
                                    disabled={!newDocumentName.trim() || uploadedFiles.length === 0}
                                  >
                                    Save Document
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-state-generate">
                        No submodules generated yet for this module
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state-generate">
              No modules generated yet for this course
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerationPage;