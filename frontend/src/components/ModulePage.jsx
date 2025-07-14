import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/ModulesPage.css';
import { v4 as uuidv4 } from 'uuid';

const ModulesPage = () => {
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [editingModule, setEditingModule] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', hours: '' });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newModule, setNewModule] = useState({ title: '', description: '', hours: '' });

  useEffect(() => {
  const course_id = sessionStorage.getItem("course_id");
  const module_version_id = sessionStorage.getItem("module_version_id");

  if (!course_id || !module_version_id) return;

  fetch(`http://127.0.0.1:8000/course/get_modules?course_id=${course_id}&version_id=${module_version_id}`)
    .then(res => res.json())
    .then(data => {
      setModules(data.modules);
    })
    .catch(err => {
      console.error(err);
      alert("Failed to load modules.");
    });
}, []);


  const handleEdit = (index) => {
    const mod = modules[index];
    if (!mod) return;
    setEditingModule(index);
    setEditForm({
      title: mod.module_title || '',
      description: mod.module_description || '',
      hours: mod.module_hours || 0
    });
  };

const handleSave = async () => {
  const course_id = sessionStorage.getItem("course_id");
  const version_id = sessionStorage.getItem("module_version_id");
  const module_id = modules[editingModule].module_id;
  console.log(`module_id: ${module_id}`)
  const updatedFields = {
    module_id: module_id,
    module_title: editForm.title,
    module_description: editForm.description,
    module_hours: (editForm.hours)
  };

  try {
    const res = await fetch("http://127.0.0.1:8000/course/module/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id, version_id, module_id, updated_fields: updatedFields })
    });

    if (!res.ok) throw new Error("Failed to update module");

    const updatedModules = [...modules];
    updatedModules[editingModule] = { ...updatedModules[editingModule], ...updatedFields };
    setModules(updatedModules);
    setEditingModule(null);
  } catch (err) {
    console.error(err);
    alert("Update failed.");
  }
};


  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: name === 'hours' ? `${value} hours`: '1 hour'
    }));
  };

  const handleDelete = async (index) => {
  const confirmDelete = window.confirm("Are you sure you want to delete this module?");
  if (!confirmDelete) return;

  const course_id = sessionStorage.getItem("course_id");
  const version_id = sessionStorage.getItem("module_version_id");
  const module_id = modules[index].module_id;

  try {
    const res = await fetch(
      `http://127.0.0.1:8000/course/module/delete?course_id=${course_id}&version_id=${version_id}&module_id=${module_id}`,
      { method: "DELETE" }
    );

    if (!res.ok) throw new Error("Failed to delete");

    const updated = [...modules];
    updated.splice(index, 1);
    setModules(updated);
  } catch (err) {
    console.error(err);
    alert("Delete failed.");
  }
};



  const handleAddModule = () => {
    setShowAddModal(true);
  };

  const handleAddModalChange = (e) => {
    const { name, value } = e.target;
    setNewModule(prev => ({
      ...prev,
      [name]: name === 'hours' ? parseInt(value) || 0 : value
    }));
  };

  const handleAddModalSubmit = async () => {
  if (!newModule.title || !newModule.description) {
    alert("Please fill in all fields.");
    return;
  }

  const moduleToAdd = {
    module_id: uuidv4(),
    module_title: newModule.title,
    module_description: newModule.description,
    module_hours: `${newModule.hours} hours` || "1 hour"
  };

  const course_id = sessionStorage.getItem("course_id");
  const version_id = sessionStorage.getItem("module_version_id");

  try {
    const res = await fetch("http://127.0.0.1:8000/course/module/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id, version_id, module: moduleToAdd })
    });

    if (!res.ok) throw new Error("Failed to add module");

    setModules(prev => [...prev, moduleToAdd]);
    setShowAddModal(false);
    setNewModule({ title: '', description: '', hours: '' });
  } catch (err) {
    console.error(err);
    alert("Failed to add module.");
  }
};


  const handleFinalSave = () => {
    navigate('/submodules');

  };

  return (
    <div className="modules-container">
      <div className="modules-header">
        <h1>Course Modules</h1>
        <button className="add-module-btn" onClick={handleAddModule}>+ Add Module</button>
      </div>

      <div className="modules-list">
        {modules.map((module, index) => (
          <div key={index} className="module-card">
            {editingModule === index ? (
              <div className="module-edit-form">
                <div className="form-group">
                  <label className="form-label">Module Title</label>
                  <input
                    type="text"
                    className="form-input-outline"
                    name="title"
                    value={editForm.title}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input-outline form-textarea-outline"
                    name="description"
                    value={editForm.description}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Hours</label>
                  <input
                    type="number"
                    className="form-input-outline"
                    name="hours"
                    value={
                      typeof editForm.hours === 'string'
                        ? editForm.hours.replace(/\s*hours$/, '')
                        : editForm.hours || ''
                    }
                    onChange={handleChange}
                    min="0"
                  />
                </div>

                <div className="module-edit-buttons">
                  <button className="build-btn" onClick={handleSave}>Save</button>
                  <button className="cancel-btn" onClick={() => setEditingModule(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="module-header">
                  <h3 className="module-title">{module.module_title}</h3>
                  <div style={{display:'flex'}}>
                    <button className="edit-btn" onClick={() => handleEdit(index)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(index)}>Delete</button>
                  </div>
                </div>
                <div className="module-description">{module.module_description}</div>
                <div className="module-hours">Duration: <span>{module.module_hours}</span></div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="modules-footer">
        <button className="generate-course-btn" onClick={handleFinalSave}>
          Save & Continue
        </button>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Add New Module</h3>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                name="title"
                value={newModule.title}
                onChange={handleAddModalChange}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={newModule.description}
                onChange={handleAddModalChange}
              />
            </div>
            <div className="form-group">
              <label>Hours</label>
              <input
                type="number"
                name="hours"
                min="0"
                value={newModule.hours}
                onChange={handleAddModalChange}
              />
            </div>
            <div className="modal-buttons">
              <button className="build-btn" onClick={handleAddModalSubmit}>Add</button>
              <button className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulesPage;
