import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import './css/Activity.css';

const activity_types = [
  { value: "lecture", label: 'Lecture' },
  { value: "quiz", label: 'Quiz' },
  { value: "assignment", label: 'Assignment' },
  { value: "lab", label: 'Lab' },
  { value: "reading", label: 'Reading' }
];

const ActivitiesPage = () => {
  const { moduleId, submoduleId } = useParams();
  console.log(useParams());
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({ activity_name: '', activity_description: '', activity_objective: '', activity_type: 'lecture' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newActivity, setNewActivity] = useState({ activity_name: '', activity_description: '', activity_objective: '', activity_type: 'lecture' });
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [guidelines, setGuidelines] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("generatedCourse");
    if (stored) {
        const parsed = JSON.parse(stored);
        const module = parsed.modules[moduleId];
        if (module && module.submodules && module.submodules[submoduleId]) {
        const submodule = module.submodules[submoduleId];
        const act = submodule.activities || [];
        setActivities(act);
        if (act.length > 0) {
            setShowForm(false);
        }
        }
    }
    }, [moduleId, submoduleId]);

  const handleGenerateActivities = async () => {
  try {
    setIsGenerating(true); // Start loading
    const stored_conent = localStorage.getItem("generatedCourse");
    if (stored_conent) {
      const parsed = JSON.parse(stored_conent);
      const module = parsed.modules[moduleId];
      if (module && module.submodules && module.submodules[submoduleId]) {
        const submodule = module.submodules[submoduleId];
        const submoduleDescription = submodule.submodule_description;
        const submodule_name = submodule.submodule_title;
        const submodule_id = submodule.submodule_id;

        const response = await fetch("http://localhost:8000/course/generate/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submodule_id: submodule_id,
            submodule_name: submodule_name,
            submodule_description: submoduleDescription,
            activity_types: selectedTypes,
            user_instructions: guidelines
          })
        });

        if (!response.ok) {
          throw new Error("Failed to generate activities");
        }

        const data = await response.json();
        const generatedActivities = data.result.activities || [];

        const stored = localStorage.getItem("generatedCourse");
        if (stored) {
          const parsed = JSON.parse(stored);
          const submodules = parsed.modules[moduleId].submodules || [];
          submodules[submoduleId].activities = generatedActivities;
          submodules[submoduleId].suggestions_activities = data.suggestions;
          parsed.modules[moduleId].submodules = submodules;
          localStorage.setItem("generatedCourse", JSON.stringify(parsed));
        }

        setActivities(generatedActivities);
        setShowForm(false);
        window.location.reload();
      }
    }
  } catch (error) {
    console.error("Error generating activities:", error);
    alert("Failed to generate activities. Please try again.");
  } finally {
    setIsGenerating(false); // Reset loading
  }
};



  const handleEdit = (index) => {
    const activity = activities[index];
    setEditingIndex(index);
    setEditForm({ ...activity });
  };

  const handleSave = () => {
    const updatedActivities = [...activities];
    updatedActivities[editingIndex] = { ...editForm };
    saveActivities(updatedActivities);
    setEditingIndex(null);
  };

  const handleDelete = (index) => {
    if (window.confirm("Are you sure you want to delete this activity?")) {
      const updatedActivities = [...activities];
      updatedActivities.splice(index, 1);
      saveActivities(updatedActivities);
    }
    window.location.reload();
  };

  const handleAddActivity = () => {
    if (!newActivity.activity_name || !newActivity.activity_description || !newActivity.activity_objective) {
      alert("Please fill in all required fields");
      return;
    }
    const updatedActivities = [...activities, { ...newActivity }];
    saveActivities(updatedActivities);
    setNewActivity({ activity_name: '', activity_description: '', activity_objective: '', activity_type: 'lecture' });
    setShowAddModal(false);
    window.location.reload();
  };

  const saveActivities = (updatedActivities) => {
    const stored = localStorage.getItem("generatedCourse");
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.modules[moduleId].submodules[submoduleId].activities = updatedActivities;
      localStorage.setItem("generatedCourse", JSON.stringify(parsed));
      setActivities(updatedActivities);
    }
  };

  const getactivity_typeColor = (type) => {
    switch(type) {
      case 'lecture': return '#6b46c1';
      case 'quiz': return '#10b981';
      case 'assignment': return '#3b82f6';
      case 'lab': return '#f59e0b';
      case 'reading': return '#64748b';
      default: return '#6b46c1';
    }
  };

  return (
    <div className="activities-container">
      {showForm && (
        <div className="generate-form">
          <h2>Select Activity Types and Guidelines</h2>
          <div className="form-group">
            <label>Choose Types*</label>
            <div className="checkbox-group">
              {activity_types.map(type => (
                <label key={type.value}>
                  <input
                    type="checkbox"
                    value={type.value}
                    checked={selectedTypes.includes(type.value)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
                    }}
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Guidelines</label>
            <textarea
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              placeholder="Add instructions for generating activities..."
            />
          </div>
          <button
            className="generate-btn"
            onClick={handleGenerateActivities}
            disabled={isGenerating}
            style={{ opacity: isGenerating ? 0.6 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer' }}
          >
            {isGenerating ? "Generating..." : "Generate Activities"}
          </button>

        </div>
      )}

      {!showForm && (
        <>
          <div className="activities-header">
            <button className="back-btn" onClick={() => navigate(-1)}>
              <FiArrowLeft /> Back to Submodules
            </button>
            <h1>Activities</h1>
            <button className="add-activity-btn" onClick={() => setShowAddModal(true)}>
              + Add Activity
            </button>
          </div>

          <div className="activities-list">
            {activities.map((activity, index) => (
              <div key={index} className="activity-card">
                {editingIndex === index ? (
                  <div className="activity-edit-form">
                    <div className="form-group">
                      <label>Activity Name*</label>
                      <input type="text" value={editForm.activity_name} onChange={(e) => setEditForm({...editForm, activity_name: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Activity Type*</label>
                      <select value={editForm.activity_type} onChange={(e) => setEditForm({...editForm, activity_type: e.target.value})}>
                        {activity_types.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Description*</label>
                      <textarea value={editForm.activity_description} onChange={(e) => setEditForm({...editForm, activity_description: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Objective*</label>
                      <textarea value={editForm.activity_objective} onChange={(e) => setEditForm({...editForm, activity_objective: e.target.value})} />
                    </div>
                    <div className="form-buttons">
                      <button className="save-btn" onClick={handleSave}>Save</button>
                      <button className="cancel-btn" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="activity-header">
                      <div style={{display:'flex', justifyContent: 'space-between'}}>
                        <h3>{activity.activity_name}</h3>
                        <span className="activity-type-badge" style={{ backgroundColor: getactivity_typeColor(activity.activity_type) }}>
                          {activity_types.find(t => t.value === activity.activity_type || t.label === activity.activity_type)?.label || 'Activity'}
                        </span>
                      </div>
                      <div className="activity-actions">
                        <button className="edit-btn" onClick={() => handleEdit(index)}>Edit</button>
                        <button className="delete-btn" onClick={() => handleDelete(index)}>Delete</button>
                      </div>
                    </div>
                    <div className="activity-description">{activity.activity_description}</div>
                    <div className="activity-objective"><strong>Objective:</strong> {activity.activity_objective}</div>
                  </>
                )}
              </div>
            ))}

            {activities.length === 0 && (
              <div className="empty-activities">No activities yet. Click "Add Activity" to create one.</div>
            )}
          </div>
        </>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>Add New Activity</h2>
            <div className="form-group">
              <label>Activity Name*</label>
              <input type="text" value={newActivity.activity_name} onChange={(e) => setNewActivity({...newActivity, activity_name: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Activity Type*</label>
              <select value={newActivity.activity_type} onChange={(e) => setNewActivity({...newActivity, activity_type: e.target.value})}>
                {activity_types.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Description*</label>
              <textarea value={newActivity.activity_description} onChange={(e) => setNewActivity({...newActivity, activity_description: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Objective*</label>
              <textarea value={newActivity.activity_objective} onChange={(e) => setNewActivity({...newActivity, activity_objective: e.target.value})} />
            </div>
            <div className="modal-buttons">
              <button className="save-btn" onClick={handleAddActivity}>Add Activity</button>
              <button className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitiesPage;
