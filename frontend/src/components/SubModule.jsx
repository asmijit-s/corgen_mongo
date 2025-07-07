import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './css/ModulesListPage.css';

const SubmodulesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubmodule, setNewSubmodule] = useState({ name: '', description: '' });

  useEffect(() => {
    const stored = localStorage.getItem("generatedCourse");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.modules && parsed.modules[id]) {
        setModule(parsed.modules[id]);
      }
    }
  }, [id]);

  const handleEdit = (index) => {
    const sub = module.submodules[index];
    setEditingIndex(index);
    setEditForm({
      name: sub.submodule_title,
      description: sub.submoduleDescription
    });
  };

  const handleSave = () => {
    const updatedModule = { ...module };
    updatedModule.submodules[editingIndex] = {
      submodule_title: editForm.name,
      submoduleDescription: editForm.description
    };

    updateModule(updatedModule);
    setEditingIndex(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDelete = (index) => {
    if (window.confirm("Are you sure you want to delete this submodule?")) {
      const updatedModule = { ...module };
      updatedModule.submodules.splice(index, 1);
      updateModule(updatedModule);
    }
    window.location.reload();
  };

  const handleAddModalSubmit = () => {
    if (!newSubmodule.name || !newSubmodule.description) {
      alert("Please fill in all fields");
      return;
    }

    const updatedModule = { ...module };
    if (!updatedModule.submodules) updatedModule.submodules = [];
    
    updatedModule.submodules.push({
      submodule_title: newSubmodule.name,
      submoduleDescription: newSubmodule.description
    });

    updateModule(updatedModule);
    setNewSubmodule({ name: '', description: '' });
    setShowAddModal(false);
    window.location.reload();
  };

  const updateModule = (updatedModule) => {
    const stored = localStorage.getItem("generatedCourse");
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.modules[id] = updatedModule;
      localStorage.setItem("generatedCourse", JSON.stringify(parsed));
      setModule(updatedModule);
    }
  };

  if (!module) return <div className="modules-container">Loading...</div>;

  return (
    <div className="modules-container">
      <div className="modules-header">
        <h1>{module.module_title}</h1>
        <button 
          className="add-module-btn" 
          onClick={() => setShowAddModal(true)}
        >
          + Add Submodule
        </button>
        <button 
          className="back-btn"
          onClick={() => navigate(-1)}
        >
          Back to Modules
        </button>
      </div>

      <div className="module-description">{module.module_description}</div>
      <div className="module-hours">Duration: <span>{module.module_hours}</span></div>

      <div className="submodules-list">
        {module.submodules?.map((submodule, index) => (
          <div key={index} className="module-card submodule-card">
            {editingIndex === index ? (
              <div className="module-edit-form">
                <div className="form-group">
                  <label>Submodule Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleChange}
                    className="form-input-outline"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={editForm.description}
                    onChange={handleChange}
                    className="form-input-outline form-textarea-outline"
                  />
                </div>
                <div className="module-edit-buttons">
                  <button className="build-btn" onClick={handleSave}>Save</button>
                  <button className="cancel-btn" onClick={() => setEditingIndex(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="module-header">
                  <h3 className="module-title">{submodule.submodule_title}</h3>
                  <div style={{display: 'flex'}}>
                    <button className="edit-btn" onClick={() => handleEdit(index)}>
                      Edit
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(index)}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="module-description">{submodule.submodule_description}</div>
              </>
            )}
          </div>
        ))}

        {(!module.submodules || module.submodules.length === 0) && (
          <div className="empty-state">
            No submodules yet. Click "Add Submodule" to create one.
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Add New Submodule</h3>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={newSubmodule.name}
                onChange={(e) => setNewSubmodule({...newSubmodule, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={newSubmodule.description}
                onChange={(e) => setNewSubmodule({...newSubmodule, description: e.target.value})}
              />
            </div>
            <div className="modal-buttons">
              <button className="build-btn" onClick={handleAddModalSubmit}>
                Add
              </button>
              <button className="cancel-btn" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmodulesPage;