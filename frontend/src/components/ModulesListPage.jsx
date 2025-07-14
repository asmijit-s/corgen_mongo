import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import './css/ModulesListPage.css';

const ModulesListPage = () => {
  const [modules, setModules] = useState([]);
  const [loadingModuleIndex, setLoadingModuleIndex] = useState(null);
  const [submodulesReady, setSubmodulesReady] = useState(false);
  const navigate = useNavigate();
const checkAllSubmodulesGenerated = async (modules) => {
  const checks = await Promise.all(
    modules.map(async (mod) => {
      const versionId = sessionStorage.getItem(`submodule_version_${mod.module_id}`);
      if (!versionId) return false;

      try {
        const res = await fetch(`http://127.0.0.1:8000/course/get_submodules?module_id=${mod.module_id}&version_id=${versionId}`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.submodules && data.submodules.length > 0;
      } catch {
        return false;
      }
    })
  );

  return checks.every(status => status === true);
};
useEffect(() => {
  const course_id = sessionStorage.getItem("course_id");
  const module_version_id = sessionStorage.getItem("module_version_id");

  if (!course_id || !module_version_id) return;

  const fetchModulesAndCheck = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/course/get_modules?course_id=${course_id}&version_id=${module_version_id}`);
      const data = await res.json();

      setModules(data.modules);

      const allReady = await checkAllSubmodulesGenerated(data.modules);
      setSubmodulesReady(allReady);
    } catch (err) {
      console.error(err);
      alert("Failed to load modules or submodule status.");
    }
  };

  fetchModulesAndCheck();
}, []);

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

  const handleModuleClick = async (index) => {
    const module = modules[index];

    const existingVersion = sessionStorage.getItem(`submodule_version_${module.module_id}`);

      if (existingVersion) {
        navigate(`/submodules/${module.module_id}`);
        return;
      }

    try {
      setLoadingModuleIndex(index); // Mark as loading

      const response = await fetch("http://localhost:8000/course/generate/submodules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: module.module_id || '',
          module_title: module.module_title,
          module_description: module.module_description,
          module_hours: module.module_hours,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate submodules");
      }

      const data = await response.json();
      sessionStorage.setItem(`submodule_version_${module.module_id}`, data.version_id);
      navigate(`/submodules/${module.module_id}`);
    } catch (error) {
      console.error("Error generating submodules:", error);
      alert("Failed to generate submodules. Please try again.");
    } finally {
      setLoadingModuleIndex(null); // Reset loading
    }
  };
  const checkSubmodulesStatus = async (modules) => {
  const checks = await Promise.all(
    modules.map(async (mod) => {
      const versionId = sessionStorage.getItem(`submodule_version_${mod.module_id}`);
      if (!versionId) return { ...mod, submodulesReady: false };

      try {
        const res = await fetch(`http://127.0.0.1:8000/course/get_submodules?module_id=${mod.module_id}&version_id=${versionId}`);
        if (!res.ok) return { ...mod, submodulesReady: false };

        const data = await res.json();
        const hasSubmodules = data?.submodules?.length > 0;

        return { ...mod, submodulesReady: hasSubmodules };
      } catch {
        return { ...mod, submodulesReady: false };
      }
    })
  );

  return checks;
};

  return (
    <div className="modules-container">
      <div className="modules-header">
        <h1>Create Submodules</h1>
      </div>

      <div className="modules-list">
        {modules.map((module, index) => {
          const hasSubmodules = sessionStorage.getItem(`submodule_version_${module.module_id}`);
          const isLoading = loadingModuleIndex === index;

          return (
            <div
              key={index}
              className={`module-card ${isLoading ? 'disabled' : ''}`}
              onClick={() => !isLoading && handleModuleClick(index)}
              style={{ cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
            >
              <div className="module-content">
                <div className="module-info">
                  <h3 className="module-title">{module.module_title}</h3>
                  <div className="module-description">{module.module_description}</div>
                  <div className="module-hours">
                    Duration: <span>{module.module_hours}</span>
                  </div>
                </div>
                <div className="module-arrow-container">
                  <span className="module-arrow-text">
                    {isLoading
                      ? "Creating..."
                      : hasSubmodules
                      ? "Manage"
                      : "Create"} Submodules
                  </span>
                  {!isLoading && <FiArrowRight className="module-arrow-icon" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="modules-footer">
        <button
  className="generate-course-btn"
  onClick={() => navigate('/activities')}
  disabled={!submodulesReady}
  style={{
    opacity: submodulesReady ? 1 : 0.5,
    cursor: submodulesReady ? 'pointer' : 'not-allowed',
  }}
>
  Save & Continue
</button>


      </div>
    </div>
  );
};

export default ModulesListPage;
