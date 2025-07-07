import React, { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronUp, FiEdit } from 'react-icons/fi';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import './css/BluePrint.css';

const BlueprintPage = () => {
  const [course, setCourse] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const [expandedSubmodules, setExpandedSubmodules] = useState({});
  const [editing, setEditing] = useState({
    outline: false,
    module: null,
    submodule: null,
    activity: null
  });
  const navigate = useNavigate();
  useEffect(() => {
    const stored = localStorage.getItem("generatedCourse");
    if (stored) {
      setCourse(JSON.parse(stored));
    }
  }, []);

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };
  const downloadPDF = () => {
  const doc = new jsPDF();
  let y = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 15;
  const maxWidth = 180;

  const checkPageBreak = (lines, lineHeight = 6) => {
    if (y + lines.length * lineHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  const addHeading = (text, indent = 0, fontSize = 14) => {
    doc.setFontSize(fontSize);
    doc.setFont(undefined, 'bold');
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    checkPageBreak(lines, 8);
    lines.forEach(line => {
      doc.text(line, leftMargin + indent, y);
      y += 8;
    });
    doc.setFont(undefined, 'normal');
  };

  const addText = (text, indent = 0, fontSize = 12, gap = 6) => {
    doc.setFontSize(fontSize);
    doc.setFont(undefined, 'normal');
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    checkPageBreak(lines, gap);
    lines.forEach(line => {
      doc.text(line, leftMargin + indent, y);
      y += gap;
    });
  };

  // Start writing the content
  addHeading(`Course ID: ${course.course_id}`);
  addHeading(`Title: ${course.outline.title}`);
  addText(`Duration: ${course.outline.duration}`);
  addText(`Credits: ${course.outline.credits}`);
  
  addHeading(`\nDescription:`, 0);
  addText(course.outline.description, 4);

  addHeading(`\nPrerequisites:`, 0);
  course.outline.prerequisites.forEach(p => addText(`• ${p}`, 6));

  addHeading(`\nLearning Outcomes:`, 0);
  course.outline.learning_outcomes.forEach(o => addText(`• ${o}`, 6));

  course.modules.forEach((mod, mIdx) => {
    addHeading(`\nModule ${mIdx + 1}: ${mod.module_title}`, 0, 13);
    addText(mod.module_description, 4);
    addText(`Hours: ${mod.module_hours}`, 4);

    mod.submodules.forEach((sub, sIdx) => {
      addHeading(`\n  Submodule ${sIdx + 1}: ${sub.submodule_title}`, 6, 12);
      addText(sub.submodule_description, 8);

      sub.activities.forEach((act, aIdx) => {
        addHeading(`\n    Activity ${aIdx + 1}: ${act.activity_name}`, 10, 11);
        addText(`Type: ${act.activity_type}`, 12);
        addText(`Objective: ${act.activity_objective}`, 12);
        addText(`Description: ${act.activity_description}`, 12);
      });
    });
  });

  doc.save(`${course.outline.title.replace(/\s+/g, '_')}_Blueprint.pdf`);
};


  const toggleSubmodule = (moduleId, submoduleId) => {
    const key = `${moduleId}-${submoduleId}`;
    setExpandedSubmodules(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleChange = (path, value) => {
    setCourse(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      let ref = updated;
      for (let i = 0; i < path.length - 1; i++) {
        ref = ref[path[i]];
      }
      ref[path[path.length - 1]] = value;
      return updated;
    });
  };

  const saveChanges = () => {
    localStorage.setItem("generatedCourse", JSON.stringify(course));
    setEditing({
      outline: false,
      module: null,
      submodule: null,
      activity: null
    });
  };
  const handleSaveAndContinue = () => {
    navigate("/generate");
  };
  const cancelEdit = () => {
    setEditing({
      outline: false,
      module: null,
      submodule: null,
      activity: null
    });
  };

  if (!course) return <div className="loading-spinner">Loading Blueprint...</div>;

  return (
    <div className="blueprint-container" id="blueprint-container">
      {/* Outline Section */}
      <div className="outline-section-blueprint">
        <div className="section-header-blueprint">
          <h2>Course Outline</h2>
          <button 
            className="edit-btn-blueprint"
            onClick={() => setEditing({ ...editing, outline: true })}
          >
            <FiEdit /> Edit
          </button>
        </div>
        
        <div className="outline-card-blueprint">
          {editing.outline ? (
            <div className="edit-form-blueprint">
              <div className="form-group-blueprint">
                <label>Course ID</label>
                <input
                  value={course.course_id}
                  onChange={(e) => handleChange(['course_id'], e.target.value)}
                />
              </div>
              <div className="form-group-blueprint">
                <label>Title</label>
                <input
                  value={course.outline.title}
                  onChange={(e) => handleChange(['outline', 'title'], e.target.value)}
                />
              </div>
              <div className="form-group-blueprint">
                <label>Description</label>
                <textarea
                  value={course.outline.description}
                  onChange={(e) => handleChange(['outline', 'description'], e.target.value)}
                />
              </div>
              <div className="form-group-blueprint">
                <label>Duration</label>
                <input
                  value={course.outline.duration}
                  onChange={(e) => handleChange(['outline', 'duration'], e.target.value)}
                />
              </div>
              <div className="form-group-blueprint">
                <label>Credits</label>
                <input
                  type="number"
                  value={course.outline.credits}
                  onChange={(e) => handleChange(['outline', 'credits'], e.target.value)}
                />
              </div>
              <div className="form-group-blueprint">
                <label>Prerequisites</label>
                <textarea
                  value={course.outline.prerequisites.join('\n')}
                  onChange={(e) => handleChange(['outline', 'prerequisites'], e.target.value.split('\n'))}
                />
              </div>
              <div className="form-group-blueprint">
                <label>Learning Outcomes</label>
                <textarea
                  value={course.outline.learning_outcomes.join('\n')}
                  onChange={(e) => handleChange(['outline', 'learning_outcomes'], e.target.value.split('\n'))}
                />
              </div>
              <div className="form-buttons-blueprint">
                <button className="save-btn-blueprint" onClick={saveChanges}>Save</button>
                <button className="cancel-btn-blueprint" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="field-group-blueprint">
                <label>Course ID</label>
                <div className="field-value-blueprint">{course.course_id}</div>
              </div>
              <div className="field-group-blueprint">
                <label>Title</label>
                <div className="field-value-blueprint">{course.outline.title}</div>
              </div>
              <div className="field-group-blueprint">
                <label>Description</label>
                <div className="field-value-blueprint">{course.outline.description}</div>
              </div>
              <div className="field-group-blueprint">
                <label>Duration</label>
                <div className="field-value-blueprint">{course.outline.duration}</div>
              </div>
              <div className="field-group-blueprint">
                <label>Credits</label>
                <div className="field-value-blueprint">{course.outline.credits}</div>
              </div>
              <div className="field-group-blueprint">
                <label>Prerequisites</label>
                <ul className="prerequisites-list-blueprint">
                  {course.outline.prerequisites.map((preq, i) => (
                    <li key={i}>{preq}</li>
                  ))}
                </ul>
              </div>
              <div className="field-group-blueprint">
                <label>Learning Outcomes</label>
                <ul className="outcomes-list-blueprint">
                  {course.outline.learning_outcomes.map((outcome, i) => (
                    <li key={i}>{outcome}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Course Structure Section */}
      <div className="structure-section-blueprint">
        <h2>Course Structure</h2>
        
        <div className="modules-list-blueprint">
          {course.modules.map((module, modIdx) => (
            <div key={modIdx} className="module-card-blueprint">
              <div 
                className="module-header-blueprint"
                onClick={() => toggleModule(modIdx)}
              >
                <div className="module-title-blueprint">
                  <span className="toggle-icon-blueprint">
                    {expandedModules[modIdx] ? <FiChevronUp /> : <FiChevronDown />}
                  </span>
                  <h3>{module.module_title}</h3>
                  <span className="module-hours-blueprint">{module.module_hours}</span>
                </div>
                <button 
                  className="edit-btn-blueprint"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing({ ...editing, module: modIdx });
                  }}
                >
                  <FiEdit />
                </button>
              </div>

              {expandedModules[modIdx] && (
                <div className="module-content-blueprint">
                  {editing.module === modIdx ? (
                    <div className="edit-form-blueprint">
                      <div className="form-group-blueprint">
                        <label>Module Title</label>
                        <input
                          value={module.module_title}
                          onChange={(e) => handleChange(['modules', modIdx, 'module_title'], e.target.value)}
                        />
                      </div>
                      <div className="form-group-blueprint">
                        <label>Description</label>
                        <textarea
                          value={module.module_description}
                          onChange={(e) => handleChange(['modules', modIdx, 'module_description'], e.target.value)}
                        />
                      </div>
                      <div className="form-group-blueprint">
                        <label>Hours</label>
                        <input
                          type="number"
                          value={module.module_hours}
                          onChange={(e) => handleChange(['modules', modIdx, 'module_hours'], e.target.value)}
                        />
                      </div>
                      <div className="form-buttons-blueprint">
                        <button className="save-btn-blueprint" onClick={saveChanges}>Save</button>
                        <button className="cancel-btn-blueprint" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="module-description-blueprint">{module.module_description}</div>
                      
                      <div className="submodules-list-blueprint">
                        {module.submodules.map((submodule, subIdx) => (
                          <div key={subIdx} className="submodule-card-blueprint">
                            <div 
                              className="submodule-header-blueprint"
                              onClick={() => toggleSubmodule(modIdx, subIdx)}
                            >
                              <div className="submodule-title-blueprint">
                                <span className="toggle-icon-blueprint">
                                  {expandedSubmodules[`${modIdx}-${subIdx}`] ? <FiChevronUp /> : <FiChevronDown />}
                                </span>
                                <h4>{submodule.submodule_title}</h4>
                                <span className="activity-count-blueprint">
                                  {submodule.activities?.length || 0} activities
                                </span>
                              </div>
                              <button 
                                className="edit-btn-blueprint"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditing({ ...editing, submodule: `${modIdx}-${subIdx}` });
                                }}
                              >
                                <FiEdit />
                              </button>
                            </div>

                            {expandedSubmodules[`${modIdx}-${subIdx}`] && (
                              <div className="submodule-content-blueprint">
                                {editing.submodule === `${modIdx}-${subIdx}` ? (
                                  <div className="edit-form-blueprint">
                                    <div className="form-group-blueprint">
                                      <label>Submodule Name</label>
                                      <input
                                        value={submodule.submodule_title}
                                        onChange={(e) => handleChange(['modules', modIdx, 'submodules', subIdx, 'submodule_title'], e.target.value)}
                                      />
                                    </div>
                                    <div className="form-group-blueprint">
                                      <label>Description</label>
                                      <textarea
                                        value={submodule.submodule_description}
                                        onChange={(e) => handleChange(['modules', modIdx, 'submodules', subIdx, 'submodule_description'], e.target.value)}
                                      />
                                    </div>
                                    <div className="form-buttons-blueprint">
                                      <button className="save-btn-blueprint" onClick={saveChanges}>Save</button>
                                      <button className="cancel-btn-blueprint" onClick={cancelEdit}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="submodule-description-blueprint">{submodule.submodule_description}</div>
                                    
                                    <div className="activities-list-blueprint">
                                      {submodule.activities?.map((activity, actIdx) => (
                                        <div key={actIdx} className="activity-card-blueprint">
                                          <div className="activity-header-blueprint">
                                            <div className="activity-type-blueprint" style={{ 
                                              backgroundColor: getTypeColor(activity.activity_type)
                                            }}>
                                              {activity.activity_type}
                                            </div>
                                            <h5>{activity.activity_name}</h5>
                                            <button 
                                              className="edit-btn-blueprint"
                                              onClick={() => setEditing({ ...editing, activity: `${modIdx}-${subIdx}-${actIdx}` })}
                                            >
                                              <FiEdit />
                                            </button>
                                          </div>

                                          {editing.activity === `${modIdx}-${subIdx}-${actIdx}` && (
                                            <div className="edit-form-blueprint">
                                              <div className="form-group-blueprint">
                                                <label>Activity Name</label>
                                                <input
                                                  value={activity.activity_name}
                                                  onChange={(e) => handleChange(['modules', modIdx, 'submodules', subIdx, 'activities', actIdx, 'activity_name'], e.target.value)}
                                                />
                                              </div>
                                              <div className="form-group-blueprint">
                                                <label>Type</label>
                                                <select
                                                  value={activity.activity_type}
                                                  onChange={(e) => handleChange(['modules', modIdx, 'submodules', subIdx, 'activities', actIdx, 'activity_type'], e.target.value)}
                                                >
                                                  <option value="lecture">Lecture</option>
                                                  <option value="quiz">Quiz</option>
                                                  <option value="assignment">Assignment</option>
                                                  <option value="lab">Lab</option>
                                                  <option value="reading">Reading</option>
                                                </select>
                                              </div>
                                              <div className="form-group-blueprint">
                                                <label>Description</label>
                                                <textarea
                                                  value={activity.activity_description}
                                                  onChange={(e) => handleChange(['modules', modIdx, 'submodules', subIdx, 'activities', actIdx, 'activity_description'], e.target.value)}
                                                />
                                              </div>
                                              <div className="form-group-blueprint">
                                                <label>Objective</label>
                                                <textarea
                                                  value={activity.activity_objective}
                                                  onChange={(e) => handleChange(['modules', modIdx, 'submodules', subIdx, 'activities', actIdx, 'activity_objective'], e.target.value)}
                                                />
                                              </div>
                                              <div className="form-buttons-blueprint">
                                                <button className="save-btn-blueprint" onClick={saveChanges}>Save</button>
                                                <button className="cancel-btn-blueprint" onClick={cancelEdit}>Cancel</button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="save-continue-container">
        <button 
          className="save-continue-btn"
          onClick={handleSaveAndContinue}
        >
          Save & Continue
        </button>
        <button 
            className="download-pdf-btn"
            onClick={downloadPDF}
            style={{ marginBottom: '1rem' }}
            >
            Download as PDF
            </button>

      </div>
      </div>
    </div>
  );
};

function getTypeColor(type) {
  switch(type) {
    case 'lecture': return '#6b46c1';
    case 'quiz': return '#10b981';
    case 'assignment': return '#3b82f6';
    case 'lab': return '#f59e0b';
    case 'reading': return '#64748b';
    default: return '#6b46c1';
  }
}

export default BlueprintPage;