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
  const course_id = sessionStorage.getItem("course_id");
  const module_version_id = sessionStorage.getItem("module_version_id");
  const submodule_version_id = sessionStorage.getItem(`submodule_version_${id}`);

  if (!course_id || !module_version_id || !submodule_version_id) return;

  const fetchModuleAndSubmodules = async () => {
    try {
      const [moduleRes, submodulesRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/course/get_modules?course_id=${course_id}&version_id=${module_version_id}&module_id=${id}`),
        fetch(`http://127.0.0.1:8000/course/get_submodules?module_id=${id}&version_id=${submodule_version_id}`)
      ]);

      if (!moduleRes.ok || !submodulesRes.ok) {
        throw new Error("Failed to fetch module or submodules");
      }

      const moduleData = await moduleRes.json();
      const submodulesData = await submodulesRes.json();
      // 🚨 Check if submodules are empty
      if (!submodulesData.submodules || submodulesData.submodules.length === 0) {
        sessionStorage.removeItem(`submodule_version_${id}`);
        navigate('/submodules');
        return;
      }
      setModule({
        ...(moduleData.module || {}),
        submodules: submodulesData.submodules || [],
        suggestions: submodulesData.suggestions || []
      });
    } catch (err) {
      console.error("Failed to load module or submodules:", err);
      alert("Error loading data. Please try again.");
    }
  };

  fetchModuleAndSubmodules();
}, [id]);


  const handleEdit = (index) => {
    const sub = module.submodules[index];
    setEditingIndex(index);
    setEditForm({
      name: sub.submodule_title,
      description: sub.submodule_description
    });
  };

  const handleSave = async () => {
  const version_id = sessionStorage.getItem(`submodule_version_${id}`);
  const submodule_id = module.submodules[editingIndex]?.submodule_id;

  try {
    await fetch("http://127.0.0.1:8000/course/submodules/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_id: id,
        version_id,
        submodule_id,
        updated_fields: {
          submodule_title: editForm.name,
          submodule_description: editForm.description
        }
      })
    });
    setEditingIndex(null);
    window.location.reload();
  } catch (err) {
    console.error("Update failed", err);
    alert("Failed to update submodule.");
  }
};


  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDelete = async (index) => {
  if (!window.confirm("Are you sure you want to delete this submodule?")) return;

  const submodule_id = module.submodules[index]?.submodule_id;
  const version_id = sessionStorage.getItem(`submodule_version_${id}`);

  try {
    await fetch(`http://127.0.0.1:8000/course/submodules/delete?module_id=${id}&version_id=${version_id}&submodule_id=${submodule_id}`, {
      method: "DELETE"
    });
    window.location.reload();
  } catch (err) {
    console.error("Delete failed", err);
    alert("Failed to delete submodule.");
  }
};


  const handleAddModalSubmit = async () => {
  if (!newSubmodule.name || !newSubmodule.description) {
    alert("Please fill in all fields");
    return;
  }

  const version_id = sessionStorage.getItem(`submodule_version_${id}`);

  try {
    await fetch("http://127.0.0.1:8000/course/submodules/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_id: id,
        version_id,
        submodule: {
          submodule_id: crypto.randomUUID(),
          submodule_title: newSubmodule.name,
          submodule_description: newSubmodule.description
        }
      })
    });

    setNewSubmodule({ name: '', description: '' });
    setShowAddModal(false);
    window.location.reload();
  } catch (err) {
    console.error("Add failed", err);
    alert("Failed to add submodule.");
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